/**
 * Unified 25Hz Authoritative `GameInstance` & `GameModePolicy` (`src/server/engine/game-instance.ts`).
 *
 * Powers both Single-Player (via `LocalLoopbackAdapter`) and Multiplayer (via `MultiClientRoomHost`).
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 *
 * `GameInstance` is the single authoritative server runtime (#1328). The legacy `GameEngine` class in
 * `game-engine.ts` is a test-only harness that no production module instantiates; new 1.13c mechanics
 * must be wired here, reusing the canonical subsystems (e.g. player skill casts resolve every number
 * through `skills/registry.ts` `evaluateSkill113c` + `Skills.txt` srvmissile -> `Missiles.txt` ids).
 */

import { RAW_ARMOR, RAW_MISC, RAW_WEAPONS } from '../../common/data/canonical-drop-data.ts'
import { D2DataRegistry, getSharedDataRegistry } from '../../common/data/data-registry.ts'
import { decodeAnimDataFile } from '../../common/formats/animdata.ts'
import {
  BELT_CODE_TO_ROWS,
  BELT_POTION_CATALOG,
  NO_BELT_ROWS,
  areBeltPotionsCompatible,
} from '../../common/items/belt-model.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import { resolveTownPortalSubTile } from '../../common/world/portal.ts'
import type { Item } from '../../common/items/items.ts'
import {
  generateGambleInventory,
  generateVendorStoreInventory,
  resolveGambledItem,
  resolveStorePageForBase,
  VENDOR_TAB_KEYS,
} from '../../common/items/vendor-generator.ts'
import {
  D2_BASE_WALK_SUBTILES_PER_SEC,
  LocalMovementPredictor,
} from '../../common/path/movement-predictor.ts'
import { MONSTER_PATH_DATA, MONSTER_PATH_DATA_STRIDE } from '../../common/path/monster-path-data.ts'
import { MONMODE_KNOCKBACK, MONMODE_RUN, MONMODE_WALK } from '../../common/path/types.ts'
import { getMonsterModeBaseFrameCount113c } from '../../common/path/monster-anim-metrics-113c.ts'
import { getMonsterModeBaseAnimSpeed256, getMonsterPathRecord } from '../../common/path/units.ts'
import { resolveArmorSpeed113c } from '../../common/units/char-anim-speed.ts'
import {
  findPathWorld,
  TOWN_ASTAR_OBSTACLE_DISTANCE_SQ,
  type SubTilePoint,
} from '../../common/path/pathfind.ts'
import { D2Common_10399_AtSubtiles } from '../../common/path/step.ts'
import { CANONICAL_113C_OBJECTS, CANONICAL_113C_SHRINES, isObjectInInteractRange113c } from '../../common/world/objects-meta.ts'
import { classifyObjectOperate113c } from '../../common/world/object-operate-113c.ts'
import {
  QUEST_AREA_GATES_113C,
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  QUEST_OBJECT_TO_QUEST_113C,
  hasQuestFlag113c,
  questWordIndex113c,
  setQuestFlag113c,
} from './quests-113c.ts'
import { createDroppedItem, imbueItem113c, isEligibleForCharsiImbue113c, rollHellforgeDrop } from '../../common/items/drop-tables.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { D2_EXPERIENCE_TABLE_99, PARSED_EXPERIENCE_TABLE } from '../../common/skills/formulas.ts'
import {
  computeMonsterExpGrant113c,
  partyExpPool113c,
  partyExpShare113c,
} from '../../common/progression/experience-113c.ts'
import {
  calculateConvictionStats,
  calculateFanaticismStats,
  calculateHolyFireStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
  calculateMightStats,
} from '../../common/skills/paladin-auras.ts'
import { MONSTATS_113C_ROWS, MONUMOD_113C_ROWS } from '../../common/units/monstats-113c-data.ts'
import {
  MONAI_PROFILES_113C,
  monaiParam113c,
  monaiProfile113c,
  type MonAiFamily,
  type MonAiProfile113c,
} from '../../common/units/monai-113c.ts'
import { CANONICAL_CHARSTATS, type CharacterClassCode } from '../../common/units/classes.ts'
import { HIRELING_RECORDS, resolveHirelingStatsAtLevel } from '../../common/units/hireling-table.ts'
import {
  BONE_FETISH_EXPLOSION_RADIUS,
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  FIRE_ENCHANT_EXPLOSION_RADIUS,
  MON_UMOD,
  calcBoneFetishDeathDamage,
  calcColdEnchantedDeathNova,
  calcFireEnchantedDeathDamage,
  computeChargedBolt8WayVectors,
  D2CLIENT_NOVA_RING_X,
  D2CLIENT_NOVA_RING_Y,
  isBoneFetishMonster,
  isDurielMonster,
  isPoisonDeadMonster,
  isScarabMonster,
  isSuicideMinionMonster,
  resolveMonsterUModIds,
} from '../../common/units/monster-death-fx.ts'
import { getTownNpcDescriptorByHcIdx } from '../../common/units/npc-table.ts'
import { GEM_INFO } from '../../common/items/gems-data.ts'
import {
  CANONICAL_BOSS_MINIONS,
  getCanonicalMonsterKinds,
  getMonsterKindByHcIdx,
  getMonsterModeMissile113c,
  getSuperUniqueByIndex,
  resolveMonsterStats,
  type MonsterKind,
  type MonsterModeMissiles113c,
  type MonsterRank,
} from '../../common/units/monsters-data.ts'
import type { MonsterElementalAttack, MonsterSkillEntry } from '../../common/units/unit-types.ts'
import { getMissileTxtData, MISSILE_CLASS_ID_TO_KEY } from '../../common/skills/missiles-data.ts'
import { PET_TYPE_IDX_BY_NAME_113C, PET_TYPE_PORTRAIT_TABLE } from '../../common/units/pet-type-table.ts'
import { parseTable } from '../../common/world/acts.ts'
import { getLevelMonsterPlan113c } from '../../common/world/level-monster-plans.ts'
import { OBJECTS_LOCKABLE_113C, getObjectsTxtRecord113c } from '../../common/world/objects-txt-113c.ts'
import type {
  CharClassId,
  ClientCommand,
  ItemContainer,
  ItemData,
  ItemQuality,
  LocalAreaBootstrap,
  LocalAreaBootstrapResolver,
  LocalAreaRoomReveal,
  ServerEvent,
  UnitId,
  UnitType,
} from '../../netproto/index.ts'
import { findStandableNear, resolvePresetObject113c } from '../world/area-bootstrap.ts'
import {
  BAAL_THRONE_WAVES_113C,
  tickMercenaryAi25Hz,
  type MercenaryUnitState,
} from '../ai/monster-ai.ts'
import {
  planLevelPopulation113c,
  planRoomPopulation113c,
  type LevelPopulationPlan113c,
  type PopulationRoomRect,
} from '../ai/room-streamer.ts'
import {
  executePendingMonsterDrop113c,
  executeDropPipeline,
  resolveMonsterDropPending113c,
} from '../items/drop-pipeline.ts'
import {
  CONTAINER_OPERATE_DROP_CHANCE_113C,
  domainItemToItemData113c,
  finalizeDroppedItem113c,
  resolveChestDropContext113c,
} from '../items/server-item-data.ts'
import {
  SummonManager,
  type CreatePetOutcome,
  type SummonedPetUnit,
} from '../ai/summon-manager.ts'
import {
  getServerItemDataTables,
  readD2sSave113c,
  type D2sDecodedCharacterSave,
} from '../save/d2s-reader.ts'
import {
  createDefaultNpcIntroData,
  createDefaultWaypointData,
  writeD2sSave113c,
} from '../save/d2s-writer.ts'
import { executeSUnitDmg, type CombatUnitContext, type SUnitDmgOutcome } from './combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from './stat-list.ts'
import { StateBus } from './state-bus.ts'
import type { MissileRecord, SkillRecord } from '../../common/data/data-registry.ts'
import { calculatePhysicalWeaponDamage } from '../../common/skills/formulas.ts'
import {
  computeRepairAllCost113c,
  computeTransactionCost113c,
  getCanonicalTransactionCostTables,
  type TransactionCostContext,
  type TransactionCostInput,
  type TransactionCostStat,
  type TransactionCostTables,
} from '../../common/items/transaction-cost.ts'
import { resolveOnlineItemReqLevel } from '../../common/items/item-bridge.ts'
import { getInventoryGoldLimit, getStashGoldLimit } from '../../common/items/inventory-model.ts'
import { resolveActiveSetBonuses } from '../../common/items/set-items.ts'
import { getAttackWeaponInfo } from '../../common/skills/weapon-combat-meta.ts'
import { resolveWeaponBase113c } from '../../common/units/char-anim-speed.ts'
import type { ItemStat } from '../../netproto/index.ts'
import { AuraScanner, type CorpseContext } from './aura-scanner.ts'
import { isWithinAuraRange } from '../../common/skills/aura-filter.ts'
import { evaluateCalc } from '../../common/data/calc-ast.ts'
import { computeCorpseExplosion113c } from './combat-pipeline.ts'
import {
  difficultyLifeStealDivisor,
  difficultyManaStealDivisor,
  difficultyResistPenalty,
} from './difficulty-resist-penalty.ts'
import { computeMindBlastStunDuration } from '../skills/assassin-shadow.ts'
import { decodeSkillTabParam, skillTabStatParam } from '../../common/skills/skills-data.ts'
import { evaluateSkill113c } from '../skills/registry.ts'
import {
  classifyPlayerSrvDoMissile113c,
  srvdo008FanTargets113c,
  strafeShotCount113c,
} from './player-srvdo-113c.ts'
import {
  checkMissileSegmentFootprintOverlap113c,
  getMissileCollideEntry113c,
} from './missile-engine.ts'
import type { SkillEvalResult } from '../skills/types.ts'

export type GameMode = 'sp' | 'open' | 'realm' | 'singlePlayer' | 'multiplayer'

export interface GameModePolicy {
  readonly mode: GameMode
  readonly maxPlayers: number
  readonly allowPause: boolean
  readonly allowPlayersXCommand: boolean
  readonly persistMapSeedAndFog: boolean
  readonly allowPvpHostile: boolean
  readonly allowPlayerTrade: boolean
  readonly pauseOnSinglePlayerEscape?: boolean | undefined
  readonly persistMapSeedOnSave?: boolean | undefined
  readonly defaultPlayersX?: number | undefined
}

export const SINGLE_PLAYER_POLICY: GameModePolicy = {
  mode: 'sp',
  maxPlayers: 1,
  allowPause: true,
  allowPlayersXCommand: true,
  persistMapSeedAndFog: true,
  allowPvpHostile: false,
  allowPlayerTrade: false,
}

export const OPEN_BNET_POLICY: GameModePolicy = {
  mode: 'open',
  maxPlayers: 8,
  allowPause: false,
  allowPlayersXCommand: true,
  persistMapSeedAndFog: false,
  allowPvpHostile: true,
  allowPlayerTrade: true,
}

export const CLOSED_REALM_POLICY: GameModePolicy = {
  mode: 'realm',
  maxPlayers: 8,
  allowPause: false,
  allowPlayersXCommand: false,
  persistMapSeedAndFog: false,
  allowPvpHostile: true,
  allowPlayerTrade: true,
}

export function resolveGameModePolicy(
  mode: GameMode = 'sp',
  overrides?: Partial<GameModePolicy>,
): GameModePolicy {
  const base: GameModePolicy =
    mode === 'sp' || mode === 'singlePlayer'
      ? SINGLE_PLAYER_POLICY
      : mode === 'open'
        ? OPEN_BNET_POLICY
        : CLOSED_REALM_POLICY

  if (!overrides) {
    return base
  }

  const allowPause =
    overrides.allowPause ??
    overrides.pauseOnSinglePlayerEscape ??
    base.allowPause
  const persistMapSeedAndFog =
    overrides.persistMapSeedAndFog ??
    overrides.persistMapSeedOnSave ??
    base.persistMapSeedAndFog
  const maxPlayers = Math.max(
    1,
    Math.min(8, Math.floor(overrides.maxPlayers ?? base.maxPlayers)),
  )
  const allowPlayersXCommand =
    overrides.allowPlayersXCommand ?? base.allowPlayersXCommand
  const allowPvpHostile = overrides.allowPvpHostile ?? base.allowPvpHostile
  const allowPlayerTrade = overrides.allowPlayerTrade ?? base.allowPlayerTrade
  const resolvedMode = overrides.mode ?? mode

  return {
    mode: resolvedMode,
    maxPlayers,
    allowPause,
    allowPlayersXCommand,
    persistMapSeedAndFog,
    allowPvpHostile,
    allowPlayerTrade,
    ...(overrides.defaultPlayersX !== undefined
      ? {
          defaultPlayersX: Math.max(
            1,
            Math.min(8, Math.floor(overrides.defaultPlayersX)),
          ),
        }
      : {}),
  }
}

export interface GameInstanceConfig {
  readonly mode?: GameMode | undefined
  readonly policy?: Partial<GameModePolicy> | undefined
  readonly mapSeed?: number | undefined
  readonly seed?: number | undefined
  readonly difficulty?: 0 | 1 | 2 | undefined
  readonly act?: number | undefined
  readonly actId?: number | undefined
  readonly areaId?: number | undefined
  readonly maxPlayers?: number | undefined
  readonly playersX?: number | undefined
  readonly onPlayersXChange?: ((playersX: number) => void) | undefined
  readonly gameName?: string | undefined
  readonly registry?: unknown
  /**
   * Server-side area bootstrap resolver (`src/server/world/area-bootstrap.ts`): when set, areas are
   * brought online on demand (game entry, waypoint, town portal, warp) with their collision, rooms,
   * preset objects/NPCs/monsters and warps, and players land on standable floor of the target area.
   */
  readonly resolveAreaBootstrap?: LocalAreaBootstrapResolver | undefined
}

export interface ConnectPlayerSpec {
  readonly charName?: string | undefined
  readonly name?: string | undefined
  readonly classId?: CharClassId | CharacterClassCode | number | string | undefined
  readonly charClass?: CharClassId | CharacterClassCode | number | string | undefined
  readonly level?: number | undefined
  readonly hp?: number | undefined
  readonly maxHp?: number | undefined
  readonly d2s?: Uint8Array | undefined
  readonly d2sBytes?: Uint8Array | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly areaId?: number | undefined
  /**
   * Hard skill points (`skillId -> blvl`) for characters created without a `.d2s`; merged over the
   * `.d2s` skill block when both are given. Only listed skills (plus the universal default skills
   * and item oskills) can be cast.
   */
  readonly skills?: Readonly<Record<number, number>> | undefined
  readonly restoreMercenary?: boolean | undefined
}

export interface SpawnMonsterSpec {
  readonly classId?: number | undefined
  readonly hcIdx?: number | undefined
  readonly monstatsId?: number | undefined
  readonly defId?: string | undefined
  readonly name?: string | undefined
  readonly x: number
  readonly y: number
  readonly areaId?: number | undefined
  readonly hp?: number | undefined
  readonly maxHp?: number | undefined
  readonly minDmg?: number | undefined
  readonly maxDmg?: number | undefined
  readonly ar?: number | undefined
  readonly ac?: number | undefined
  readonly level?: number | undefined
  readonly isNpc?: boolean | undefined
  readonly isVendor?: boolean | undefined
  readonly experience?: number | undefined
  readonly aiDisabled?: boolean | undefined
  readonly rank?: MonsterRank | 'superunique' | 'boss' | undefined
  readonly modifiers?: readonly (string | number)[] | undefined
  readonly monUMods?: readonly (number | string)[] | undefined
  readonly umodIds?: readonly number[] | undefined
  readonly superUniqueId?: string | undefined
  /**
   * `Levels.txt` `MonLvl*Ex` of the level the monster spawns in. On Nightmare/Hell
   * non-boss monsters take the area level (`monsterLevelFor`), which selects the
   * `MonLvl.txt` HP/damage/AC/to-hit/XP row.
   */
  readonly areaLevel?: number | undefined
  /** Seed for the `minHP..maxHP` roll (`MonStats.txt`); omitted = `minHP`. */
  readonly statSeed?: number | undefined
  readonly ai?: string | undefined
  readonly aiDelay?: number | undefined
  readonly aiParams?: readonly number[] | undefined
  readonly resistances?:
    | {
        readonly phys?: number | undefined
        readonly magic?: number | undefined
        readonly fire?: number | undefined
        readonly light?: number | undefined
        readonly lightning?: number | undefined
        readonly cold?: number | undefined
        readonly poison?: number | undefined
      }
    | undefined
  readonly isUndead?: boolean | undefined
  readonly isDemon?: boolean | undefined
  readonly isBoss?: boolean | undefined
  readonly isPrimeEvil?: boolean | undefined
  readonly isKillable?: boolean | undefined
  readonly killable?: boolean | undefined
  readonly petIgnore?: boolean | undefined
  readonly isFlying?: boolean | undefined
  readonly flying?: boolean | undefined
  readonly noRatio?: boolean | undefined
  readonly drain?: number | undefined
  readonly coldEffect?: number | undefined
  /** `MonStats.txt` `DamageRegen`: life regenerated per frame as `maxHp * value / 8192`. */
  readonly damageRegen?: number | undefined
  readonly toBlock?: number | undefined
  readonly velocity?: number | undefined
  readonly runSpeed?: number | undefined
  readonly stepSpeed?: number | undefined
  readonly aggroRadius?: number | undefined
  readonly meleeRange?: number | undefined
  readonly isRanged?: boolean | undefined
  /** `MonStats.txt` `MonType`, or a test/summon override. */
  readonly monType?: string | undefined
  /** `MonStats.txt` resurrection skill id override (181 Resurrect, 327 Resurrect2, 158 SkeletonRaise). */
  readonly resurrectSkillId?: number | undefined
}

export interface HireMercenarySpec {
  readonly act?: 1 | 2 | 3 | 5 | undefined
  readonly subType?: number | undefined
  readonly level?: number | undefined
  readonly difficulty?: 1 | 2 | 3 | undefined
  readonly name?: string | undefined
  readonly hp?: number | undefined
  readonly maxHp?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly activeAura?: string | undefined
  readonly dead?: boolean | undefined
}

export interface ServerMercenaryState {
  readonly unitId: number
  readonly ownerPlayerId: number
  readonly act: 1 | 2 | 3 | 5
  readonly subType: number
  readonly classId: number
  readonly level: number
  readonly difficulty: 1 | 2 | 3
  readonly name: string
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly hp: number
  readonly maxHp: number
  readonly damage: number
  readonly activeAura: string | undefined
  readonly state: string
  readonly alive: boolean
}

export interface SummonPetSpec {
  readonly skillId: number
  readonly slvl?: number | undefined
  readonly skillLevel?: number | undefined
  readonly petType?: string | number | undefined
  readonly classId?: number | undefined
  readonly name?: string | undefined
  readonly hp?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly corpseMonsterId?: number | undefined
  readonly ironGolemItemId?: number | undefined
}

export interface SpawnObjectSpec {
  readonly classId: number
  readonly name?: string | undefined
  readonly x: number
  readonly y: number
  readonly areaId?: number | undefined
  readonly mode?: number | undefined
  readonly isWaypoint?: boolean | undefined
  readonly isShrine?: boolean | undefined
  readonly shrineType?: number | undefined
  readonly destAreaId?: number | undefined
  /** Objects unit flag `+0x80`: a locked chest gets the 1.13c second drop roll (#1337). */
  readonly isLocked?: boolean | undefined
  /** Sparkling chest: the container roll uses the higher-quality (unique-tier) drop path (#1337). */
  readonly isSparkling?: boolean | undefined
}

export interface ServerItemEntry {
  unitId: number
  code: string
  name: string
  quality: number
  level: number
  location:
    | 'ground'
    | 'inventory'
    | 'equipped'
    | 'belt'
    | 'stash'
    | 'cube'
    | 'cursor'
    | 'vendor'
    | 'socket'
  x: number
  y: number
  width: number
  height: number
  areaId: number
  ownerId: number
  bodyLoc: number
  storePage: number
  cost: number
  gamble: boolean
  identified: boolean
  ethereal: boolean
  socketed: boolean
  totalSockets: number
  durability: number
  maxDurability: number
  quantity: number
  stats: Map<number, number>
  socketedItems: ServerItemEntry[]
  /** `Misc/Armor/Weapons.txt` `PermStoreItem`: permanent shop stock. */
  permStore?: boolean | undefined
  /** Item was sold back by this customer; repurchase uses the recorded sell value. */
  buyback?: boolean | undefined
  rawItemData?: ItemData | undefined
}

export interface ServerPlayerState {
  readonly unitId: number
  readonly name: string
  readonly classId: CharClassId
  readonly classCode: CharacterClassCode
  readonly level: number
  readonly act: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly targetX: number
  readonly targetY: number
  readonly run: boolean
  readonly mode: number
  readonly hp: number
  readonly maxHp: number
  readonly mana: number
  readonly maxMana: number
  readonly stamina: number
  readonly maxStamina: number
  readonly experience: number
  readonly gold: number
  readonly goldInInventory: number
  readonly goldBank: number
  readonly stashGold: number
  readonly strength: number
  readonly dexterity: number
  readonly vitality: number
  readonly energy: number
  readonly statPts: number
  readonly statPoints: number
  readonly newSkills: number
  readonly skillPoints: number
  readonly leftSkill: number
  readonly rightSkill: number
  readonly skills: ReadonlyMap<number, number>
  readonly stats: ReadonlyMap<number, number>
  readonly states: ReadonlySet<number>
  readonly items: readonly ServerItemEntry[]
  readonly waypoints: ReadonlySet<number>
  readonly dead: boolean
  readonly corpseId: number | undefined
  readonly activeNpcId: number | undefined
  readonly partyId: number
}

export interface ServerMonsterState {
  readonly unitId: number
  readonly classId: number
  readonly hcIdx: number
  readonly defId: string
  readonly name: string
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly hp: number
  readonly maxHp: number
  readonly baseMaxHp: number
  readonly level: number
  readonly minDmg: number
  readonly maxDmg: number
  readonly ar: number
  readonly ac: number
  readonly experience: number
  readonly mode: number
  readonly dead: boolean
  readonly alive: boolean
  readonly isNpc: boolean
  readonly isVendor: boolean
  readonly isKillable: boolean
  readonly petIgnore: boolean
  readonly isBoss: boolean
  readonly isPrimeEvil: boolean
  readonly isUndead: boolean
  readonly isDemon: boolean
  readonly isFlying: boolean
  readonly isRanged: boolean
  readonly rank: MonsterRank
  readonly modifiers: readonly string[]
  readonly umodIds: readonly number[]
  readonly ai: string
  readonly aiDelay: number
  readonly aiParams: readonly number[]
  readonly resistances: {
    readonly phys: number
    readonly magic: number
    readonly fire: number
    readonly light: number
    readonly cold: number
    readonly poison: number
  }
  readonly frozenTicks: number
  readonly chillTicks: number
  readonly fleeTicks: number
  readonly shattered: boolean
  readonly corpseSuppressed: boolean
  readonly revivedByShaman: boolean
  readonly states: ReadonlySet<number>
}

const MERC_AURA_TO_STATE_ID: Readonly<Record<string, number>> = {
  Might: 33,
  might: 33,
  Prayer: 34,
  prayer: 34,
  Thorns: 36,
  thorns: 36,
  Defiance: 37,
  defiance: 37,
  'Blessed Aim': 40,
  'blessed aim': 40,
  BlessedAim: 40,
  blessedaim: 40,
  'Holy Freeze': 43,
  'holy freeze': 43,
  HolyFreeze: 43,
  holyfreeze: 43,
}

export interface ServerUnitSummary {
  readonly unitType: UnitType
  readonly unitId: number
  readonly classId: number
  readonly x: number
  readonly y: number
  readonly areaId: number
  readonly name?: string | undefined
  readonly mode?: number | undefined
  readonly hp?: number | undefined
  readonly maxHp?: number | undefined
}

const CLASS_CODE_TO_ID: Record<string, CharClassId> = {
  ama: 0,
  amazon: 0,
  sor: 1,
  sorceress: 1,
  nec: 2,
  necromancer: 2,
  pal: 3,
  paladin: 3,
  bar: 4,
  barbarian: 4,
  dru: 5,
  druid: 5,
  ass: 6,
  asn: 6,
  assassin: 6,
}

const CLASS_ID_TO_CODE: Record<number, CharacterClassCode> = {
  0: 'ama',
  1: 'sor',
  2: 'nec',
  3: 'pal',
  4: 'bar',
  5: 'dru',
  6: 'ass',
}

const CLASS_SKILL_OFFSET: Record<number, number> = {
  0: 6, // Amazon: 6..35
  1: 36, // Sorceress: 36..65
  2: 66, // Necromancer: 66..95
  3: 96, // Paladin: 96..125
  4: 126, // Barbarian: 126..155
  5: 221, // Druid: 221..250
  6: 251, // Assassin: 251..280
}

const ACT_TOWN_AREA: Record<number, number> = {
  0: 1,
  1: 40,
  2: 75,
  3: 103,
  4: 109,
}

const TOWN_AREAS = new Set<number>([1, 40, 75, 103, 109])
/** Act town area per 0-based act index (Rogue Encampment, Lut Gholein, Kurast, Pandemonium, Harrogath). */
const ACT_TOWN_AREAS: readonly number[] = [1, 40, 75, 103, 109]
/** 1.13c room AOI: reveal rooms within 8 tiles, hide them once 16 tiles away. */
const ROOM_REVEAL_RADIUS_TILES = 8
const ROOM_HIDE_RADIUS_TILES = 16
/** 1.13c rooms are 8×8 tiles (`[tileX, tileX + 8)` in the client room map). */
const ROOM_TILE_SPAN_113C = 8
const SUBTILES_PER_TILE = 5

/**
 * Canonical 1.13c 39 waypoint bit-index (0..38) to `Levels.txt` areaId mapping.
 */
const WAYPOINT_AREA_IDS: readonly number[] = [
  // Act 1 (0..8)
  1, 3, 4, 5, 6, 27, 29, 32, 35,
  // Act 2 (9..17)
  40, 48, 42, 57, 43, 44, 52, 74, 46,
  // Act 3 (18..26)
  75, 76, 77, 78, 79, 80, 81, 83, 101,
  // Act 4 (27..29)
  103, 106, 107,
  // Act 5 (30..38)
  109, 111, 112, 113, 115, 123, 117, 118, 129,
]

/** 1.13c waypoint OperateFn interaction reach (sub-tiles). */
const WAYPOINT_INTERACT_DISTANCE_SUBTILES = 4
/** D2Client/D2Game warp interaction reach (`D2Common #10407 <= 4`) and 500 ms click cooldown. */
const WARP_INTERACT_DISTANCE_SUBTILES = 4
const WARP_INTERACT_COOLDOWN_FRAMES = 10
/** D2Common #10407 NPC interaction threshold (deferred 0x13 arrival / click with MonStats `interact`). */
const NPC_INTERACT_DISTANCE_SUBTILES = 2
/** Player unit size used by `D2Common #10594` / `#10407` (constant 2 in both binaries). */
const PLAYER_SIZE_X_113C = 2

function areaToAct(areaId: number): 0 | 1 | 2 | 3 | 4 {
  if (areaId >= 109) return 4
  if (areaId >= 103) return 3
  if (areaId >= 75) return 2
  if (areaId >= 40) return 1
  return 0
}

/** #1327: one level's DRLG rooms, its resolved `Levels.txt` plan and which rooms are populated. */
interface AreaPopulationState {
  readonly rooms: readonly PopulationRoomRect[]
  readonly plan: LevelPopulationPlan113c | null
  readonly populated: Set<number>
}

/**
 * 1.13c `Experience.txt` (levels 1..`MaxLvl` = 99), shared with the client via
 * `src/common/skills/formulas.ts`. Index = character level; value = total
 * experience required to reach that level (`[1] = 0`, `[2] = 500`, ...,
 * `[99] = 3520485254`).
 */
const EXP_TABLE_113C: readonly number[] = D2_EXPERIENCE_TABLE_99
const MAX_PLAYER_LEVEL_113C: number = PARSED_EXPERIENCE_TABLE.maxLevel

/**
 * D2Game dispatches on `MonStats.AI` -> `MonAi.txt` row. `GameInstance` keeps one runtime
 * behavior family per AI row (the full 148-row state machines are the long-term target; this
 * table replaces the old defId/name regexes at least for the AI rows with distinct behavior).
 */
export type MonsterAiBehavior = MonAiFamily

/**
 * Row-to-family view of the shared MonAi profile table. The profile module
 * (`src/common/units/monai-113c.ts`) is the single source of truth; this export
 * remains for callers/tests that only need the behavior family.
 */
export const MONSTER_AI_BEHAVIOR_BY_AI: Readonly<Record<string, MonsterAiBehavior>> =
  Object.fromEntries(
    Object.entries(MONAI_PROFILES_113C).map(([key, profile]) => [key, profile.family]),
  )

function monsterProfile113c(ai: string): MonAiProfile113c {
  // Synthetic units without a MonStats row use the MonAi `None` row.
  return monaiProfile113c(ai === '' ? 'None' : ai)
}

function monsterAiBehavior(ai: string): MonsterAiBehavior {
  return monsterProfile113c(ai).family
}

/**
 * Apply the profile's `fireGate` (Bighead row 4: aip1 hurt %, aip3 fire while
 * healthy %, aip4 fire while hurt %). Rows without a gate always fire.
 */
function monsterCanFireRanged113c(
  monster: {
    readonly ai: string
    readonly aiParams: readonly number[]
    readonly hp: number
    readonly maxHp: number
  },
  roll100: number,
): boolean {
  const profile = monsterProfile113c(monster.ai)
  const gate = profile.fireGate
  if (gate === undefined) return true
  const hurtPct = Math.max(
    0,
    Math.min(100, monaiParam113c(profile, monster.aiParams, gate.hurtParam, 0)),
  )
  const hpPct = monster.maxHp > 0 ? (monster.hp / monster.maxHp) * 100 : 100
  const chance = Math.max(
    0,
    Math.min(
      100,
      monaiParam113c(
        profile,
        monster.aiParams,
        hpPct > hurtPct ? gate.healthyChanceParam : gate.hurtChanceParam,
        0,
      ),
    ),
  )
  return chance >= 100 || (chance > 0 && roll100 < chance)
}

function monsterShootRange(monster: {
  readonly ai: string
  readonly aiParams: readonly number[]
}): number {
  const profile = monsterProfile113c(monster.ai)
  const value = monaiParam113c(profile, monster.aiParams, profile.shootDistanceParam, 0)
  return value > 0 ? Math.min(40, Math.max(4, value)) : 35
}

/** Total experience required to reach `level` (1..99) per `Experience.txt`. */
function experienceForLevel113c(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_PLAYER_LEVEL_113C, Math.floor(level)))
  const xp = EXP_TABLE_113C[clamped]
  if (xp === undefined) {
    throw new Error(`Experience.txt has no row for level ${String(clamped)}`)
  }
  return xp
}

interface ItemBaseSizeInfo {
  readonly code: string
  readonly name: string
  readonly width: number
  readonly height: number
  readonly cost: number
  readonly maxDurability: number
  /** Armor/Weapons/Misc.txt `compactsave`: the item is sent as a compact (simple) record. */
  readonly compactSave: boolean
  /** Misc.txt `quest` non-zero: a quest item vendors will not buy. */
  readonly quest: boolean
}

let cachedBaseSizes: Map<string, ItemBaseSizeInfo> | null = null

function getBaseSizeTable(): Map<string, ItemBaseSizeInfo> {
  if (cachedBaseSizes) return cachedBaseSizes
  const map = new Map<string, ItemBaseSizeInfo>()
  const enc = new TextEncoder()
  for (const raw of [RAW_ARMOR, RAW_WEAPONS, RAW_MISC]) {
    const tbl = parseTable(enc.encode(raw))
    const codeIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'code')
    const nameIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'name')
    const wIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'invwidth')
    const hIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'invheight')
    const costIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'cost')
    const durIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'durability')
    const compactIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'compactsave')
    const questIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'quest')
    if (codeIdx === -1) continue
    if (compactIdx === -1) throw new Error('getBaseSizeTable: item table has no compactsave column')
    for (const row of tbl.rows) {
      const code = (row[codeIdx] ?? '').trim()
      if (!code || code.toLowerCase() === 'expansion') continue
      const name = (nameIdx !== -1 ? row[nameIdx] : code)?.trim() || code
      const width = Math.max(1, Number((wIdx !== -1 ? row[wIdx] : '1')?.trim()) || 1)
      const height = Math.max(1, Number((hIdx !== -1 ? row[hIdx] : '1')?.trim()) || 1)
      const cost = Math.max(1, Number((costIdx !== -1 ? row[costIdx] : '50')?.trim()) || 50)
      const maxDurability = Math.max(0, Number((durIdx !== -1 ? row[durIdx] : '20')?.trim()) || 0)
      const compactSave = (row[compactIdx] ?? '').trim() === '1'
      const quest = questIdx !== -1 && (Number((row[questIdx] ?? '0').trim()) || 0) !== 0
      map.set(code, { code, name, width, height, cost, maxDurability, compactSave, quest })
    }
  }
  cachedBaseSizes = map
  return map
}

function lookupBaseInfo(code: string): ItemBaseSizeInfo {
  const clean = code.trim()
  return (
    getBaseSizeTable().get(clean) ?? {
      code: clean || 'hpot',
      name: clean || 'Minor Healing Potion',
      width: 1,
      height: 1,
      cost: 50,
      maxDurability: 20,
      compactSave: false,
      quest: false,
    }
  )
}

/** Armor/Weapons/Misc.txt record of a generated item's base; generated items always have one. */
function requireBaseInfo(code: string): ItemBaseSizeInfo {
  const info = getBaseSizeTable().get(code.trim())
  if (!info) throw new Error(`GameInstance: item code '${code}' is not in Armor/Weapons/Misc.txt`)
  return info
}

/** True when `stats` is exactly the statId -> value fold of `list` (as `itemDataToServerEntry` builds it). */
function statsMapMatchesItemStats(stats: ReadonlyMap<number, number>, list: readonly { statId: number; value: number }[]): boolean {
  const folded = new Map<number, number>()
  for (const st of list) folded.set(st.statId, st.value)
  if (folded.size !== stats.size) return false
  for (const [statId, value] of folded) {
    if (stats.get(statId) !== value) return false
  }
  return true
}

function normalizeClassId(
  raw: CharClassId | CharacterClassCode | number | string | undefined,
): CharClassId {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 6) {
    return raw as CharClassId
  }
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase()
    const mapped = CLASS_CODE_TO_ID[lower]
    if (mapped !== undefined) return mapped
    const num = Number(lower)
    if (Number.isInteger(num) && num >= 0 && num <= 6) return num as CharClassId
  }
  return 0
}

interface InternalPlayerRecord {
  unitId: number
  name: string
  classId: CharClassId
  classCode: CharacterClassCode
  level: number
  act: 0 | 1 | 2 | 3 | 4
  areaId: number
  x: number
  y: number
  targetX: number
  targetY: number
  run: boolean
  mode: number
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  stamina: number
  maxStamina: number
  staminaFixed: number
  maxStaminaFixed: number
  /** 1.13c exhaustion hysteresis: no run until stamina recovers to 25% max. */
  staminaExhausted: boolean
  experience: number
  gold: number
  goldBank: number
  strength: number
  dexterity: number
  vitality: number
  energy: number
  statPts: number
  newSkills: number
  leftSkill: number
  rightSkill: number
  skills: Map<number, number>
  states: Set<number>
  stateTimers: Map<number, number>
  items: ServerItemEntry[]
  corpseItems: ServerItemEntry[]
  ironGolemItem: ServerItemEntry | null
  waypoints: Set<number>
  hasExplicitWaypoints: boolean
  /** 1.13c: waypoint object currently opened for this player (`0x49 WaypointGo` context). */
  activeWaypointUnitId: number
  /** Highest act (0-based) the player has physically reached / unlocked. */
  unlockedAct: number
  /** Last accepted warp/portal interaction frame (500 ms client cooldown). */
  lastWarpInteractFrame: number
  /** Rooms currently revealed to this player (`areaId:tileX:tileY`) for AOI RoomHide. */
  revealedRoomKeys: Set<string>
  /** 1.13c `.d2s` quest flags (48 words) for the active difficulty. */
  questFlags: Uint16Array
  /** Per-player vendor stock (1.13c shops are generated per customer). */
  vendorPools: Map<number, ServerItemEntry[]>
  /** Which window generated each cached vendor pool (`trade`/`gamble`). */
  vendorPoolModes: Map<number, 'trade' | 'gamble'>
  /** Per-player, per-mode shop cache: switching windows must not reroll. */
  vendorPoolsByMode: Map<number, { trade?: ServerItemEntry[]; gamble?: ServerItemEntry[] }>
  activeVendorMode: 'trade' | 'gamble' | null
  dead: boolean
  corpseId: number | undefined
  corpseX: number
  corpseY: number
  activeNpcId: number | undefined
  /** 1.13c interact queue: walk into range, then run the interaction. */
  pendingInteraction?:
    | {
        readonly kind: 'object' | 'warp' | 'npc' | 'waypoint' | 'corpse'
        readonly id: number
        readonly destAreaId?: number
      }
    | undefined
  pendingInteractionSteps?: number | undefined
  pendingNpcGamble?: boolean | undefined
  partyId: number
  d2sTemplate: D2sDecodedCharacterSave | undefined
}

/**
 * Server-side player locomotion state (issue #1329). The player is stepped by the same
 * {@link LocalMovementPredictor} the client uses, so both sides advance by the D2Common 1.13c
 * velocity (walk 9.0 / run 13.5 sub-tiles per second at 25Hz) along the same collision-aware
 * `findPathWorld` waypoints.
 */
interface PlayerMotionState {
  readonly mover: LocalMovementPredictor
  /** Position written by the last movement step; any other value means the player was moved externally. */
  x: number
  y: number
  /** `targetX` / `targetY` the current path was planned for. */
  plannedX: number
  plannedY: number
  /** True while the player follows a path (cleared by arrival or a blocked segment). */
  moving: boolean
  /**
   * Game frame until which `STATE_SYNC_WARPED` is set after an accepted `0x5F` warp
   * (D2Game 0x6FC88530: 125-frame stat list + `EVENTTYPE_REMOVESTATE`).
   */
  syncWarpUntilFrame: number
}

/**
 * Margin (sub-tiles) of the collision window sampled around a player path query: the 18 sub-tile
 * local A* detour radius (`MAX_ASTAR_OBSTACLE_DISTANCE_SQ` = 18²) plus the size-2 `+` footprint.
 */
const PLAYER_PATH_WINDOW_MARGIN = 20
const PLAYER_TOWN_PATH_WINDOW_MARGIN = 36

/**
 * D2Game `D2GAME_PACKETCALLBACK_Rcv0x5F_UpdatePlayerPos` (0x6FC88530, D2MOO `PlrMsg.cpp`)
 * distance bands, measured with D2Common `UNITS_GetDistanceToCoordinates`
 * (`(min + 2 * max) / 2`): below 5 the report is ignored; below 15 or above 45 (or while
 * `STATE_SYNC_WARPED`) the server walks/runs the player toward the reported position; in between
 * it warps the player there when a path reaches it exactly, otherwise answers `0x15`.
 */
const UPDATE_POS_IGNORE_DISTANCE = 5
const UPDATE_POS_WARP_MIN_DISTANCE = 15
const UPDATE_POS_WARP_MAX_DISTANCE = 45
/** `STATE_SYNC_WARPED` duration after an accepted `0x5F` warp (D2Game 0x6FC88530 `nDelay = 125`). */
const SYNC_WARP_DELAY_FRAMES = 125
/**
 * `CLIENTS_ShouldDelayWarpAttempt` jitter (#1336): the warp-attempt lockout is not a fixed
 * 125 frames; add a small deterministic RNG delay (0..5 frames, one 200 ms band) so repeated
 * `0x5F` reports do not align to a fixed tick.
 */
const SYNC_WARP_RANDOM_DELAY_FRAMES = 5

/** D2Common `UNITS_GetDistanceToCoordinates` (D2MOO `Units.cpp`): `(min + 2 * max) / 2`, integer. */
function unitsDistanceToCoordinates113c(x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)
  return dx <= dy ? Math.trunc((dx + 2 * dy) / 2) : Math.trunc((dy + 2 * dx) / 2)
}

/**
 * Player position as carried by S2C packets (`0x15` / `0x18` / `0x95` / `0x96`: u16 sub-tiles).
 * Server movement keeps a fractional position (the shared predictor steps 0.36 / 0.54 sub-tiles
 * per tick), but D2Client's tolerance gate (0x6FADA1B0) compares integer sub-tiles.
 */
function playerWirePosition(player: { readonly x: number; readonly y: number }): {
  readonly x: number
  readonly y: number
} {
  return { x: Math.round(player.x), y: Math.round(player.y) }
}

interface InternalMonsterRecord {
  unitId: number
  classId: number
  hcIdx: number
  defId: string
  /** SuperUniques.txt row id when this is a preset super unique. */
  superUniqueId: string | undefined
  name: string
  areaId: number
  x: number
  y: number
  hp: number
  maxHp: number
  baseMaxHp: number
  level: number
  baseXp: number
  minDmg: number
  maxDmg: number
  /** MonStats `A2MinD/A2MaxD` and `S1MinD/S1MaxD` (difficulty scaled). */
  attack2MinDmg: number
  attack2MaxDmg: number
  special1MinDmg: number
  special1MaxDmg: number
  hasAttack2: boolean
  hasSpecial1: boolean
  /** MonStats `El1..3` elemental melee riders. */
  elementalAttacks: readonly MonsterElementalAttack[]
  /** Melee swing waiting for its action frame (`A1/A2/S1` wind-up). */
  pendingAttack:
    | {
        readonly playerId: number
        readonly frame: number
        readonly mode: number
        readonly skillMode: 'A1' | 'A2' | 'S1'
        readonly minDmg: number
        readonly maxDmg: number
      }
    | undefined
  /** Melee wind-up against a mercenary / summon (same action frame as players). */
  pendingAllyAttack:
    | {
        readonly targetKind: 'merc' | 'pet'
        readonly targetId: number | string
        readonly frame: number
        readonly mode: number
        readonly skillMode: 'A1' | 'A2' | 'S1'
        readonly minDmg: number
        readonly maxDmg: number
      }
    | undefined
  ar: number
  attack2Ar: number
  special1Ar: number
  ac: number
  mode: number
  dead: boolean
  isNpc: boolean
  isVendor: boolean
  isKillable: boolean
  petIgnore: boolean
  isBoss: boolean
  isPrimeEvil: boolean
  isUndead: boolean
  isDemon: boolean
  isFlying: boolean
  isRanged: boolean
  noRatio: boolean
  rank: MonsterRank
  modifiers: readonly string[]
  umodIds: readonly number[]
  /** `MonStats.txt` `MonType` — the race used by shaman / greater-mummy resurrection. */
  monType: string
  /** `MonStats.txt` `SizeX` — NPC interaction distance (`D2Common #10407`). */
  sizeX: number
  /** `MonStats.txt` `Skill1..8` (skill id, animation mode, base level). */
  readonly skills: readonly MonsterSkillEntry[]
  /** Frames until the next `Skill1..8` cast; set from `Skills.txt` delay / AI delay. */
  skillCooldown: number
  /** Round-robin cursor over the monster's projectile skill slots. */
  skillCursor: number
  /** Player who last damaged this monster (1.13c threat / retaliate target). */
  threatPlayerId: number
  threatUntilFrame: number
  /** Last damage instance came from the owner's mercenary (kill MF/GF credit). */
  lastHitByMerc: boolean
  /** Idle wander target / cooldown (MonAi wander when no hostile is in range). */
  wanderCooldown: number
  wanderTargetX: number
  wanderTargetY: number
  /** End frame of the GetHit animation; AI cannot act before it. */
  hitRecoveryUntilFrame: number
  /** S1 resurrection wind-up: the corpse only revives on the action frame. */
  pendingResurrection:
    | { readonly corpseUnitId: number; readonly frame: number }
    | undefined
  /** MonUMod 26 Teleportation cooldown. */
  teleportCooldownUntilFrame: number
  /** Fire Enchanted corpse explosion resolved a few frames after death. */
  pendingDeathExplosion:
    | {
        readonly frame: number
        readonly radius: number
        readonly phys: number
        readonly fire: number
        readonly total: number
      }
    | undefined
  /** `MonStats.txt` `Skill1..8` resurrection skill id (181/327/158), when the row has one. */
  resurrectSkillId: number | undefined
  ai: string
  aiDelay: number
  aiParams: readonly number[]
  /** D2Game `dwNextAiFrame = gameFrame + aidel`. */
  nextAiFrame: number
  /** Run flag of the path currently being followed between AI think frames. */
  pathRunning: boolean
  /** Live children created by a MonAi spawn row (VileMother, nests, ...). */
  spawnedChildren: number
  /** ThornHulk `aip4/aip5`: frenzy window after consecutive A2 swings. */
  consecutiveA2: number
  frenzyUntilFrame: number
  frenzySpeedPct: number
  resistances: {
    phys: number
    magic: number
    fire: number
    light: number
    cold: number
    poison: number
  }
  drain: number
  coldEffect: number
  /** MonStats `DamageRegen` (1.13c: `maxHp * damageRegen / 8192` life per frame). */
  damageRegen: number
  /** Fractional life carried between frames so low regeneration rates still accumulate. */
  regenCarry: number
  /** Active 1.13c poison DoT bitrate in 1/256 HP per frame (`STATE_POISON = 2`). */
  poisonBitrate256: number
  /** Remaining frames of the active poison DoT (`ELen`). */
  poisonRemainingFrames: number
  /** Fractional 1/256 HP poison damage accumulated between frames. */
  poisonCarry256: number
  /** Player unitId credited with the active poison DoT. */
  poisonAttackerId: number
  /** Skill id that applied the active poison DoT. */
  poisonSkillId: number
  toBlock: number
  velocity: number
  runSpeed: number
  stepSpeed: number | undefined
  aggroRadius: number
  cooldown: number
  cooldownTicks: number
  frozenTicks: number
  chillTicks: number
  /** Conversion (state 53) expiry frame; `> currentFrame` means the monster fights for the caster. */
  convertedUntilFrame: number
  convertedByPlayerId: number
  /** MonStats `MissA1/A2/S1/C` missile ids for this monster row. */
  readonly modeMissiles?: MonsterModeMissiles113c | undefined
  /** `MonUMod` 30 `aura`: the 1.13c aura skill this elite carries. */
  auraSkillId: number | undefined
  /** Cached D2Common `findPathWorld` waypoints toward `pathTargetX/Y`. */
  path: readonly SubTilePoint[]
  pathIndex: number
  pathTargetX: number
  pathTargetY: number
  /** DRLG spawn anchor for return-to-nest behaviour. */
  homeX: number
  homeY: number
  fleeTicks: number
  /** Stable fear destination while terror/morale panic is active. */
  fleeTargetX: number
  fleeTargetY: number
  shattered: boolean
  revivedByShaman: boolean
  aiDisabled: boolean
  /** Items rolled on death, spawned when the death animation reaches its drop frame. */
  pendingDropItems: readonly Item[] | undefined
  pendingDropFrame: number
  /** `BaalThrone` (`0x6FCC8430`) wave index `0..5`, sub-step flags, timer frame, and scheduled 17-frame spawn. */
  baalThroneWave: number
  baalThroneFlags: number
  baalThroneTimerFrame: number
  pendingBaalWaveSpawn:
    | {
        readonly frame: number
        readonly superUniqueIndex: number
        readonly x: number
        readonly y: number
      }
    | undefined
  states: Set<number>
  stateTimers: Map<number, number>
  vendorPool: ServerItemEntry[]
  /** 1.13c `D2NpcVendorStrc.bItemsGenerated` (`0x6FCDF730`): whether the town store inventory has been generated. */
  vendorStoreGenerated?: boolean
}

interface InternalMercenaryRecord {
  unitId: number
  ownerPlayerId: number
  act: 1 | 2 | 3 | 5
  subType: number
  classId: number
  level: number
  difficulty: 1 | 2 | 3
  name: string
  areaId: number
  x: number
  y: number
  hp: number
  maxHp: number
  damage: number
  /** Hireling.txt defense and all-resist at this level. */
  defense: number
  resist: number
  reach: number
  aggroRadius: number
  speed: number
  cooldown: number
  cooldownTicks: number
  activeAura: string | undefined
  state: 'idle' | 'follow' | 'chase' | 'attack' | 'dead'
  alive: boolean
  /** Mercenary gear (helmet / armor / weapon) used for kill MF/GF aggregation. */
  equipment: ServerItemEntry[]
}

interface InternalObjectRecord {
  unitId: number
  classId: number
  areaId: number
  x: number
  y: number
  mode: number
  isWaypoint: boolean
  isShrine: boolean
  shrineType: number
  destAreaId: number | undefined
  portalOwnerId: number | undefined
  isLocked: boolean
  isSparkling: boolean
  /** Frame at which a used shrine returns to mode 0 (Shrines.txt ResetTime). */
  shrineResetFrame: number
  /** Compelling Orb hit counter (1.13c requires two Khalim's Will hits). */
  useCount: number
  /** Invisible MonStats 366 compellingorb monster paired with Objects.txt 404 (InitFn 60 @ 0x6fd084a0). */
  linkedMonsterId?: number | undefined
}

/** A level warp (`UNIT_TILE = 5`, S2C 0x09 AssignWarp) of a bootstrapped area. */
interface InternalWarpTileRecord {
  readonly unitId: number
  /** LvlWarp.txt `Id` (the tile unit's class). */
  readonly lvlWarpId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly destAreaId: number
}

/** An area brought online through the area bootstrap resolver. */
interface LoadedAreaRecord {
  readonly areaId: number
  readonly spawnX: number
  readonly spawnY: number
  readonly rooms: readonly LocalAreaRoomReveal[]
  readonly roomRects: LocalAreaBootstrap['roomRects']
  readonly adjacentAreaIds: readonly number[]
  readonly isWalkable: LocalAreaBootstrap['isWalkable']
}

/** How a player enters an area (decides the landing spot, D2Game `LEVEL_WarpUnit` callers). */
export type AreaArrival =
  | { readonly kind: 'waypoint' }
  | { readonly kind: 'townPortal'; readonly x?: number | undefined; readonly y?: number | undefined }
  | { readonly kind: 'warp'; readonly fromAreaId: number }
  | { readonly kind: 'respawn' }

type MissileDamageChannel = 'phys' | 'fire' | 'ltng' | 'cold' | 'pois' | 'mag'

interface InternalMissileRecord {
  unitId: number
  missileId: number
  skillId: number
  ownerType: 'player' | 'monster'
  ownerId: number
  areaId: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  remainingFrames: number
  /** `Missiles.txt` `CollideType` (0 = ignore terrain, 8 = floor-hugging, 1/3/6 = flying). */
  collideType: number
  /** `Missiles.txt` `Size` — collision radius contribution. */
  size: number
  /** `Missiles.txt` `Pierce` — keep flying after a hit. */
  pierce: boolean
  /** `Missiles.txt` `NextHit` / `NextDelay` — re-hit the same unit after this many frames. */
  nextHit: boolean
  nextDelay: number
  /** Damage channel resolved from `Missiles.txt` `EType` or the cast skill. */
  element: MissileDamageChannel
  physDamage: number
  elemDamage: number
  elemDurationFrames: number
  /** Per-frame 1/256 poison bitrate for `EType = pois` player missiles (#1419). */
  poisonBitrate256?: number | undefined
  /** Piercing missiles may only re-hit a unit after `nextDelay` frames. */
  hitCooldowns: Map<number, number>
  /** Death-effect novas apply their elemental packet without a to-hit roll. */
  guaranteedHit: boolean
  /** Converted/confused monster projectiles may hit other monsters. */
  hitMonsters?: boolean
}

function toItemContainer(loc: ServerItemEntry['location']): ItemContainer {
  if (loc === 'equipped') return 'equipment'
  if (loc === 'vendor') return 'shop'
  return loc
}

interface QueuedPlayerCommand {
  readonly playerUnitId: number
  readonly command: ClientCommand
}

let cachedEmbeddedFallbackRegistry: D2DataRegistry | null = null

/** A player skill cast resolved through `skills/registry.ts` (#1328). */
interface PlayerSkillCast {
  readonly skill: SkillRecord
  readonly slvl: number
  readonly evalResult: SkillEvalResult
  /** Server `Missiles.txt` row launched by the cast; `undefined` for missile-less skills. */
  readonly missile: MissileRecord | undefined
  /** Equipped item whose `item_charged_skill` (204) charge pays for this cast (no mana cost). */
  readonly chargeItem?: ServerItemEntry | undefined
  /** Caster stat list / hard points used to evaluate the cast's `Skills.txt` `calc1..calc4` cells. */
  readonly statList: UnitStatList
  readonly blvl: number
}

/** Persistent combat unit: stat list + state bus kept across frames (see `playerCombat`). */
interface PersistentCombatUnit {
  readonly statList: UnitStatList
  readonly stateBus: StateBus
}

/** The selected aura of a player: its `AuraScanner` and evaluated pulse radius in sub-tiles. */
interface PlayerAuraRuntime {
  readonly scanner: AuraScanner
  readonly skillId: number
  readonly radiusSubtiles: number
}

/** Player missile flight speed in subtiles per 25 Hz frame (GameInstance linear missile model). */
const PLAYER_MISSILE_SPEED_SUBTILES = 2.0
/** Melee reach in subtiles for `Skills.txt` `range = h2h | both` strikes. */
const PLAYER_MELEE_REACH_SUBTILES = 4

/**
 * Server missile launched by a player skill: `Skills.txt` `srvmissile` / `srvmissilea`; for weapon
 * throws / shots without a server column (`Throw` 2, `Left Hand Throw` 4) the registry evaluation's
 * weapon missile. Client-only columns (`cltmissile*`) never spawn server missiles.
 */
function resolvePlayerServerMissileName(skill: SkillRecord, evalResult: SkillEvalResult): string {
  if (skill.srvMissile !== '') return skill.srvMissile
  if (skill.srvMissileA !== '') return skill.srvMissileA
  if (skill.cltMissile === '' && skill.cltMissileA === '') return evalResult.missileA
  return ''
}

/** Map `Missiles.txt` / `Skills.txt` `EType` tokens onto the combat damage channels. */
function stableUnitKey(unitKey: string): number {
  let hash = 0
  for (let i = 0; i < unitKey.length; i++) {
    hash = (hash * 31 + unitKey.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

function missileClassElementFallback(id: number): MissileDamageChannel | undefined {
  if (id === 194) return 'cold'
  if (id === 195) return 'ltng'
  if (id === 82) return 'fire'
  return undefined
}

function normalizeMissileElement(eType: string | undefined): MissileDamageChannel | undefined {
  switch ((eType ?? '').trim().toLowerCase()) {
    case 'fire':
    case 'burn':
      return 'fire'
    case 'ltng':
      return 'ltng'
    case 'cold':
    case 'frze':
      return 'cold'
    case 'pois':
      return 'pois'
    case 'mag':
      return 'mag'
    default:
      return undefined
  }
}

/**
 * Skills every player owns without hard points (`Skills.txt` rows with no `charclass` that D2Game
 * adds to each player: Attack, Kick, Throw, Unsummon, Left Hand Throw, Left Hand Swing, and the
 * scroll/book Identify / Town Portal item skills).
 */
const UNIVERSAL_PLAYER_SKILL_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 217, 218, 219, 220])

/** `ItemStatCost.txt` rows used by the player skill / weapon damage resolution. */
const STAT_ITEM_MAXDAMAGE_PERCENT = 17
const STAT_MINDAMAGE = 21
const STAT_MAXDAMAGE = 22
const STAT_SECONDARY_MINDAMAGE = 23
const STAT_SECONDARY_MAXDAMAGE = 24
const STAT_ITEM_ADDCLASSSKILLS = 83
const STAT_ITEM_NONCLASSSKILL = 97
const STAT_ITEM_SINGLESKILL = 107
const STAT_ITEM_ALLSKILLS = 127
const STAT_ITEM_ADDSKILL_TAB = 188
const STAT_ITEM_CHARGED_SKILL = 204

/** Body locations of the weapon hands (`BodyLocs.txt`: 4 = right arm, 5 = left arm). */
const BODYLOC_RIGHT_ARM = 4
const BODYLOC_LEFT_ARM = 5

/** `Skills.txt` rows / `srvdofunc` ids with dedicated server handling (movement skills). */
const SKILL_UNSUMMON = 3
const SKILL_TELEPORT = 54
const SKILL_PRAYER = 99
/** 1.13c monsters spawn their drop at the death animation's drop frame (~0.4 s at 25 Hz). */
const MONSTER_DEATH_DROP_DELAY_FRAMES = 10
/** Room/AOI activation radius: monsters farther than this stop running AI (1.13c room sleep). */
const MONSTER_ACTIVATION_RADIUS_SUBTILES = 80
/** Retaliation (last attacker) window; 1.13c monsters re-target their attacker for ~10 s. */
const MONSTER_THREAT_FRAMES = 250
/** Fallback GetHit animation lock (AnimData `GH`) when a monster token has no `GH` record. */
const MONSTER_HIT_RECOVERY_FRAMES = 6
/** Server knockback max travel in sub-tiles (`PATHTYPE_KNOCKBACK_SERVER`: 2–3 sub-tiles). */
const MONSTER_KNOCKBACK_DISTANCE = 3
/** `Skills.txt` rows whose hits apply 1.13c knockback (Smite, Bash, Charge, kicks, psi, boulder). */
const MONSTER_KNOCKBACK_SKILLS: ReadonlySet<number> = new Set([
  43, // Telekinesis
  97, // Smite
  107, // Charge
  119, // Sanctuary aura pulse
  126, // Bash
  132, // Leap landing
  143, // Leap Attack
  229, // Molten Boulder
  253, // Psychic Hammer
  255, // Dragon Talon (final kick)
  270, // Dragon Tail
  273, // Mind Blast
  326, // BearSmite
  352, // SerpentCharge
])

/** `MonUMod.txt` row id -> the label surfaced on `ServerMonsterState.modifiers`. */
const MON_UMOD_LABELS_113C: Readonly<Record<number, string>> = Object.freeze({
  5: 'Extra_Strong',
  6: 'Extra_Fast',
  7: 'Cursed',
  8: 'Magic_Resistant',
  9: 'Fire_Enchanted',
  17: 'Lightning_Enchanted',
  18: 'Cold_Enchanted',
  25: 'Mana_Burn',
  26: 'Teleportation',
  27: 'Spectral_Hit',
  28: 'Stone_Skin',
  29: 'Multiple_Shots',
  30: 'Aura_Enchanted',
  36: 'Ghostly',
  37: 'Fanatic',
  38: 'Possessed',
  39: 'Berserk',
})

const MON_UMOD_ROW_BY_ID_113C: ReadonlyMap<number, (typeof MONUMOD_113C_ROWS)[number]> =
  new Map(MONUMOD_113C_ROWS.map((row) => [row.umodId, row]))

/** 1.13c `MonUMod.txt` `monsteruniqueprop*` aura pool (Might/Holy Fire/Holy Freeze/Holy Shock/Fanaticism/Conviction). */
const MONSTER_AURA_SKILL_IDS_113C: readonly number[] = [98, 102, 114, 118, 122, 123]

/** `MonUMod.txt` constant column (0 when the id has no row). */
function monUmodConstant113c(id: number): number {
  return MON_UMOD_ROW_BY_ID_113C.get(id)?.constants ?? 0
}
const SRVDOFUNC_TELEKINESIS = 21
const SRVDOFUNC_NOVA = 22
const SRVDOFUNC_PSYCHIC_HAMMER = 33
const SRVDOFUNC_MIND_BLAST = 51
const SRVDOFUNC_CORPSE_EXPLOSION = 55
const SRVDOFUNC_DRAGON_FLIGHT = 52
const SRVDOFUNC_CHARGE = 67
const SRVDOFUNC_WHIRLWIND = 76
const SRVDOFUNC_LEAP = 77
const SRVDOFUNC_LEAP_ATTACK = 78

/**
 * Every stat (with its `param`) carried by one item: its own stat list, runeword stats and the
 * stats of socketed gems/runes/jewels. Items without decoded `ItemData` only carry param-less stats.
 */
function collectItemStats(item: ServerItemEntry): ItemStat[] {
  const out: ItemStat[] = []
  if (item.rawItemData !== undefined) {
    out.push(...item.rawItemData.stats, ...item.rawItemData.runewordStats)
  } else {
    for (const [statId, value] of item.stats) out.push({ statId, param: 0, value })
  }
  for (const child of item.socketedItems) out.push(...collectItemStats(child))
  return out
}

function collectEquippedItemStats(items: readonly ServerItemEntry[]): ItemStat[] {
  const out: ItemStat[] = []
  for (const item of items) {
    if (item.location === 'equipped') out.push(...collectItemStats(item))
  }
  return out
}

/**
 * Equipped item with `item_charged_skill` (204) charges left for `skillId`. The stat param packs
 * `skill << 6 | level` and the value `charges | maxCharges << 8` (ItemStatCost 204, `item-bridge`).
 */
function findChargedSkill(
  items: readonly ServerItemEntry[],
  skillId: number,
): { readonly item: ServerItemEntry; readonly slvl: number } | undefined {
  for (const item of items) {
    if (item.location !== 'equipped' || item.rawItemData === undefined) continue
    for (const stat of item.rawItemData.stats) {
      if (stat.statId !== STAT_ITEM_CHARGED_SKILL) continue
      if (stat.param >> 6 !== skillId) continue
      if ((stat.value & 0xff) <= 0) continue
      return { item, slvl: Math.max(1, stat.param & 0x3f) }
    }
  }
  return undefined
}

/** Spend one charge of `skillId` on `item` (stat 204 current charges, low byte). */
function consumeSkillCharge(item: ServerItemEntry, skillId: number): void {
  const raw = item.rawItemData
  if (raw === undefined) {
    throw new Error(`consumeSkillCharge: item ${item.unitId} has no decoded stat list`)
  }
  let spent = false
  const stats = raw.stats.map((stat) => {
    if (spent || stat.statId !== STAT_ITEM_CHARGED_SKILL || stat.param >> 6 !== skillId) return stat
    const charges = stat.value & 0xff
    if (charges <= 0) return stat
    spent = true
    return { ...stat, value: (stat.value & ~0xff) | (charges - 1) }
  })
  if (!spent) {
    throw new Error(`consumeSkillCharge: item ${item.unitId} has no charges of skill ${skillId}`)
  }
  item.rawItemData = { ...raw, stats }
  const updated = stats.find((s) => s.statId === STAT_ITEM_CHARGED_SKILL && s.param >> 6 === skillId)
  if (updated) item.stats.set(STAT_ITEM_CHARGED_SKILL, updated.value)
}

function getOrCreateEmbeddedFallbackRegistry(): D2DataRegistry {
  if (cachedEmbeddedFallbackRegistry !== null) {
    return cachedEmbeddedFallbackRegistry
  }
  const emptyTable = { columns: [] as const, rows: [] as const }
  const emptyAnimData = decodeAnimDataFile(new Uint8Array(256 * 4))
  cachedEmbeddedFallbackRegistry = new D2DataRegistry({
    skillsTable: emptyTable,
    skillDescTable: emptyTable,
    missilesTable: emptyTable,
    statesTable: emptyTable,
    itemStatCostTable: emptyTable,
    charStatsTable: emptyTable,
    monStatsTable: emptyTable,
    monStats2Table: emptyTable,
    overlayTable: emptyTable,
    petTypeTable: emptyTable,
    elemTypesTable: emptyTable,
    hitClassTable: emptyTable,
    eventsTable: emptyTable,
    skillCalcTable: emptyTable,
    missCalcTable: emptyTable,
    animData: emptyAnimData,
  })
  return cachedEmbeddedFallbackRegistry
}


/** Non-act-boss quest monsters whose death completes a 1.13c quest (`MonStats` id or `SuperUniques` id). */
const QUEST_BOSS_KILL_113C: readonly (readonly [string, string])[] = [
  ['bloodraven', 'a1q2'],
  ['countess', 'a1q4'],
  ['the countess', 'a1q4'],
  ['radament', 'a2q1'],
  ['summoner', 'a2q5'],
  ['the summoner', 'a2q5'],
  ['izual', 'a4q1'],
  ['shenk', 'a5q1'],
  ['siege boss', 'a5q1'],
  ['nihlathak', 'a5q4'],
]

/**
 * 1.13c Quest Object -> Quest Item code (`gpObjectOperateFnTable` @ `D2Game.dll!0x6FD27BB8`):
 * - 30 (Inifuss Tree, OperateFn 12 @ 0x6FCDEF20) -> 'bks' (Scroll of Inifuss)
 * - 108 (Horadric Malus Stand, OperateFn 21 @ 0x6FC85D40) -> 'hdm' (Horadric Malus)
 * - 149 (Tainted Sun Altar, OperateFn 24 @ 0x6FCE76B0) -> 'vip' (Amulet of the Viper)
 * - 193 (Lam Esen's Tome Stand, OperateFn 28 @ 0x6FD094C0) -> 'bbb' (Lam Esen's Tome)
 * - 244 / 246 (Rat's Nest, Act 3 Q1) -> 'j34' (Jade Figurine)
 * - 252 (The Gidbinn Decoy, OperateFn 31 @ 0x6FD09C80) -> 'g33' (The Gidbinn)
 * - 354 (Horadric Cube Chest, OperateFn 39 @ 0x6FCEA050) -> 'box' (Horadric Cube)
 * - 355 (Horadric Scroll Chest, OperateFn 40 @ 0x6FCEA290) -> 'tr1' (Horadric Scroll)
 * - 356 (Staff of Kings Chest, OperateFn 41 @ 0x6FCEA170) -> 'msf' (Staff of Kings)
 * - 405 (Khalim's Chest 1, OperateFn 57 @ 0x6FD0A5F0) -> 'qhr' (Khalim's Heart)
 * - 406 (Khalim's Chest 2, OperateFn 59 @ 0x6FD0A390) -> 'qbr' (Khalim's Brain)
 * - 407 (Khalim's Chest 3, OperateFn 58 @ 0x6FD0A4C0) -> 'qey' (Khalim's Eye)
 */
const QUEST_OBJECT_DROP_ITEM_CODE_113C: Readonly<Record<number, string>> = Object.freeze({
  30: 'bks',
  108: 'hdm',
  149: 'vip',
  193: 'bbb',
  244: 'j34',
  246: 'j34',
  252: 'g33',
  354: 'box',
  355: 'tr1',
  356: 'msf',
  405: 'qhr',
  406: 'qbr',
  407: 'qey',
})

/** Ancients' Altar -> the three Ancient Barbarians. */
const ANCIENT_BARBARIANS_113C: readonly {
  readonly defId: string
  readonly superUniqueId: string
}[] = Object.freeze([
  { defId: 'ancientbarb1', superUniqueId: 'Ancient Barbarian 1' },
  { defId: 'ancientbarb2', superUniqueId: 'Ancient Barbarian 2' },
  { defId: 'ancientbarb3', superUniqueId: 'Ancient Barbarian 3' },
])

/** Chaos Sanctuary seal -> SuperUnique boss spawned by that seal. */
const SEAL_BOSS_113C: Readonly<
  Record<number, { readonly defId: string; readonly superUniqueId: string }>
> = Object.freeze({
  392: { defId: 'fingermage3', superUniqueId: 'Grand Vizier of Chaos' },
  394: { defId: 'doomknight3', superUniqueId: 'Lord De Seis' },
  396: { defId: 'megademon3', superUniqueId: 'Infector of Souls' },
})

export class GameInstance {
  readonly mode: GameMode
  readonly policy: GameModePolicy
  readonly difficulty: 0 | 1 | 2
  readonly gameName: string
  readonly registry: D2DataRegistry

  private currentFrame = 0
  private currentMapSeed: number
  private readonly hasExplicitMapSeed: boolean
  readonly defaultAreaId: number | undefined
  private readonly defaultAct: 0 | 1 | 2 | 3 | 4 | undefined
  private rng: D2Rng
  private pausedState = false
  private manualPlayersX: number
  private nextUnitId = 1

  private readonly players = new Map<number, InternalPlayerRecord>()
  private readonly monsters = new Map<number, InternalMonsterRecord>()
  private readonly mercenaries = new Map<number, InternalMercenaryRecord>()
  private readonly summonManagers = new Map<number, SummonManager>()
  private readonly petUnitIds = new Map<string, number>()
  private readonly objects = new Map<number, InternalObjectRecord>()
  /** Deferred quest object spawns (e.g. Duriel's Lair portal after the staff). */
  /** SuperUnique seal bosses killed per area. */
  private readonly sealBossDeaths = new Map<number, Set<string>>()
  /** Areas where Diablo has already been spawned after the seals. */
  private readonly diabloSpawnedAreas = new Set<number>()
  /** Ancient Barbarian deaths per area. */
  private readonly ancientDeaths = new Map<number, Set<string>>()
  /** Areas where the five Cairn Stones already opened the Tristram portal. */
  private readonly cairnPortalAreas = new Set<number>()
  /** Council member defIds killed per area (a3q5 needs all three). */
  private readonly councilDeaths = new Map<number, Set<string>>()
  private readonly pendingObjectSpawns: {
    frame: number
    classId: number
    x: number
    y: number
    areaId: number
    destAreaId?: number | undefined
  }[] = []
  private readonly pendingObjectModeTransitions: {
    frame: number
    unitId: number
    mode: number
  }[] = []
  private readonly groundItems = new Map<number, ServerItemEntry>()
  /** Gamble-window mystery items by vendor entry unit id, resolved by `resolveGambledItem` on purchase. */
  private readonly gambleSourceItems = new Map<number, Item>()
  /** `${MonStats Id}:${difficulty}` of Act bosses already killed in this game (quest TC only on the first kill). */
  private readonly killedActBosses = new Set<string>()
  private readonly missiles = new Map<number, InternalMissileRecord>()
  /** Per-player `Skills.txt` `delay` cooldowns: playerUnitId -> (skillId -> first frame the skill is ready). */
  private readonly playerSkillReadyFrame = new Map<number, Map<number, number>>()
  /**
   * #1417: `Skills.txt` `srvdofunc` ids of missile skills whose `D2Game.dll` volley logic has no
   * GameInstance implementation yet (see `classifyPlayerSrvDoMissile113c`); reported once each.
   */
  private readonly unmodeledPlayerSrvDoFuncs = new Set<number>()
  /**
   * #1327: per-level room population state. `plan === null` marks a level that
   * populates nothing (town, `MonDen` 0, no DRLG rooms) so it is not re-resolved.
   */
  private readonly areaPopulations = new Map<number, AreaPopulationState>()
  private areaRoomProvider:
    | ((areaId: number) => readonly PopulationRoomRect[] | null | undefined)
    | undefined
  /** Active aura (`Skills.txt` `aura = 1` `aurastate` row id) per player unit id. */
  private readonly playerActiveAuraState = new Map<number, number>()
  /**
   * Persistent 1.13c combat contexts (`UnitStatList` + `StateBus`) carrying skill buff / curse / aura
   * states with their `aurastat` modifiers, so they feed `executeSUnitDmg` and the weapon damage roll.
   */
  private readonly playerCombat = new Map<number, PersistentCombatUnit>()
  private readonly monsterCombat = new Map<number, PersistentCombatUnit>()
  /** Per-player `AuraScanner` running the selected aura's periodic pulse (`perdelay`). */
  private readonly playerAuraScanners = new Map<number, PlayerAuraRuntime>()
  private readonly commandQueue: QueuedPlayerCommand[] = []
  private readonly outbox = new Map<number, ServerEvent[]>()
  private readonly playerMotion = new Map<number, PlayerMotionState>()
  private terrainWalkableCheck:
    | ((areaId: number, x: number, y: number, isFlying?: boolean) => boolean)
    | undefined
  private areaBootstrapResolver: LocalAreaBootstrapResolver | undefined
  private onPlayersXChange: ((playersX: number) => void) | undefined
  private readonly loadedAreas = new Map<number, LoadedAreaRecord>()
  private readonly warpTiles = new Map<number, InternalWarpTileRecord>()

  constructor(config: GameInstanceConfig = {}) {
    const inferredMode: GameMode =
      config.policy?.mode ?? config.mode ?? 'sp'
    this.mode = inferredMode

    if (
      config.policy &&
      config.maxPlayers === undefined &&
      config.playersX === undefined &&
      (config.policy === SINGLE_PLAYER_POLICY ||
        config.policy === OPEN_BNET_POLICY ||
        config.policy === CLOSED_REALM_POLICY)
    ) {
      this.policy = config.policy as GameModePolicy
    } else {
      this.policy = resolveGameModePolicy(inferredMode, {
        ...config.policy,
        ...(config.maxPlayers !== undefined ? { maxPlayers: config.maxPlayers } : {}),
        ...(config.playersX !== undefined ? { defaultPlayersX: config.playersX } : {}),
      })
    }

    this.difficulty = config.difficulty ?? 0
    this.gameName = config.gameName ?? 'LocalGame'
    if (
      config.registry &&
      typeof (config.registry as D2DataRegistry).getSkillById === 'function'
    ) {
      this.registry = config.registry as D2DataRegistry
    } else {
      try {
        this.registry = getSharedDataRegistry()
      } catch {
        this.registry = getOrCreateEmbeddedFallbackRegistry()
      }
    }
    this.defaultAreaId = config.areaId
    const rawAct = config.act ?? config.actId
    this.defaultAct =
      rawAct !== undefined && rawAct >= 0 && rawAct <= 4
        ? (rawAct as 0 | 1 | 2 | 3 | 4)
        : undefined

    const rawSeed = config.mapSeed ?? config.seed
    this.hasExplicitMapSeed = rawSeed !== undefined && rawSeed !== 0
    this.currentMapSeed = ((rawSeed ?? 0x12345678) >>> 0) || 1
    this.rng = new D2Rng(this.currentMapSeed)
    this.manualPlayersX = Math.max(
      1,
      Math.min(8, Math.floor(config.playersX ?? this.policy.defaultPlayersX ?? 1)),
    )
    this.onPlayersXChange = config.onPlayersXChange
    if (config.resolveAreaBootstrap) {
      this.setAreaBootstrapResolver(config.resolveAreaBootstrap)
    }
  }

  /**
   * Install the server-side area bootstrap resolver. From then on the terrain check dispatches to the
   * loaded area's collision; an area that was never brought online is void (not walkable).
   */
  setAreaBootstrapResolver(resolver: LocalAreaBootstrapResolver): void {
    if (this.players.size > 0) {
      throw new Error('GameInstance.setAreaBootstrapResolver: must be installed before players connect')
    }
    this.areaBootstrapResolver = resolver
    this.terrainWalkableCheck = (areaId, x, y, isFlying) => {
      const area = this.loadedAreas.get(areaId)
      if (!area) return false
      return area.isWalkable(areaId, x, y, isFlying)
    }
    // #1327 room population reads the DRLG rooms of the loaded area.
    this.setAreaRoomProvider((areaId) => this.loadedAreas.get(areaId)?.roomRects ?? null)
  }

  /** Whether the area bootstrap resolver brought `areaId` online. */
  isAreaLoaded(areaId: number): boolean {
    return this.loadedAreas.has(areaId)
  }

  /**
   * Bring `areaId` online once (D2Game room/level allocation on first entry): register its collision and
   * rooms and spawn its preset objects, NPCs/monsters and warp tiles. Returns `false` without a resolver
   * or when the resolver cannot build the level (map assets not loaded).
   */
  ensureAreaLoaded(areaId: number): boolean {
    return this.loadArea(areaId) !== null
  }

  private loadArea(areaId: number): LoadedAreaRecord | null {
    const existing = this.loadedAreas.get(areaId)
    if (existing) return existing
    const resolver = this.areaBootstrapResolver
    if (!resolver) return null
    const bootstrap = resolver({
      act: areaToAct(areaId),
      areaId,
      mapSeed: this.currentMapSeed,
      difficulty: this.difficulty,
    })
    if (!bootstrap) return null
    if (bootstrap.areaId !== areaId) {
      throw new Error(
        `GameInstance.ensureAreaLoaded: resolver returned area ${bootstrap.areaId} for area ${areaId}`,
      )
    }
    const record: LoadedAreaRecord = {
      areaId,
      spawnX: bootstrap.spawnX,
      spawnY: bootstrap.spawnY,
      rooms: bootstrap.rooms,
      roomRects: bootstrap.roomRects,
      adjacentAreaIds: bootstrap.adjacentAreaIds ?? [],
      isWalkable: bootstrap.isWalkable,
    }
    this.loadedAreas.set(areaId, record)
    for (const obj of bootstrap.objects) {
      const resolved = resolvePresetObject113c(obj.classId, areaId, obj.x, obj.y)
      if (!resolved) continue
      this.spawnObject({
        classId: resolved.classId,
        x: obj.x,
        y: obj.y,
        areaId,
        mode: obj.mode,
        isWaypoint: obj.isWaypoint,
        isShrine: obj.isShrine,
        isLocked: OBJECTS_LOCKABLE_113C.has(resolved.classId),
        isSparkling: obj.isSparkling ?? resolved.isSparkling,
        destAreaId: obj.destAreaId,
      })
    }
    for (const mon of bootstrap.monsters) {
      if (mon.superUniqueIndex !== undefined) {
        this.spawnSuperUnique({ superUniqueIndex: mon.superUniqueIndex, x: mon.x, y: mon.y, areaId })
        continue
      }
      this.spawnMonster({
        classId: mon.classId,
        x: mon.x,
        y: mon.y,
        areaId,
        name: mon.name,
        isNpc: mon.isNpc,
        isVendor: mon.isVendor,
        isKillable: mon.isKillable,
        aiDisabled: mon.aiDisabled,
      })
    }
    for (const warp of bootstrap.warps) {
      const unitId = this.allocateUnitId()
      const tile: InternalWarpTileRecord = {
        unitId,
        lvlWarpId: warp.lvlWarpId,
        areaId,
        x: warp.x,
        y: warp.y,
        destAreaId: warp.destAreaId,
      }
      this.warpTiles.set(unitId, tile)
      this.broadcastToArea(areaId, this.warpTileAssignEvent(tile))
    }
    return record
  }

  /**
   * Bring the 1-hop seam neighbours of `areaId` online so collision at an outdoor border is
   * composited across both regions (#1335). Idempotent; failures are retried by the next call.
   */
  private ensureAdjacentAreasLoaded(areaId: number): void {
    const area = this.loadedAreas.get(areaId)
    if (!area) return
    for (const id of area.adjacentAreaIds) {
      if (id > 0 && id !== areaId && !this.loadedAreas.has(id)) this.loadArea(id)
    }
  }

  /** S2C 0x09 AssignWarp (`UNIT_TILE = 5`, class = LvlWarp.txt `Id`), in its decoded `UnitAssign` form. */
  private warpTileAssignEvent(tile: InternalWarpTileRecord): ServerEvent {
    return {
      type: 'UnitAssign',
      areaId: tile.areaId,
      classId: tile.lvlWarpId,
      unit: {
        unitType: 5,
        id: tile.unitId,
        classId: tile.lvlWarpId,
        warpId: tile.lvlWarpId,
        x: tile.x,
        y: tile.y,
      },
    }
  }

  /**
   * 1.13c room AOI: each step reveals rooms near the player (MapAdd 0x07) and hides
   * rooms that fell out of range (MapRemove 0x08). Never reveals the whole level at once.
   */
  private revealAreaRoomsNearPlayer(
    player: InternalPlayerRecord,
    emitRoomUnits = false,
  ): void {
    const area = this.loadedAreas.get(player.areaId)
    if (!area) return
    const px = Math.floor(player.x / SUBTILES_PER_TILE)
    const py = Math.floor(player.y / SUBTILES_PER_TILE)
    for (const room of area.rooms) {
      const key = `${room.areaId}:${room.tileX}:${room.tileY}`
      const rect = area.roomRects?.find(
        (r) =>
          Math.floor(r.x / SUBTILES_PER_TILE) === room.tileX &&
          Math.floor(r.y / SUBTILES_PER_TILE) === room.tileY,
      )
      const tileW = rect
        ? Math.max(1, Math.round(rect.w / SUBTILES_PER_TILE))
        : ROOM_TILE_SPAN_113C
      const tileH = rect
        ? Math.max(1, Math.round(rect.h / SUBTILES_PER_TILE))
        : ROOM_TILE_SPAN_113C
      const dx = Math.max(
        room.tileX - px,
        0,
        px - (room.tileX + tileW - 1),
      )
      const dy = Math.max(
        room.tileY - py,
        0,
        py - (room.tileY + tileH - 1),
      )
      const dist = Math.max(dx, dy)
      if (player.revealedRoomKeys.has(key)) {
        if (dist > ROOM_HIDE_RADIUS_TILES) {
          player.revealedRoomKeys.delete(key)
          this.emitToPlayer(player.unitId, {
            type: 'RoomHide',
            areaId: room.areaId,
            tileX: room.tileX,
            tileY: room.tileY,
          })
        }
      } else if (dist <= ROOM_REVEAL_RADIUS_TILES) {
        player.revealedRoomKeys.add(key)
        this.emitToPlayer(player.unitId, {
          type: 'RoomReveal',
          areaId: room.areaId,
          tileX: room.tileX,
          tileY: room.tileY,
          ...(rect !== undefined
            ? {
                roomSeed: rect.seed,
                tileW,
                tileH,
              }
            : {}),
        })
        if (emitRoomUnits) {
          this.emitRoomUnitsToPlayer(
            player,
            room.areaId,
            room.tileX * SUBTILES_PER_TILE,
            room.tileY * SUBTILES_PER_TILE,
            tileW * SUBTILES_PER_TILE,
            tileH * SUBTILES_PER_TILE,
          )
        }
      }
    }
  }

  /**
   * Stream `UnitAssign` / `ItemEvent` for units inside a newly-revealed room rectangle
   * `[subX, subX + subW) × [subY, subY + subH)` (`S2C 0x07 MapAdd` room AOI streaming).
   */
  private emitRoomUnitsToPlayer(
    player: InternalPlayerRecord,
    areaId: number,
    subX: number,
    subY: number,
    subW: number,
    subH: number,
  ): void {
    const inRoom = (x: number, y: number): boolean =>
      x >= subX && x < subX + subW && y >= subY && y < subY + subH
    for (const m of this.monsters.values()) {
      if (m.areaId !== areaId || !inRoom(m.x, m.y)) continue
      this.emitToPlayer(player.unitId, {
        type: 'UnitAssign',
        unitType: 'monster',
        unitId: m.unitId,
        classId: m.classId,
        name: m.name,
        x: m.x,
        y: m.y,
        areaId: m.areaId,
        unit: {
          unitType: 1,
          id: m.unitId,
          classId: m.classId,
          name: m.name,
          x: m.x,
          y: m.y,
          mode: m.mode,
          lifePct: m.maxHp > 0 ? Math.round((m.hp / m.maxHp) * 128) : 0,
          ...(m.umodIds.length > 0 ? { bossMods: [...m.umodIds] } : {}),
        },
      })
    }
    for (const obj of this.objects.values()) {
      if (obj.areaId !== areaId || !inRoom(obj.x, obj.y)) continue
      this.emitToPlayer(player.unitId, {
        type: 'UnitAssign',
        unitType: 'object',
        unitId: obj.unitId,
        classId: obj.classId,
        x: obj.x,
        y: obj.y,
        areaId: obj.areaId,
        unit: {
          unitType: 2,
          id: obj.unitId,
          classId: obj.classId,
          x: obj.x,
          y: obj.y,
          mode: obj.mode,
        },
      })
      if (obj.destAreaId !== undefined) {
        this.emitToPlayer(player.unitId, {
          type: 'Portal',
          portalId: obj.unitId,
          ownerId: obj.portalOwnerId,
          areaId: obj.areaId,
          destAreaId: obj.destAreaId,
          localId: obj.unitId,
          remoteId: obj.unitId,
          flags: 1,
        })
      }
    }
    for (const gItem of this.groundItems.values()) {
      if (gItem.areaId !== areaId || !inRoom(gItem.x, gItem.y)) continue
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'groundSpawn',
        itemId: gItem.unitId,
        code: gItem.code,
        x: gItem.x,
        y: gItem.y,
        container: 'ground',
        item: this.serverEntryToItemData(gItem),
      })
    }
    for (const tile of this.warpTiles.values()) {
      if (tile.areaId !== areaId || !inRoom(tile.x, tile.y)) continue
      this.emitToPlayer(player.unitId, this.warpTileAssignEvent(tile))
    }
  }

  /** Hide every room of `areaId` this player currently sees (leaving the area). */
  private hidePlayerAreaRooms(player: InternalPlayerRecord, areaId: number): void {
    const prefix = `${areaId}:`
    for (const key of [...player.revealedRoomKeys]) {
      if (!key.startsWith(prefix)) continue
      player.revealedRoomKeys.delete(key)
      const [, tileX, tileY] = key.split(':')
      this.emitToPlayer(player.unitId, {
        type: 'RoomHide',
        areaId,
        tileX: Number(tileX),
        tileY: Number(tileY),
      })
    }
  }

  /**
   * Landing spot in `area` for `arrival`, grounded on standable floor (never the geometric centre or void):
   * - waypoint: the area's waypoint object;
   * - warp: the destination area's warp tile leading back to the area the player came from;
   * - town portal / respawn: the area's DRLG start (town entry).
   * `null` when the area has no such landmark or no standable floor next to it.
   */
  private resolveArrivalPosition(
    area: LoadedAreaRecord,
    arrival: AreaArrival,
  ): { readonly x: number; readonly y: number } | null {
    let anchor: { readonly x: number; readonly y: number } | null = null
    if (arrival.kind === 'waypoint') {
      for (const obj of this.objects.values()) {
        if (obj.areaId === area.areaId && obj.isWaypoint) {
          anchor = obj
          break
        }
      }
    } else if (arrival.kind === 'warp') {
      for (const tile of this.warpTiles.values()) {
        if (tile.areaId === area.areaId && tile.destAreaId === arrival.fromAreaId) {
          anchor = tile
          break
        }
      }
    } else if (arrival.kind === 'townPortal' && arrival.x !== undefined && arrival.y !== undefined) {
      anchor = { x: arrival.x, y: arrival.y }
    } else {
      anchor = { x: area.spawnX, y: area.spawnY }
    }
    if (anchor === null) return null
    const isWalkable = (x: number, y: number): boolean => area.isWalkable(area.areaId, x, y)
    const near = findStandableNear(isWalkable, anchor.x, anchor.y)
    if (near !== null) return near
    // Town-portal tile not on standable floor (level variant/synthetic map): use the town entry.
    if (anchor.x !== area.spawnX || anchor.y !== area.spawnY) {
      return findStandableNear(isWalkable, area.spawnX, area.spawnY)
    }
    return null
  }

  setTerrainWalkableCheck(
    fn: ((areaId: number, x: number, y: number, isFlying?: boolean) => boolean) | undefined,
  ): void {
    this.terrainWalkableCheck = fn
  }

  /**
   * #1327: supply the DRLG room rectangles (world sub-tiles + `room1InitSeed`) of a
   * level. Rooms are populated from `Levels.txt` the first time a player activates
   * them; without a provider (or without a walkability check) no random population
   * happens, because neither room bounds nor legal cells could be honoured.
   */
  setAreaRoomProvider(
    fn: ((areaId: number) => readonly PopulationRoomRect[] | null | undefined) | undefined,
  ): void {
    this.areaRoomProvider = fn
    this.areaPopulations.clear()
  }

  setWalkabilityCallback(
    fn:
      | ((x: number, y: number, isFlying?: boolean) => boolean)
      | ((areaId: number, x: number, y: number, isFlying?: boolean) => boolean)
      | undefined,
  ): void {
    if (!fn) {
      this.terrainWalkableCheck = undefined
      return
    }
    if (fn.length <= 2) {
      const cb = fn as (x: number, y: number) => boolean
      this.terrainWalkableCheck = (_areaId: number, x: number, y: number) => cb(x, y)
    } else {
      this.terrainWalkableCheck = fn as (
        areaId: number,
        x: number,
        y: number,
        isFlying?: boolean,
      ) => boolean
    }
  }

  movePlayer(playerUnitId: number, x: number, y: number): void {
    const p = this.players.get(playerUnitId)
    if (!p) return
    p.x = x
    p.y = y
    p.targetX = x
    p.targetY = y
  }

  private isMonsterStepWalkable(
    areaId: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    isFlying: boolean,
    ignoreObjectUnitId?: number,
  ): boolean {
    if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(toX) || !Number.isFinite(toY)) {
      return false
    }

    const check = this.terrainWalkableCheck
    const dist = Math.hypot(toX - fromX, toY - fromY)
    const steps = Math.max(4, Math.ceil(dist / 0.25))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const px = fromX + (toX - fromX) * t
      const py = fromY + (toY - fromY) * t
      const rx = Math.round(px)
      const ry = Math.round(py)
      const pArea = this.areaIdAtWorldPoint(Math.floor(px), Math.floor(py)) ?? areaId
      const rArea = this.areaIdAtWorldPoint(rx, ry) ?? areaId
      // Closed doors block every walker, including flying units.
      if (this.isClosedDoorAt(rArea, rx, ry, ignoreObjectUnitId)) return false
      if (!check) continue
      if (!check(pArea, px, py, isFlying) || !check(rArea, rx, ry, isFlying)) {
        return false
      }
    }
    return true
  }

  get frame(): number {
    return this.currentFrame
  }

  get tickCount(): number {
    return this.currentFrame
  }

  get mapSeed(): number {
    return this.currentMapSeed
  }

  get paused(): boolean {
    return this.pausedState
  }

  isPaused(): boolean {
    return this.pausedState
  }

  setPaused(paused: boolean): void {
    const canPause = Boolean(
      this.policy.allowPause ?? this.policy.pauseOnSinglePlayerEscape,
    )
    if (canPause) {
      this.pausedState = Boolean(paused)
    }
  }

  get playersX(): number {
    return Math.max(1, Math.min(8, Math.max(this.manualPlayersX, this.players.size)))
  }

  getPlayersX(): number {
    return this.playersX
  }

  get playerCount(): number {
    return this.players.size
  }

  setPlayersX(value: number): number {
    const clamped = Math.max(1, Math.min(8, Math.floor(Number(value) || 1)))
    this.manualPlayersX = clamped
    this.rescaleActiveMonsters()
    this.onPlayersXChange?.(this.playersX)
    return this.playersX
  }

  private allocateUnitId(): number {
    return this.nextUnitId++
  }

  private canPersistMapSeed(): boolean {
    return Boolean(
      this.policy.persistMapSeedAndFog ?? this.policy.persistMapSeedOnSave,
    )
  }

  private rescaleActiveMonsters(): void {
    const px = this.playersX
    const multNum = px + 1
    for (const m of this.monsters.values()) {
      if (m.isNpc || m.dead || m.noRatio) continue
      const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1
      m.maxHp = Math.max(1, Math.floor((m.baseMaxHp * multNum) / 2))
      m.hp = Math.max(1, Math.round(m.maxHp * ratio))
    }
  }

  connectPlayer(spec: ConnectPlayerSpec = {}): number {
    if (this.players.size >= this.policy.maxPlayers) {
      throw new Error(
        `GameInstance: room is full (${this.players.size}/${this.policy.maxPlayers} players)`,
      )
    }

    const d2sRaw = spec.d2s ?? spec.d2sBytes
    let parsedD2s: D2sDecodedCharacterSave | undefined
    if (d2sRaw instanceof Uint8Array) {
      parsedD2s = readD2sSave113c(d2sRaw)
      if (
        this.canPersistMapSeed() &&
        parsedD2s.mapSeed !== 0 &&
        !this.hasExplicitMapSeed
      ) {
        this.currentMapSeed = parsedD2s.mapSeed >>> 0
        this.rng = new D2Rng(this.currentMapSeed)
      }
    }

    const charName = (
      spec.charName ??
      spec.name ??
      parsedD2s?.name ??
      `Hero${this.nextUnitId}`
    ).trim()
    for (const existing of this.players.values()) {
      if (existing.name.toLowerCase() === charName.toLowerCase()) {
        throw new Error(`GameInstance: character "${charName}" is already in the game`)
      }
    }

    const classId =
      parsedD2s !== undefined
        ? normalizeClassId(parsedD2s.classId)
        : normalizeClassId(spec.classId ?? spec.charClass)
    const classCode = CLASS_ID_TO_CODE[classId] ?? 'ama'
    const baseStats = CANONICAL_CHARSTATS[classCode]
    const unitId = this.allocateUnitId()

    const level = Math.max(1, parsedD2s?.level ?? spec.level ?? 1)
    const areaId =
      spec.areaId ??
      this.defaultAreaId ??
      ACT_TOWN_AREA[parsedD2s?.activeAct ?? this.defaultAct ?? 0] ??
      1
    const act = areaToAct(areaId)
    // With an area bootstrap resolver the entry area comes online first and the player is grounded on
    // its start floor (`resolveArrivalPosition` → town entry); without one, the legacy test grid spawn.
    const entryArea = this.loadArea(areaId)
    let entrySpawn: { readonly x: number; readonly y: number } | null = null
    if (entryArea && (spec.x === undefined || spec.y === undefined)) {
      entrySpawn = this.resolveArrivalPosition(entryArea, { kind: 'townPortal' })
      if (entrySpawn === null) {
        throw new Error(`GameInstance.connectPlayer: area ${areaId} has no standable entry floor`)
      }
    }
    const spawnX = spec.x ?? entrySpawn?.x ?? 128 + (this.players.size % 4) * 2
    const spawnY = spec.y ?? entrySpawn?.y ?? 128 + Math.floor(this.players.size / 4) * 2

    const attrs = parsedD2s?.attributes
    const strength = attrs?.strength ?? baseStats.baseAttributes.strength
    const dexterity = attrs?.dexterity ?? baseStats.baseAttributes.dexterity
    const vitality = attrs?.vitality ?? baseStats.baseAttributes.vitality
    const energy = attrs?.energy ?? baseStats.baseAttributes.energy
    const statPts = attrs?.statPts ?? 0
    const newSkills = attrs?.newSkills ?? 0

    const maxHpFixed =
      spec.maxHp !== undefined && spec.maxHp > 0
        ? spec.maxHp * FIXED_ONE
        : attrs && attrs.maxHpFixed > 0
          ? attrs.maxHpFixed
          : baseStats.baseVitals.life * FIXED_ONE
    const hpFixed =
      spec.hp !== undefined && spec.hp > 0
        ? Math.min(maxHpFixed, spec.hp * FIXED_ONE)
        : attrs && attrs.hitpointsFixed > 0
          ? Math.min(maxHpFixed, attrs.hitpointsFixed)
          : maxHpFixed
    const maxManaFixed =
      attrs && attrs.maxManaFixed > 0
        ? attrs.maxManaFixed
        : baseStats.baseVitals.mana * FIXED_ONE
    const manaFixed =
      attrs !== undefined
        ? Math.min(maxManaFixed, attrs.manaFixed)
        : maxManaFixed
    const maxStaminaFixed =
      attrs && attrs.maxStaminaFixed > 0
        ? attrs.maxStaminaFixed
        : baseStats.baseVitals.stamina * FIXED_ONE
    const staminaFixed =
      attrs && attrs.staminaFixed > 0
        ? Math.min(maxStaminaFixed, attrs.staminaFixed)
        : maxStaminaFixed

    const maxHp = Math.max(1, Math.floor(maxHpFixed / FIXED_ONE))
    const hp = Math.max(1, Math.min(maxHp, Math.floor(hpFixed / FIXED_ONE)))
    const maxMana = Math.max(0, Math.floor(maxManaFixed / FIXED_ONE))
    const mana = Math.max(0, Math.min(maxMana, Math.floor(manaFixed / FIXED_ONE)))
    const maxStamina = Math.max(1, Math.floor(maxStaminaFixed / FIXED_ONE))
    const stamina = Math.max(
      1,
      Math.min(maxStamina, Math.floor(staminaFixed / FIXED_ONE)),
    )

    const experience =
      attrs?.experience ?? experienceForLevel113c(level)
    const gold = attrs?.gold ?? 0
    const goldBank = attrs?.goldBank ?? 0

    const skills = new Map<number, number>()
    const skillOffset = CLASS_SKILL_OFFSET[classId] ?? 6
    if (parsedD2s?.skills) {
      for (let i = 0; i < parsedD2s.skills.length; i++) {
        const slvl = parsedD2s.skills[i] ?? 0
        if (slvl > 0) {
          skills.set(skillOffset + i, slvl)
        }
      }
    }
    if (spec.skills !== undefined) {
      for (const [rawId, rawLvl] of Object.entries(spec.skills)) {
        const id = Number(rawId)
        if (!Number.isInteger(id) || this.registry.getSkillById(id) === undefined) {
          throw new Error(`GameInstance.connectPlayer: unknown Skills.txt row ${rawId} in spec.skills`)
        }
        if (rawLvl > 0) skills.set(id, Math.trunc(rawLvl))
        else skills.delete(id)
      }
    }

    const items: ServerItemEntry[] = []
    if (parsedD2s) {
      for (const itemData of parsedD2s.items) {
        items.push(this.itemDataToServerEntry(itemData, unitId, areaId))
      }
    } else {
      const potInfo = lookupBaseInfo('hpot')
      for (let i = 0; i < 4; i++) {
        items.push({
          unitId: this.allocateUnitId(),
          code: 'hpot',
          name: potInfo.name,
          quality: 2,
          level: 1,
          location: 'belt',
          x: i,
          y: 0,
          width: 1,
          height: 1,
          areaId,
          ownerId: unitId,
          bodyLoc: 0,
          storePage: 0,
          cost: potInfo.cost,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        })
      }
    }

    const corpseItems: ServerItemEntry[] = []
    if (parsedD2s?.corpseItems) {
      for (const ci of parsedD2s.corpseItems) {
        corpseItems.push(this.itemDataToServerEntry(ci, unitId, areaId))
      }
    }
    const ironGolemItem = parsedD2s?.ironGolem
      ? this.itemDataToServerEntry(parsedD2s.ironGolem, unitId, areaId)
      : null

    const waypoints = new Set<number>([1])
    let hasExplicitWaypoints = false
    const wpBytes = parsedD2s?.waypoints?.[this.difficulty]
    if (wpBytes instanceof Uint8Array && wpBytes.byteLength >= 7) {
      hasExplicitWaypoints = true
      for (let bitIndex = 0; bitIndex < WAYPOINT_AREA_IDS.length; bitIndex++) {
        const byteIdx = 2 + (bitIndex >> 3)
        const bitMask = 1 << (bitIndex & 7)
        if (((wpBytes[byteIdx] ?? 0) & bitMask) !== 0) {
          waypoints.add(WAYPOINT_AREA_IDS[bitIndex]!)
        }
      }
    }

    const unlockedAct = [...waypoints].reduce(
      (maxAct, wpArea) => Math.max(maxAct, areaToAct(wpArea)),
      areaToAct(areaId),
    )
    const questFlags = parsedD2s?.quests?.[this.difficulty]
      ? new Uint16Array(parsedD2s.quests[this.difficulty])
      : new Uint16Array(48)

    const record: InternalPlayerRecord = {
      unitId,
      name: charName,
      classId,
      classCode,
      level,
      act,
      areaId,
      x: spawnX,
      y: spawnY,
      targetX: spawnX,
      targetY: spawnY,
      run: true,
      mode: TOWN_AREAS.has(areaId) ? 5 : 1,
      hp,
      maxHp,
      hpFixed,
      maxHpFixed,
      mana,
      maxMana,
      manaFixed,
      maxManaFixed,
      stamina,
      maxStamina,
      staminaFixed,
      maxStaminaFixed,
      staminaExhausted: false,
      experience,
      gold,
      goldBank,
      strength,
      dexterity,
      vitality,
      energy,
      statPts,
      newSkills,
      leftSkill: parsedD2s?.leftSkill ?? 0,
      rightSkill: parsedD2s?.rightSkill ?? 0,
      skills,
      states: new Set(),
      stateTimers: new Map(),
      items,
      corpseItems,
      ironGolemItem,
      waypoints,
      hasExplicitWaypoints,
      activeWaypointUnitId: 0,
      unlockedAct,
      lastWarpInteractFrame: -1000,
      revealedRoomKeys: new Set(),
      questFlags,
      vendorPools: new Map(),
      vendorPoolModes: new Map(),
      vendorPoolsByMode: new Map(),
      activeVendorMode: null,
      dead: false,
      corpseId: undefined,
      corpseX: spawnX,
      corpseY: spawnY,
      activeNpcId: undefined,
      partyId: 0xffff,
      d2sTemplate: parsedD2s,
    }

    this.players.set(unitId, record)
    this.outbox.set(unitId, [])
    this.rescaleActiveMonsters()

    this.emitToPlayer(unitId, {
      type: 'GameLogonAck',
      playerUnitId: unitId,
      mapSeed: this.currentMapSeed,
      difficulty: this.difficulty,
      act,
      areaId,
    })
    this.emitQuestLog(record)
    this.emitQuestAvailability(record)
    this.emitToPlayer(unitId, {
      type: 'LoadAct',
      act,
      mapSeed: this.currentMapSeed,
      areaId,
    })
    this.revealAreaRoomsNearPlayer(record)
    this.emitToPlayer(unitId, {
      type: 'PlayerAssign',
      unitId,
      classId,
      charClass: classId,
      charName,
      name: charName,
      x: spawnX,
      y: spawnY,
      areaId,
    })
    this.emitToPlayer(unitId, {
      type: 'UnitAssign',
      isSelf: true,
      unitType: 'player',
      unitId,
      classId,
      name: charName,
      x: spawnX,
      y: spawnY,
      areaId,
      unit: {
        unitType: 0,
        id: unitId,
        classId,
        name: charName,
        x: spawnX,
        y: spawnY,
        mode: record.mode,
      },
    })
    this.emitInitialPlayerStats(record)

    for (const other of this.players.values()) {
      if (other.unitId === unitId) continue
      this.emitToPlayer(other.unitId, {
        type: 'Party',
        kind: 'roster',
        action: 'join',
        playerId: unitId,
        charClass: classId,
        charName,
        charLevel: level,
        partyId: 0xffff,
        areaId,
      })
      this.emitToPlayer(unitId, {
        type: 'Party',
        kind: 'roster',
        action: 'join',
        playerId: other.unitId,
        charClass: other.classId,
        charName: other.name,
        charLevel: other.level,
        partyId: other.partyId,
        areaId: other.areaId,
      })
      if (other.areaId === areaId) {
        this.emitToPlayer(other.unitId, {
          type: 'UnitAssign',
          unitType: 'player',
          unitId,
          classId,
          name: charName,
          x: spawnX,
          y: spawnY,
          areaId,
          unit: {
            unitType: 0,
            id: unitId,
            classId,
            name: charName,
            x: spawnX,
            y: spawnY,
            mode: record.mode,
          },
        })
        this.emitToPlayer(unitId, {
          type: 'UnitAssign',
          unitType: 'player',
          unitId: other.unitId,
          classId: other.classId,
          name: other.name,
          x: other.x,
          y: other.y,
          areaId: other.areaId,
          unit: {
            unitType: 0,
            id: other.unitId,
            classId: other.classId,
            name: other.name,
            x: other.x,
            y: other.y,
            mode: other.mode,
          },
        })
      }
    }

    this.emitAreaSnapshotToPlayer(record)
    if (spec.restoreMercenary && parsedD2s?.merc && parsedD2s.merc.seed !== 0 && parsedD2s.merc.typeId > 0) {
      const hireRec =
        HIRELING_RECORDS.find((entry) => entry.subTypeId === parsedD2s.merc.typeId) ??
        HIRELING_RECORDS.find((entry) => entry.id === parsedD2s.merc.typeId)
      if (hireRec) {
        const mercId = this.hireMercenary(unitId, {
          act: (hireRec.act === 1 || hireRec.act === 2 || hireRec.act === 3 || hireRec.act === 5
            ? hireRec.act
            : 2) as 1 | 2 | 3 | 5,
          subType: hireRec.subTypeId,
          level: record.level,
          difficulty: ((hireRec.difficulty ?? (this.difficulty + 1)) === 3
            ? 3
            : (hireRec.difficulty ?? (this.difficulty + 1)) === 2
              ? 2
              : 1) as 1 | 2 | 3,
          dead: parsedD2s.merc.dead,
        })
        const mercRecord = mercId !== null ? this.mercenaries.get(mercId) : undefined
        if (mercRecord && Array.isArray(parsedD2s.mercItems) && parsedD2s.mercItems.length > 0) {
          for (const mi of parsedD2s.mercItems) {
            mercRecord.equipment.push(this.itemDataToServerEntry(mi, mercRecord.unitId, areaId))
          }
        }
      }
    }
    return unitId
  }

  addPlayer(spec: ConnectPlayerSpec = {}): number {
    return this.connectPlayer(spec)
  }

  disconnectPlayer(playerUnitId: number): Uint8Array | null {
    const existing = this.players.get(playerUnitId)
    if (!existing) return null
    const savedD2s = this.exportPlayerD2s(playerUnitId)
    const prevArea = existing.areaId
    this.players.delete(playerUnitId)
    this.clearVendorPools(existing, prevArea)
    this.playerSkillReadyFrame.delete(playerUnitId)
    this.playerActiveAuraState.delete(playerUnitId)
    this.playerCombat.delete(playerUnitId)
    this.playerAuraScanners.delete(playerUnitId)
    this.playerMotion.delete(playerUnitId)
    this.outbox.delete(playerUnitId)
    this.rescaleActiveMonsters()

    for (const other of this.players.values()) {
      this.emitToPlayer(other.unitId, {
        type: 'UnitRemove',
        unitType: 0,
        id: playerUnitId,
        unitId: playerUnitId,
      })
      this.emitToPlayer(other.unitId, {
        type: 'Party',
        kind: 'roster',
        action: 'leave',
        playerId: playerUnitId,
      })
    }
    return savedD2s
  }

  removePlayer(playerUnitId: number): Uint8Array | null {
    return this.disconnectPlayer(playerUnitId)
  }

  private itemDataToServerEntry(
    itemData: ItemData,
    ownerId: number,
    areaId: number,
  ): ServerItemEntry {
    const info = lookupBaseInfo(itemData.code)
    const locNum = itemData.location
    let location: ServerItemEntry['location'] = 'inventory'
    if (locNum === 1) location = 'equipped'
    else if (locNum === 2) location = 'belt'
    else if (locNum === 4) location = 'cursor'
    else if (locNum === 6) location = 'socket'
    else if (itemData.storePage === 4 || itemData.storePage === 5) location = 'stash'
    else if (itemData.storePage === 3) location = 'cube'

    const stats = new Map<number, number>()
    for (const st of itemData.stats ?? []) {
      stats.set(st.statId, st.value)
    }

    const rawId = Number(itemData.id ?? 0)
    const unitId = rawId > 0 ? rawId : this.allocateUnitId()
    if (unitId >= this.nextUnitId) {
      this.nextUnitId = unitId + 1
    }

    return {
      unitId,
      code: itemData.code.trim(),
      name: info.name,
      quality: itemData.quality ?? 2,
      level: itemData.ilvl ?? 1,
      location,
      x: itemData.x ?? 0,
      y: itemData.y ?? 0,
      width: info.width,
      height: info.height,
      areaId,
      ownerId,
      bodyLoc: itemData.bodyLoc ?? 0,
      storePage: itemData.storePage ?? 1,
      cost: info.cost,
      gamble: false,
      identified: itemData.identified ?? true,
      ethereal: itemData.ethereal ?? false,
      socketed: itemData.socketed ?? false,
      totalSockets: itemData.totalSockets ?? 0,
      durability: itemData.durability ?? info.maxDurability,
      maxDurability: itemData.maxDurability ?? info.maxDurability,
      quantity: itemData.quantity ?? 1,
      stats,
      socketedItems: (itemData.socketedItems ?? []).map((child) =>
        this.itemDataToServerEntry(child, ownerId, areaId),
      ),
      rawItemData: itemData,
    }
  }

  private serverEntryToItemData(entry: ServerItemEntry): ItemData {
    let location = 0
    let storePage = entry.storePage
    if (entry.location === 'equipped') {
      location = 1
      storePage = 0
    } else if (entry.location === 'belt') {
      location = 2
      storePage = 0
    } else if (entry.location === 'cursor') {
      location = 4
      storePage = 0
    } else if (entry.location === 'socket') {
      location = 6
      storePage = 0
    } else if (entry.location === 'stash') {
      location = 0
      storePage = 4
    } else if (entry.location === 'cube') {
      location = 0
      storePage = 3
    } else if (entry.location === 'vendor') {
      // Store items carry their store tab (1..4: armor, weapons1, weapons2, misc) as the bitstream page.
      location = 0
      storePage = entry.storePage
    } else {
      location = 0
      storePage = 1
    }

    const baseRaw = entry.rawItemData
    const hasCustomStats = entry.stats.size > 0
    // Keep the packet stat list (with params) when the gameplay map is just its statId -> value fold.
    const statsList =
      baseRaw?.stats &&
      baseRaw.stats.length > 0 &&
      (!hasCustomStats || statsMapMatchesItemStats(entry.stats, baseRaw.stats))
        ? baseRaw.stats
        : Array.from(entry.stats.entries()).map(([statId, value]) => ({
            statId,
            param: 0,
            value,
          }))

    const codePadded = entry.code.padEnd(4, ' ').slice(0, 4)
    const isSimple =
      baseRaw?.simple ??
      (statsList.length === 0 &&
        entry.socketedItems.length === 0 &&
        entry.quality === 2)

    return {
      ...(baseRaw ?? {}),
      id: entry.unitId as UnitId,
      itemId: entry.unitId as UnitId,
      opcode: baseRaw?.opcode ?? 0x9c,
      action: baseRaw?.action ?? 0,
      category: baseRaw?.category ?? 0,
      ownerType: baseRaw?.ownerType ?? 0,
      ownerId: entry.ownerId as UnitId,
      flags: baseRaw?.flags ?? 0x00000010,
      rawFlags: baseRaw?.rawFlags ?? 0x00000010,
      version: baseRaw?.version ?? 101,
      location,
      container: toItemContainer(entry.location),
      bodyLoc: entry.bodyLoc,
      equippedSlot: entry.bodyLoc,
      gridX: entry.x,
      gridY: entry.y,
      storePage,
      storagePage: storePage,
      worldX: entry.x,
      worldY: entry.y,
      x: entry.x,
      y: entry.y,
      code: entry.code.trim(),
      rawCode: codePadded,
      compact: baseRaw?.compact ?? isSimple,
      simple: isSimple,
      identified: entry.identified,
      socketed: entry.socketed || entry.socketedItems.length > 0,
      ethereal: entry.ethereal,
      runeword: baseRaw?.runeword ?? false,
      personalized: baseRaw?.personalized ?? false,
      isEar: baseRaw?.isEar ?? false,
      newItem: baseRaw?.newItem ?? false,
      starterItem: baseRaw?.starterItem ?? false,
      broken: baseRaw?.broken ?? false,
      inSocket: entry.location === 'socket',
      equipped: entry.location === 'equipped',
      socketedChildCount: entry.socketedItems.length,
      usedSockets: entry.socketedItems.length,
      totalSockets: Math.max(entry.totalSockets, entry.socketedItems.length),
      ilvl: entry.level,
      quality: this.normalizeItemQualityCode113c(baseRaw?.quality ?? entry.quality) as ItemQuality,
      graphicIndex: baseRaw?.graphicIndex ?? 0,
      durability: entry.durability,
      curDurability: entry.durability,
      maxDurability: entry.maxDurability,
      quantity: entry.quantity,
      invWidth: entry.width,
      invHeight: entry.height,
      stats: statsList,
      setBonusStats: baseRaw?.setBonusStats ?? [],
      runewordStats: baseRaw?.runewordStats ?? [],
      ...(entry.socketedItems.length > 0
        ? {
            socketedItems: entry.socketedItems.map((c) =>
              this.serverEntryToItemData(c),
            ),
          }
        : {}),
    }
  }

  private emitInitialPlayerStats(player: InternalPlayerRecord): void {
    const statPairs: ReadonlyArray<readonly [number, number]> = [
      [0, player.strength],
      [1, player.energy],
      [2, player.dexterity],
      [3, player.vitality],
      [4, player.statPts],
      [5, player.newSkills],
      [6, player.hpFixed],
      [7, player.maxHpFixed],
      [8, player.manaFixed],
      [9, player.maxManaFixed],
      [10, player.staminaFixed],
      [11, player.maxStaminaFixed],
      [12, player.level],
      [13, player.experience],
      [14, player.gold],
      [15, player.goldBank],
    ]
    for (const [statId, value] of statPairs) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId,
        value,
      })
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        stat: statId,
        value,
      })
    }
    this.emitToPlayer(player.unitId, {
      type: 'LifeMana',
      life: player.hp,
      mana: player.mana,
      stamina: player.stamina,
      at: playerWirePosition(player),
      vx: 0,
      vy: 0,
    })

    for (const [skillId, slvl] of player.skills.entries()) {
      this.emitToPlayer(player.unitId, {
        type: 'SkillUpdate',
        unitId: player.unitId,
        skillId,
        level: slvl,
      })
    }

    for (const item of player.items) {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'add',
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: toItemContainer(item.location),
        item: this.serverEntryToItemData(item),
      })
    }
  }

  private emitAreaSnapshotToPlayer(player: InternalPlayerRecord): void {
    for (const m of this.monsters.values()) {
      if (m.areaId !== player.areaId) continue
      this.emitToPlayer(player.unitId, {
        type: 'UnitAssign',
        unitType: 'monster',
        unitId: m.unitId,
        classId: m.classId,
        name: m.name,
        x: m.x,
        y: m.y,
        areaId: m.areaId,
        unit: {
          unitType: 1,
          id: m.unitId,
          classId: m.classId,
          name: m.name,
          x: m.x,
          y: m.y,
          mode: m.mode,
          lifePct: m.maxHp > 0 ? Math.round((m.hp / m.maxHp) * 128) : 0,
          ...(m.umodIds.length > 0 ? { bossMods: [...m.umodIds] } : {}),
        },
      })
    }
    for (const obj of this.objects.values()) {
      if (obj.areaId !== player.areaId) continue
      this.emitToPlayer(player.unitId, {
        type: 'UnitAssign',
        unitType: 'object',
        unitId: obj.unitId,
        classId: obj.classId,
        x: obj.x,
        y: obj.y,
        areaId: obj.areaId,
        unit: {
          unitType: 2,
          id: obj.unitId,
          classId: obj.classId,
          x: obj.x,
          y: obj.y,
          mode: obj.mode,
        },
      })
      if (obj.destAreaId !== undefined) {
        this.emitToPlayer(player.unitId, {
          type: 'Portal',
          portalId: obj.unitId,
          ownerId: obj.portalOwnerId,
          areaId: obj.areaId,
          destAreaId: obj.destAreaId,
          localId: obj.unitId,
          remoteId: obj.unitId,
          flags: 1,
        })
      }
    }
    for (const gItem of this.groundItems.values()) {
      if (gItem.areaId !== player.areaId) continue
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'groundSpawn',
        itemId: gItem.unitId,
        code: gItem.code,
        x: gItem.x,
        y: gItem.y,
        container: 'ground',
        item: this.serverEntryToItemData(gItem),
      })
    }
    for (const tile of this.warpTiles.values()) {
      if (tile.areaId !== player.areaId) continue
      this.emitToPlayer(player.unitId, this.warpTileAssignEvent(tile))
    }
  }

  /**
   * Server entry for an item made by a canonical 1.13c generator (TreasureClassEx drop pipeline, store or
   * gamble generator). The full `ItemData` (affix / unique / set / rare ids, stat list with params, rolled
   * defense, durability, quantity) is kept as `rawItemData`; `stats` is its statId -> value fold for gameplay.
   */
  private createServerEntryFromItem(
    item: Item,
    placement: {
      readonly location: ServerItemEntry['location']
      readonly x: number
      readonly y: number
      readonly areaId: number
      readonly ownerId: number
      readonly storePage: number
      readonly gamble: boolean
    },
  ): ServerItemEntry {
    const unitId = this.allocateUnitId()
    const code = (item.code ?? item.base.id).trim()
    const info = requireBaseInfo(code)
    const data = domainItemToItemData113c(item, getEmbeddedDropTables(), {
      unitId,
      compactSave: info.compactSave,
    })
    const stats = new Map<number, number>()
    for (const st of data.stats) stats.set(st.statId, st.value)
    return {
      unitId,
      code,
      name: item.name,
      quality: data.quality ?? 2,
      level: data.ilvl ?? item.level,
      location: placement.location,
      x: placement.x,
      y: placement.y,
      width: info.width,
      height: info.height,
      areaId: placement.areaId,
      ownerId: placement.ownerId,
      bodyLoc: 0,
      storePage: placement.storePage,
      cost: info.cost,
      gamble: placement.gamble,
      identified: data.identified,
      ethereal: data.ethereal,
      socketed: data.socketed,
      totalSockets: data.totalSockets,
      durability: data.durability ?? 0,
      maxDurability: data.maxDurability ?? 0,
      quantity: data.quantity ?? 1,
      stats,
      socketedItems: [],
      permStore: Boolean(
        (item as { permStore?: boolean }).permStore ??
          (item.base as { permStoreItem?: boolean }).permStoreItem,
      ),
      rawItemData: data,
    }
  }

  /** 1.13c #10107 pricing input from a server item entry (raw packet data when present). */
  private transactionInputFromEntry(entry: ServerItemEntry): TransactionCostInput {
    const item = entry.rawItemData
    if (!item) {
      const stats: TransactionCostStat[] = [
        { statId: 70, param: 0, value: Math.max(1, entry.quantity), base: Math.max(1, entry.quantity) },
        { statId: 72, param: 0, value: entry.durability, base: entry.durability },
        { statId: 73, param: 0, value: entry.maxDurability, base: entry.maxDurability },
      ]
      for (const [statId, value] of entry.stats) {
        if (statId === 70 || statId === 72 || statId === 73) continue
        stats.push({ statId, param: 0, value, base: 0 })
      }
      const lowerCode = entry.code.trim().toLowerCase()
      const bookId = lowerCode === 'tbk' ? 0 : lowerCode === 'ibk' ? 1 : undefined
      const quality = Math.min(
        9,
        Math.max(1, this.normalizeItemQualityCode113c(entry.quality)),
      ) as TransactionCostInput['quality']
      return {
        code: entry.code.trim(),
        itemFormat: 1,
        quality,
        identified: entry.identified || quality < 4,
        ethereal: entry.ethereal,
        starterItem: false,
        isEar: false,
        ...(bookId !== undefined ? { bookId } : {}),
        magicPrefixId: 0,
        magicSuffixId: 0,
        uniqueItemId: -1,
        setItemId: -1,
        rarePrefixIds: [0, 0, 0],
        rareSuffixIds: [0, 0, 0],
        stats,
        socketedChildCodes: entry.socketedItems
          .map((socketed) => (socketed.rawItemData?.code ?? socketed.code).trim())
          .filter((c) => c.length > 0),
      }
    }
    const acc = new Map<string, { statId: number; param: number; value: number; base: number }>()
    const add = (statId: number, param: number, value: number, isBase: boolean): void => {
      const k = `${statId}:${param}`
      const cur = acc.get(k) ?? { statId, param, value: 0, base: 0 }
      cur.value += value
      if (isBase) cur.base += value
      acc.set(k, cur)
    }
    const maxDur = entry.maxDurability > 0 ? entry.maxDurability : item.maxDurability
    const curDur =
      entry.maxDurability > 0 || item.curDurability !== undefined || item.durability !== undefined
        ? entry.durability
        : undefined
    const qty = entry.quantity > 1 || item.quantity !== undefined ? entry.quantity : undefined
    if (item.defense !== undefined) add(31, 0, item.defense, true)
    if (maxDur !== undefined) add(73, 0, maxDur, true)
    if (curDur !== undefined) add(72, 0, curDur, true)
    if (qty !== undefined) add(70, 0, qty, true)
    for (const s of item.stats) {
      if (s.statId === 72 && curDur !== undefined) continue
      if (s.statId === 73 && maxDur !== undefined) continue
      if (s.statId === 70 && qty !== undefined) continue
      add(s.statId, s.param, s.value, false)
    }
    for (const s of item.runewordStats ?? []) add(s.statId, s.param, s.value, false)
    const chargedSkills = (item as {
      readonly chargedSkills?: readonly {
        readonly skillId?: number
        readonly level?: number
        readonly charges?: number
        readonly maxCharges?: number
      }[]
    }).chargedSkills
    if (Array.isArray(chargedSkills)) {
      for (const cs of chargedSkills) {
        const maxCharges = (cs.maxCharges ?? 0) & 0xff
        const charges = Math.min(maxCharges, Math.max(0, cs.charges ?? 0)) & 0xff
        const skillId = cs.skillId ?? 54
        const level = Math.max(1, cs.level ?? 1) & 0x3f
        const param = (skillId << 6) | level
        if (maxCharges > 0 && !acc.has(`204:${param}`)) {
          add(204, param, (maxCharges << 8) | charges, false)
        }
      }
    }
    const ra = item.rareAffixes
    const rarePrefixIds: readonly [number, number, number] =
      ra !== undefined && ra.length >= 6 ? [ra[0] ?? 0, ra[2] ?? 0, ra[4] ?? 0] : [0, 0, 0]
    const rareSuffixIds: readonly [number, number, number] =
      ra !== undefined && ra.length >= 6 ? [ra[1] ?? 0, ra[3] ?? 0, ra[5] ?? 0] : [0, 0, 0]
    let bookId = item.tomeData
    const code = (item.code ?? entry.code ?? '').trim().toLowerCase()
    if (bookId === undefined && code === 'tbk') bookId = 0
    if (bookId === undefined && code === 'ibk') bookId = 1
    const quality = this.normalizeItemQualityCode113c(
      item.quality ?? entry.quality,
    ) as TransactionCostInput['quality']
    return {
      code: (item.code ?? entry.code).trim(),
      itemFormat: item.version,
      quality,
      identified: entry.identified || (quality < 4 && item.identified !== false),
      ethereal: entry.ethereal || item.ethereal,
      starterItem: item.starterItem,
      isEar: item.isEar,
      earLevel: item.earLevel ?? 0,
      bodyPartMonsterClass: item.bodyPartMonsterClass ?? 0,
      ...(bookId !== undefined ? { bookId } : {}),
      magicPrefixId: item.magicPrefixId ?? 0,
      magicSuffixId: item.magicSuffixId ?? 0,
      ...(item.autoAffixId !== undefined ? { autoAffixId: item.autoAffixId } : {}),
      uniqueItemId:
        item.uniqueItemId !== undefined && item.uniqueItemId !== 0xfff ? item.uniqueItemId : -1,
      setItemId: item.setItemId !== undefined && item.setItemId !== 0xfff ? item.setItemId : -1,
      rarePrefixIds,
      rareSuffixIds,
      stats: [...acc.values()],
      socketedChildCodes: entry.socketedItems
        .map((socketed) => (socketed.rawItemData?.code ?? socketed.code).trim())
        .filter((c) => c.length > 0),
    }
  }

  private transactionCostContext(
    player: InternalPlayerRecord,
    npcClass: number,
  ): TransactionCostContext {
    const itemReduced = (entry: ServerItemEntry): number => {
      let sum = entry.stats.get(87) ?? 0
      if (sum === 0 && entry.rawItemData?.stats) {
        for (const s of entry.rawItemData.stats) {
          if (s.statId === 87) sum += s.value
        }
      }
      if (entry.rawItemData?.runewordStats) {
        for (const s of entry.rawItemData.runewordStats) {
          if (s.statId === 87) sum += s.value
        }
      }
      return sum
    }
    let reduced = 0
    const equipped = player.items.filter((item) => item.location === 'equipped')
    // Client parity: price reductions come from the active weapon set only.
    // BodyLoc 4/5 is the primary set, 11/12 the swap set; if both exist the
    // primary set is active (the runtime has no explicit swap state yet).
    const hasPrimary = equipped.some((item) => item.bodyLoc === 4 || item.bodyLoc === 5)
    for (const item of equipped) {
      if (hasPrimary && (item.bodyLoc === 11 || item.bodyLoc === 12)) continue
      if (!hasPrimary && (item.bodyLoc === 4 || item.bodyLoc === 5)) continue
      reduced += itemReduced(item)
      for (const socketed of item.socketedItems) reduced += itemReduced(socketed)
    }
    // D2Common.dll 0x6FD9B940 & client `transactionCostContextFromWorld`:
    // carried identified charms (cm1/cm2/cm3) within reqLvl, with unique charms
    // (quality === 7, uniqueId !== 0xfff) deduplicated by UniqueItems.txt id.
    const seenCharmIds = new Set<number>()
    for (const item of player.items) {
      if (item.location !== 'inventory') continue
      if (!item.identified || item.rawItemData?.identified === false) continue
      const code = item.code.trim().toLowerCase()
      if (code !== 'cm1' && code !== 'cm2' && code !== 'cm3') continue
      if (item.rawItemData && player.level > 0) {
        const reqLvl = resolveOnlineItemReqLevel(item.rawItemData)
        if (reqLvl > 0 && player.level < reqLvl) continue
      }
      const quality = item.rawItemData?.quality ?? item.quality
      const uniqueId = item.rawItemData?.uniqueItemId
      if (quality === 7 && uniqueId !== undefined && uniqueId >= 0 && uniqueId !== 0xfff) {
        if (seenCharmIds.has(uniqueId)) continue
        seenCharmIds.add(uniqueId)
      }
      reduced += itemReduced(item)
      for (const socketed of item.socketedItems) reduced += itemReduced(socketed)
    }
    return {
      playerLevel: player.level,
      playerReducedPricesPct: reduced,
      difficulty: this.difficulty as 0 | 1 | 2,
      npcClass,
      isQuestFlagSet: (questId, state) =>
        ((player.questFlags[questId] ?? 0) >> state) & 1 ? true : false,
      tables: getCanonicalTransactionCostTables(),
    }
  }

  /** D2Common #10107 server-side price: 0 buy, 1 sell, 2 gamble, 3 repair. */
  private serverItemPrice113c(
    player: InternalPlayerRecord,
    npcClass: number,
    entry: ServerItemEntry,
    type: 0 | 1 | 2 | 3,
  ): number {
    if (!entry.rawItemData && (type === 0 || type === 1)) {
      if (type === 1) {
        const rawSell = Math.max(1, Math.floor(entry.cost / 4))
        const cap = getCanonicalTransactionCostTables().npcs.get(npcClass)?.maxBuy[this.difficulty]
        return cap !== undefined && cap > 0 ? Math.min(rawSell, cap) : rawSell
      }
      return Math.max(0, entry.cost)
    }
    try {
      const cost = computeTransactionCost113c(
        this.transactionInputFromEntry(entry),
        this.transactionCostContext(player, npcClass),
        type,
      )
      return type === 3 ? Math.max(0, cost) : Math.max(1, cost)
    } catch {
      return Math.max(1, entry.cost)
    }
  }

  /** The player's copy of a bought store item: same rolled `ItemData`, new unit id, placed in the inventory. */
  private cloneVendorEntryForPlayer(
    vItem: ServerItemEntry,
    player: InternalPlayerRecord,
    cell: { readonly x: number; readonly y: number },
    location: 'inventory' | 'belt' = 'inventory',
  ): ServerItemEntry {
    const unitId = this.allocateUnitId()
    const raw = vItem.rawItemData
    return {
      ...vItem,
      unitId,
      location,
      x: cell.x,
      y: cell.y,
      areaId: player.areaId,
      ownerId: player.unitId,
      storePage: 1,
      stats: new Map(vItem.stats),
      socketedItems: [],
      rawItemData: raw ? { ...raw, id: unitId, itemId: unitId } : undefined,
    }
  }

  /**
   * 1.13c store (`D2GAME_NPC_FillStoreInventory_6FCC7100`) or gamble (`D2GAME_NPC_FillGamble_6FCC73E0`)
   * inventory of a town vendor for `player`, from the Armor/Weapons/Misc.txt `<Npc>Min/Max/MagicMin/
   * MagicMax/MagicLvl` columns of the NPC's vendor (`src/common/items/vendor-generator.ts`). Store items
   * keep their tab (1..4) and grid cell; NPCs without that Npc service sell nothing.
   */
  private createVendorStorePool(
    npc: InternalMonsterRecord,
    player: InternalPlayerRecord,
    gamble: boolean,
  ): ServerItemEntry[] {
    const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
    if (!descriptor || descriptor.vendorId === null) return []
    if (gamble ? !descriptor.canGamble : !descriptor.canTrade) return []
    const tables = getEmbeddedDropTables()
    const rng = new D2Rng(this.rng.rand(0x7fffffff) || 1)
    const pool: ServerItemEntry[] = []
    if (gamble) {
      const grid = generateGambleInventory({ vendorId: descriptor.vendorId, cLvl: player.level, tables, rng })
      for (const placed of grid.items) {
        const entry = this.createServerEntryFromItem(placed.item, {
          location: 'vendor',
          x: placed.x,
          y: placed.y,
          areaId: npc.areaId,
          ownerId: npc.unitId,
          storePage: 1,
          gamble: true,
        })
        this.gambleSourceItems.set(entry.unitId, placed.item)
        entry.cost = this.serverItemPrice113c(player, npc.hcIdx, entry, 2)
        pool.push(entry)
      }
      return pool
    }
    const store = generateVendorStoreInventory({
      vendorId: descriptor.vendorId,
      difficulty: this.difficulty,
      cLvl: player.level,
      actIndex: descriptor.actIndex,
      tables,
      rng,
    })
    VENDOR_TAB_KEYS.forEach((tab, tabIndex) => {
      for (const placed of store.tabs[tab].items) {
        const entry = this.createServerEntryFromItem(placed.item, {
          location: 'vendor',
          x: placed.x,
          y: placed.y,
          areaId: npc.areaId,
          ownerId: npc.unitId,
          storePage: tabIndex + 1,
          gamble: false,
        })
        entry.cost = this.serverItemPrice113c(player, npc.hcIdx, entry, 0)
        pool.push(entry)
      }
    })
    return pool
  }

  /**
   * Spawns the items of one 1.13c TreasureClassEx drop at `(x, y)`, spiraling outward across
   * walkable, unoccupied sub-tiles (`findDropPosition`) and flagging each newly spawned item
   * with `IFLAG_NEWITEM (0x2000)` so the client plays the mode-5 flippy animation and drop SFX.
   */
  private spawnDroppedItems(items: readonly Item[], areaId: number, x: number, y: number): number[] {
    const ids: number[] = []
    const used = new Set<string>()
    items.forEach((dropped) => {
      const position = this.findDropPosition(areaId, x, y, used)
      const item = finalizeDroppedItem113c(dropped)
      const entry = this.createServerEntryFromItem(item, {
        location: 'ground',
        x: position.x,
        y: position.y,
        areaId,
        ownerId: 0,
        storePage: 0,
        gamble: false,
      })
      this.groundItems.set(entry.unitId, entry)
      used.add(`${entry.x}:${entry.y}`)
      const itemData = this.serverEntryToItemData(entry)
      const dropFlags = ((itemData.rawFlags ?? itemData.flags ?? 0x00000010) | 0x00002000) >>> 0
      this.broadcastToArea(areaId, {
        type: 'ItemEvent',
        action: 'groundSpawn',
        itemId: entry.unitId,
        code: entry.code,
        x: entry.x,
        y: entry.y,
        container: 'ground',
        item: {
          ...itemData,
          action: 0x00,
          flags: dropFlags,
          rawFlags: dropFlags,
          newItem: true,
        },
      })
      ids.push(entry.unitId)
    })
    return ids
  }

  /**
   * 1.13c item drop placement: spiral outward from the kill/container cell and take the
   * first walkable, unoccupied sub-tile. Never places items inside walls/void; if all
   * walkable cells within the spiral are already occupied, falls back to the nearest
   * walkable cell rather than an unwalkable origin.
   */
  private findDropPosition(
    areaId: number,
    originX: number,
    originY: number,
    used: ReadonlySet<string>,
  ): { readonly x: number; readonly y: number } {
    const ox = Math.round(originX)
    const oy = Math.round(originY)
    let firstWalkable: { readonly x: number; readonly y: number } | undefined
    for (let radius = 0; radius <= 16; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
          const x = ox + dx
          const y = oy + dy
          if (!this.isWorldWalkableForPlayer(areaId, x, y)) continue
          firstWalkable ??= { x, y }
          const key = `${x}:${y}`
          if (used.has(key)) continue
          let occupied = false
          for (const existing of this.groundItems.values()) {
            if (existing.areaId === areaId && existing.x === x && existing.y === y) {
              occupied = true
              break
            }
          }
          if (!occupied) return { x, y }
        }
      }
    }
    return firstWalkable ?? { x: ox, y: oy }
  }

  /** Full item stat (statId) a player carries on equipped items, e.g. 80 item_magicbonus / 79 item_goldbonus. */
  private sumEquippedItemStat(player: InternalPlayerRecord, statId: number): number {
    let total = 0
    for (const item of player.items) {
      if (item.location === 'equipped') total += item.stats.get(statId) ?? 0
    }
    return total
  }

  /**
   * ItemStatCost `lifedrainmindam` (60) / `manadrainmindam` (62) of a player: worn items, sockets
   * and set bonuses (`sumPlayerItemStat`) plus skill / state modifiers on the persistent combat
   * stat list. These are the stats the 1.13c damage filler (D2Game 0x6FCFD6FB) copies into the
   * steal fields read at 0x6FCFBA40.
   */
  private playerStealPct(player: InternalPlayerRecord, statId: 60 | 62): number {
    const statName = statId === 60 ? 'lifedrainmindam' : 'manadrainmindam'
    const modifiers = this.playerCombat.get(player.unitId)?.statList.getModifierBonus(statName) ?? 0
    return this.sumPlayerItemStat(player, statId) + Math.trunc(modifiers)
  }

  /**
   * Write the life / mana an `executeSUnitDmg` hit gave its player attacker (life / mana steal,
   * Life Tap) back to the authoritative record, clamped to max life / max mana as 0x6FCFB570 /
   * 0x6FCFAE70 do, and notify the client (stats 6 / 8).
   */
  private applyPlayerStealOutcome(player: InternalPlayerRecord, out: SUnitDmgOutcome): void {
    const life256 = out.attackerHealed256 ?? 0
    const mana256 = out.attackerManaLeeched256 ?? 0
    if (life256 > 0 && player.hpFixed > 0) {
      const hp256 = Math.min(player.maxHpFixed, player.hpFixed + life256)
      if (hp256 !== player.hpFixed) {
        player.hpFixed = hp256
        player.hp = Math.max(0, Math.ceil(hp256 / FIXED_ONE))
        this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 6, value: player.hpFixed })
      }
    }
    if (mana256 > 0) {
      const next256 = Math.min(player.maxManaFixed, player.manaFixed + mana256)
      if (next256 !== player.manaFixed) {
        player.manaFixed = next256
        player.mana = Math.floor(next256 / FIXED_ONE)
        this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 8, value: player.manaFixed })
      }
    }
  }

  /** Living party members of `player` (itself included) in `areaId`: the drop pipeline's `partyPlayers`. */
  private countPartyPlayersInArea(player: InternalPlayerRecord, areaId: number): number {
    let count = 0
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== areaId) continue
      if (p.unitId === player.unitId || (player.partyId !== 0xffff && p.partyId === player.partyId)) count++
    }
    return Math.max(1, count)
  }

  /**
   * 1.13c monster death drop: `resolveMonsterDropPending113c` (MonStats TreasureClass by rank, Act boss
   * first-kill quest TC) + `executePendingMonsterDrop113c` (TreasureClassEx incl. NoDrop with /players
   * scaling, MF/GF, quality, affixes, gold), killer MF/GF from equipped stats 80/79.
   */
  private static readonly ACT_BOSS_QUEST_113C: Readonly<Record<string, string>> = {
    andariel: 'a1q6',
    duriel: 'a2q6',
    mephisto: 'a3q6',
    diablo: 'a4q3',
    baal: 'a5q6',
  }

  /** Distinct worn SetItems per set (duplicate rings count once). */
  private wornSetPieceCounts(worn: readonly ServerItemEntry[]): Map<string, number> {
    const tables = getEmbeddedDropTables()
    const counts = new Map<string, number>()
    const seen = new Set<number>()
    for (const item of worn) {
      const setId = item.rawItemData?.setItemId
      if (setId === undefined || setId < 0 || setId === 0xfff || seen.has(setId)) continue
      const setItem = tables.sets.items.getById(setId)
      if (setItem === undefined) continue
      seen.add(setId)
      counts.set(setItem.set, (counts.get(setItem.set) ?? 0) + 1)
    }
    return counts
  }

  /** Resolve set-bonus MF/GF across active worn equipment (`ITEMS_UpdateSetBonuses` 0x6FD96A40). */
  private sumEquippedSetBonusStat(
    worn: readonly ServerItemEntry[],
    statId: number,
    level: number,
  ): number {
    if (statId !== 80 && statId !== 79) return 0
    const perLevelStatId = statId === 80 ? 240 : statId === 79 ? 239 : undefined
    const tables = getEmbeddedDropTables()
    if (!tables.properties || !tables.itemStatCost) return 0
    // Worn piece count uses distinct SetItems.txt ids; duplicate set rings count once toward set count.
    const counts = this.wornSetPieceCounts(worn)
    let total = 0
    const addProps = (props: readonly { code: string; par?: unknown; min: number; max: number }[]): void => {
      for (const prop of props) {
        const param = typeof prop.par === 'number' ? prop.par : Number(prop.par ?? 0) || 0
        for (const resolved of tables.properties!.resolveProperty(
          prop.code,
          param,
          prop.min,
          prop.max,
          tables.itemStatCost!,
        )) {
          const midVal = Math.floor((resolved.min + resolved.max) / 2)
          if (resolved.statId === statId) {
            total += midVal
          } else if (perLevelStatId !== undefined && resolved.statId === perLevelStatId) {
            total += Math.floor((midVal * level) / 8)
          }
        }
      }
    }
    const seenSets = new Set<string>()
    for (const item of worn) {
      const setId = item.rawItemData?.setItemId
      if (setId === undefined || setId < 0 || setId === 0xfff) continue
      const setItem = tables.sets.items.getById(setId)
      if (setItem === undefined) continue
      const setDef = tables.sets.sets.get(setItem.set)
      if (setDef === undefined) continue
      const wornCount = counts.get(setItem.set) ?? 1
      const bonuses = resolveActiveSetBonuses(setItem, setDef, wornCount)
      // Real generated items already folded `props` into item.stats; synthetic
      // set items without that stat still receive the single-piece property.
      const hasOwnStat =
        item.stats?.has(statId) === true ||
        (perLevelStatId !== undefined && item.stats?.has(perLevelStatId) === true)
      if (!hasOwnStat) addProps(bonuses.props)
      // Green item-specific set bonuses (`aprop1a..aprop5b`) apply on EACH worn set item
      // (so wearing 2x Angelic Halo rings with 3 Angelic pieces grants +50% MF from each ring).
      addProps(bonuses.aprops)
      if (!seenSets.has(setItem.set)) {
        seenSets.add(setItem.set)
        // Gold partial/full-set bonuses (`PCode2a..FCode8`) apply once per set, never per piece.
        addProps(bonuses.pCodes)
        addProps(bonuses.fCodes)
      }
    }
    return total
  }

  /** Full MF/GF: active weapon set, inventory charms, sockets and set bonuses. */
  private sumPlayerItemStat(player: InternalPlayerRecord, statId: number): number {
    const perLevelStatId = statId === 80 ? 240 : statId === 79 ? 239 : undefined
    const addStats = (stats: ReadonlyMap<number, number> | undefined, level: number): number => {
      if (!stats) return 0
      let value = stats.get(statId) ?? 0
      if (perLevelStatId !== undefined) {
        value += Math.floor(((stats.get(perLevelStatId) ?? 0) * level) / 8)
      }
      return value
    }
    let total = 0
    const seenUniqueCharms = new Set<number>()
    const worn: ServerItemEntry[] = []
    for (const item of player.items) {
      // Inactive weapon-swap slots (bodyLoc 11 = rarm2, 12 = larm2) never contribute stats or set bonuses.
      if (item.location === 'equipped') {
        if (item.bodyLoc === 11 || item.bodyLoc === 12) continue
        worn.push(item)
      } else if (item.location === 'inventory') {
        const code = (item.code ?? '').toLowerCase()
        if (code !== 'cm1' && code !== 'cm2' && code !== 'cm3') continue
        const uniqueId = item.rawItemData?.uniqueItemId
        if (uniqueId !== undefined && uniqueId >= 0 && uniqueId !== 0xfff) {
          if (seenUniqueCharms.has(uniqueId)) continue
          seenUniqueCharms.add(uniqueId)
        }
      } else {
        continue
      }
      total += addStats(item.stats, player.level)
      if (Array.isArray(item.socketedItems)) {
        for (const socketed of item.socketedItems) total += addStats(socketed.stats, player.level)
      }
    }
    total += this.sumEquippedSetBonusStat(worn, statId, player.level)
    return total
  }

  /** Mercenary gear MF/GF (helmet / armor / weapon + sockets + set bonuses), including per-level stats. */
  private sumMercItemStat(merc: InternalMercenaryRecord, statId: number): number {
    const perLevelStatId = statId === 80 ? 240 : statId === 79 ? 239 : undefined
    const addStats = (stats: ReadonlyMap<number, number> | undefined): number => {
      if (!stats) return 0
      let value = stats.get(statId) ?? 0
      if (perLevelStatId !== undefined) {
        value += Math.floor(((stats.get(perLevelStatId) ?? 0) * merc.level) / 8)
      }
      return value
    }
    let total = 0
    for (const item of merc.equipment) {
      total += addStats(item.stats)
      if (Array.isArray(item.socketedItems)) {
        for (const socketed of item.socketedItems) total += addStats(socketed.stats)
      }
    }
    total += this.sumEquippedSetBonusStat(merc.equipment, statId, merc.level)
    return total
  }

  private actBossQuestId(defId: string): string | undefined {
    const id = defId.trim().toLowerCase()
    for (const [boss, quest] of Object.entries(GameInstance.ACT_BOSS_QUEST_113C)) {
      if (id.startsWith(boss) || id.includes(boss)) return quest
    }
    return undefined
  }

  /** Death animation action/completion frame (`{code}DTHTH`), falling back to compiled 1.13c AnimData DT metrics. */
  private monsterDeathDropDelayFrames(monster: InternalMonsterRecord): number {
    const code = MONSTATS_113C_ROWS[monster.hcIdx]?.code?.trim().toUpperCase()
    if (code !== undefined && code !== '') {
      const record = this.registry.getAnimDataRecord(`${code}DTHTH`)
      if (record !== undefined && record.framesPerDirection > 0 && record.hasSpeed) {
        const event = record.events.find((entry) => entry.code !== 0)
        const frame = event !== undefined ? event.frame + 1 : record.framesPerDirection
        return Math.max(
          1,
          Math.floor((frame * 256) / Math.max(1, record.animationSpeed)),
        )
      }
    }
    if (monster.hcIdx >= 0 && monster.hcIdx < MONSTATS_113C_ROWS.length) {
      const fpd = getMonsterModeBaseFrameCount113c(monster.hcIdx, 0)
      const speed = getMonsterModeBaseAnimSpeed256(monster.hcIdx, 0)
      if (fpd > 0 && speed > 0) {
        return Math.max(1, Math.floor((fpd * 256) / speed))
      }
    }
    return MONSTER_DEATH_DROP_DELAY_FRAMES
  }

  /**
   * Creates a 1.13c quest drop item (`D2Game_CreateQuestItem` @ `0x6FC31A70` / `sub_6FC95DF0`):
   * uses the `UniqueItems.txt` entry (`ITEMQUAL_UNIQUE`) for quest uniques (`vip`, `msf`, `hst`,
   * `hfh`, `qf1`, `qf2`) and `ITEMQUAL_NORMAL` for `Misc.txt` / non-unique quest items (`bks`,
   * `hdm`, `bbb`, `j34`, `g33`, `box`, `tr1`, `qhr`, `qbr`, `qey`, `ass`, `mss`).
   */
  private createQuestDropItem(code: string, ilvl = 1): Item | undefined {
    const tables = getEmbeddedDropTables()
    const base = tables.getBase(code)
    if (!base) return undefined
    const seed = this.rng.rand(0x7fffffff) >>> 0
    const itemRng = new D2Rng(seed || 1)
    const uniqueItem = tables.uniques.getEnabledByCode(base.id)[0]
    if (uniqueItem) {
      return createDroppedItem(base, 'unique', {
        uniqueItem,
        ethereal: false,
        sockets: 0,
        itemTypes: tables.itemTypes,
        ilvl,
        dwInitSeed: seed,
        itemRng,
      })
    }
    return createDroppedItem(base, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl,
      dwInitSeed: seed,
      itemRng,
    })
  }

  private rollMonsterDeathDrop(killer: InternalPlayerRecord, monster: InternalMonsterRecord): number[] {
    const tables = getEmbeddedDropTables()
    const difficulty = this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
    const questId = this.actBossQuestId(monster.defId)
    const firstKill =
      questId !== undefined
        ? !hasQuestFlag113c(killer.questFlags, questId, QUEST_FLAG_COMPLETED_113C)
        : !this.killedActBosses.has(`${monster.defId}:${difficulty}`)
    const merc = monster.lastHitByMerc
      ? [...this.mercenaries.values()].find(
          (entry) => entry.ownerPlayerId === killer.unitId && entry.areaId === monster.areaId,
        )
      : undefined
    const mercMf = merc === undefined ? 0 : this.sumMercItemStat(merc, 80)
    const mercGf = merc === undefined ? 0 : this.sumMercItemStat(merc, 79)
    const pending = resolveMonsterDropPending113c(
      undefined,
      {
        kind: 'kill',
        x: monster.x,
        y: monster.y,
        subjectId: monster.defId,
        monsterIndex: monster.unitId,
        monsterLevel: monster.level,
        monsterRank: monster.rank,
        ...(monster.superUniqueId !== undefined ? { superUniqueId: monster.superUniqueId } : {}),
      },
      {
        dropTables: tables,
        difficulty,
        wasBossAlreadyKilled: !firstKill,
        onMarkBossFirstKill: (subjectId, diff) => {
          this.killedActBosses.add(`${subjectId}:${diff}`)
          if (questId !== undefined) {
            this.setPlayerQuestFlag(killer, questId, QUEST_FLAG_COMPLETED_113C)
          }
        },
        playerMf: this.sumPlayerItemStat(killer, 80) + mercMf,
        playerGf: this.sumPlayerItemStat(killer, 79) + mercGf,
        gamePlayers: this.playersX,
        partyPlayers: this.countPartyPlayersInArea(killer, monster.areaId),
      },
    )
    if (!pending) return []
    const items = executePendingMonsterDrop113c(tables, pending, difficulty, this.rng.rand(0x7fffffff) || 1)
    if (items.length > 0) {
      monster.pendingDropItems = items
      monster.pendingDropFrame = this.currentFrame + this.monsterDeathDropDelayFrames(monster)
    }
    return []
  }

  /**
   * Objects.txt `OperateFn` container drop (D2Game.dll 0x6fc8b570 via the operate functions listed in
   * `CONTAINER_OPERATE_DROP_CHANCE_113C`): one chance roll, then one `Act N Chest A|B|C` TreasureClassEx
   * drop at the level monster level with the operator's MF/GF.
   */
  private rollContainerDrop(player: InternalPlayerRecord, obj: InternalObjectRecord, dropChance: number): number[] {
    if (obj.isSparkling) return this.rollSparklingChestDrop(player, obj)
    // Locked chests roll the container drop twice (1.13c object flag +0x80).
    const rolls = obj.isLocked ? 2 : 1
    const dropped: Item[] = []
    for (let roll = 0; roll < rolls; roll++) {
      if (this.rng.rand(100) >= dropChance) continue
      const tables = getEmbeddedDropTables()
      const ctx = resolveChestDropContext113c(obj.areaId, this.difficulty)
      dropped.push(...executeDropPipeline(tables, {
        tcName: ctx.tcName,
        nLevel: ctx.monsterLevel,
        // Sparkling chests force the higher-quality (unique-tier) drop path.
        monsterType: obj.isSparkling ? 3 : 1,
        difficulty: this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal',
        gamePlayers: this.playersX,
        partyPlayers: this.countPartyPlayersInArea(player, obj.areaId),
        playerMf: this.sumPlayerItemStat(player, 80),
        playerGf: this.sumPlayerItemStat(player, 79),
        monsterRng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
      }))
    }
    return dropped.length > 0
      ? this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
      : []
  }

  /** 1.13c Sparkling Chest roll thresholds (`D2Game.dll` 0x6FC8E8B0). */
  private sparklingChestPlan(roll: number): {
    readonly quality?: number
    readonly attempts: number
    readonly magic: number
    readonly normal: number
    readonly gold: number
    readonly potions: number
  } {
    if (roll < 200) return { quality: 7, attempts: 2, magic: 0, normal: 0, gold: 0, potions: 0 }
    if (roll < 600) return { quality: 5, attempts: 2, magic: 0, normal: 0, gold: 0, potions: 0 }
    if (roll < 1200) return { quality: 6, attempts: 2, magic: 0, normal: 0, gold: 0, potions: 0 }
    if (roll < 3200) return { attempts: 0, magic: 3, normal: 0, gold: 0, potions: 0 }
    if (roll < 6200) return { attempts: 0, magic: 2, normal: 1, gold: 7, potions: 0 }
    return { attempts: 0, magic: 1, normal: 4, gold: 5, potions: 4 }
  }

  /** 1.13c Sparkling Chest (OperateFn 58) quality sequence. */
  private rollSparklingChestDrop(player: InternalPlayerRecord, obj: InternalObjectRecord): number[] {
    const roll = this.rng.rand(10000)
    const tables = getEmbeddedDropTables()
    const ctx = resolveChestDropContext113c(obj.areaId, this.difficulty)
    const difficulty =
      this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
    const dropped: Item[] = []
    const playerMf = this.sumPlayerItemStat(player, 80)
    const playerGf = this.sumPlayerItemStat(player, 79)
    const rollOnce = (forcedQuality?: number): Item[] =>
      executeDropPipeline(tables, {
        tcName: ctx.tcName,
        nLevel: ctx.monsterLevel,
        monsterType: 3,
        difficulty,
        gamePlayers: this.playersX,
        partyPlayers: this.countPartyPlayersInArea(player, obj.areaId),
        playerMf,
        playerGf,
        monsterRng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
        ...(forcedQuality !== undefined ? { forcedQuality } : {}),
      })
    const takeQuality = (quality: number, attempts: number): Item | undefined => {
      for (let i = 0; i < attempts; i++) {
        const rolled = rollOnce(quality)
        const match = rolled.find((item) => Number(item.quality ?? 2) === quality)
        if (match !== undefined) return match
      }
      return undefined
    }
    const takeMagic = (count: number): void => {
      let got = 0
      for (let i = 0; i < 10 && got < count; i++) {
        const rolled = rollOnce(4)
        const match = rolled.find((item) => Number(item.quality ?? 2) === 4)
        if (match !== undefined) {
          dropped.push(match)
          got++
        }
      }
    }
    const takeAny = (): void => {
      const rolled = rollOnce()
      if (rolled[0] !== undefined) dropped.push(rolled[0])
    }
    const addGold = (piles: number): void => {
      const base = tables.getBase('gld')
      if (base === undefined) return
      const lvl = Math.max(1, ctx.monsterLevel)
      for (let i = 0; i < piles; i++) {
        const seed = this.rng.rand(0x7fffffff) >>> 0
        const item = createDroppedItem(base, 'normal', {
          itemTypes: tables.itemTypes,
          ilvl: lvl,
          dwInitSeed: seed,
          itemRng: new D2Rng(seed || 1),
        })
        let amount = Math.max(1, this.rng.rand(5 * lvl) + lvl)
        if (playerGf !== 0) {
          amount = Math.max(1, Math.floor((amount * (100 + playerGf)) / 100))
        }
        dropped.push({ ...item, stack: amount })
      }
    }
    const addPotion = (code: string): void => {
      const base = tables.getBase(code)
      if (base === undefined) return
      const seed = this.rng.rand(0x7fffffff) >>> 0
      dropped.push(
        createDroppedItem(base, 'normal', {
          itemTypes: tables.itemTypes,
          ilvl: Math.max(1, ctx.monsterLevel),
          dwInitSeed: seed,
          itemRng: new D2Rng(seed || 1),
        }),
      )
    }
    const fallbackLow = (): void => {
      takeMagic(1)
      for (let i = 0; i < 4; i++) takeAny()
      addGold(5)
      addPotion('hp3')
      addPotion('hp3')
      addPotion('mp3')
      addPotion('mp3')
    }

    const plan = this.sparklingChestPlan(roll)
    if (plan.quality !== undefined) {
      const item = takeQuality(plan.quality, plan.attempts)
      if (item !== undefined) dropped.push(item)
      else fallbackLow()
    } else {
      takeMagic(plan.magic)
      for (let i = 0; i < plan.normal; i++) takeAny()
      addGold(plan.gold)
      for (let i = 0; i < plan.potions; i++) addPotion(i % 2 === 0 ? 'hp3' : 'mp3')
    }
    return dropped.length > 0 ? this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y) : []
  }

  spawnMonster(spec: SpawnMonsterSpec): number {
    const unitId = this.allocateUnitId()
    const rawClassId = spec.classId ?? spec.hcIdx ?? spec.monstatsId
    const diffName =
      this.difficulty === 2
        ? 'hell'
        : this.difficulty === 1
          ? 'nightmare'
          : 'normal'

    const rawClassKind =
      rawClassId !== undefined
        ? getMonsterKindByHcIdx(rawClassId, diffName)
        : undefined
    let kind: MonsterKind | undefined
    if (
      spec.defId &&
      !(spec.defId.trim().toLowerCase() === 'chicken' && rawClassId !== undefined && rawClassId !== 149)
    ) {
      const targetDef = spec.defId.trim().toLowerCase()
      const canonicalMap = getCanonicalMonsterKinds(diffName)
      kind = canonicalMap.get(targetDef)
      if (!kind) {
        for (const k of canonicalMap.values()) {
          if (
            k.id.toLowerCase() === targetDef ||
            k.baseId.toLowerCase() === targetDef
          ) {
            kind = k
            break
          }
        }
      }
    }
    if (!kind && rawClassKind) {
      kind = rawClassKind
    }

    const classId = rawClassId ?? kind?.hcIdx ?? 0
    const hcIdx = rawClassId ?? kind?.hcIdx ?? classId
    const defId =
      spec.defId &&
      !(spec.defId.trim().toLowerCase() === 'chicken' && rawClassId !== undefined && rawClassId !== 149)
        ? spec.defId
        : (kind?.id ?? spec.defId ?? `monster_${classId}`)
    const areaId = spec.areaId ?? this.defaultAreaId ?? 1
    const isVendor = Boolean(spec.isVendor)
    const isNpc = Boolean(spec.isNpc || spec.isVendor)

    const rank: MonsterRank =
      spec.rank === 'champion' ||
      spec.rank === 'unique' ||
      spec.rank === 'minion'
        ? spec.rank
        : spec.rank === 'superunique' || spec.rank === 'boss'
          ? 'unique'
          : 'normal'

    const rawUMods = spec.monUMods ?? spec.umodIds ?? spec.modifiers ?? []
    const umodIds: number[] = [
      ...resolveMonsterUModIds(rawUMods as readonly (number | string)[]),
    ]
    const auraSkillId = umodIds.includes(MON_UMOD.AURA)
      ? MONSTER_AURA_SKILL_IDS_113C[
          (hcIdx + areaId + (spec.statSeed ?? 0)) % MONSTER_AURA_SKILL_IDS_113C.length
        ]
      : undefined
    const mappedFromUmodIds = umodIds
      .map((id: number): string => {
        const label = MON_UMOD_LABELS_113C[id]
        if (label !== undefined) return label
        // Every other enabled MonUMod row surfaces its canonical `uniquemod` id,
        // so no row is silently dropped (id 22 is `questcomplete`, not Fire).
        const row = MON_UMOD_ROW_BY_ID_113C.get(id)
        return row?.enabled ? row.id : ''
      })
      .filter((s: string) => s.length > 0)
    const modifierNames: string[] = [
      ...new Set([
        ...(spec.modifiers !== undefined
          ? spec.modifiers.map((m) => String(m))
          : []),
        ...mappedFromUmodIds,
      ]),
    ]

    const effectiveAreaLevel =
      spec.areaLevel ??
      (!isNpc && spec.areaId !== undefined
        ? getLevelMonsterPlan113c(spec.areaId, diffName)?.monsterLevel
        : undefined)
    const resolvedStats = kind
      ? resolveMonsterStats(kind, {
          difficulty: diffName,
          rank,
          modifiers: modifierNames,
          playersCount: 1,
          ...(effectiveAreaLevel !== undefined ? { areaLevel: effectiveAreaLevel } : {}),
          ...(spec.statSeed !== undefined ? { seed: spec.statSeed } : {}),
          ...(spec.superUniqueId !== undefined ? { superUniqueId: spec.superUniqueId } : {}),
        })
      : undefined

    const noRatio = Boolean(spec.noRatio ?? kind?.noRatio ?? false)
    const baseMaxHp = Math.max(
      1,
      spec.maxHp ?? spec.hp ?? resolvedStats?.maxHp ?? resolvedStats?.hp ?? 50,
    )
    const px = this.playersX
    const scaledMaxHp =
      isNpc || noRatio
        ? baseMaxHp
        : Math.max(1, Math.floor((baseMaxHp * (px + 1)) / 2))
    const hp = spec.hp !== undefined ? Math.max(1, spec.hp) : scaledMaxHp
    const maxHp = Math.max(hp, scaledMaxHp)

    const level = Math.max(
      1,
      spec.level ?? resolvedStats?.level ?? kind?.level?.[this.difficulty] ?? 1,
    )
    const baseXp = Math.max(
      0,
      spec.experience ?? resolvedStats?.xp ?? level * 45,
    )
    const specDmgMult =
      (umodIds.includes(MON_UMOD.STRONG) ? 1.5 : 1) *
      (umodIds.includes(MON_UMOD.BERSERK)
        ? 3
        : rank === 'champion'
          ? this.difficulty === 2
            ? 1.5
            : this.difficulty === 1
              ? 1.75
              : 2
          : 1)
    const minDmg = Math.max(
      1,
      spec.minDmg !== undefined
        ? Math.round(spec.minDmg * specDmgMult)
        : (resolvedStats?.attack1?.minDamage ??
            resolvedStats?.attack1?.min ??
            resolvedStats?.damage ??
            Math.max(2, level * 3)),
    )
    const maxDmg = Math.max(
      minDmg,
      spec.maxDmg !== undefined
        ? Math.round(spec.maxDmg * specDmgMult)
        : (resolvedStats?.attack1?.maxDamage ??
            resolvedStats?.attack1?.max ??
            resolvedStats?.damage ??
            Math.max(minDmg, level * 4)),
    )
    const ar = Math.max(
      1,
      spec.ar ??
        resolvedStats?.toHit ??
        resolvedStats?.attack1?.toHit ??
        50 + level * 15,
    )
    const attack2Ar = Math.max(
      1,
      spec.ar ??
        resolvedStats?.attack2?.toHit ??
        kind?.attack2?.toHit ??
        ar,
    )
    const special1Ar = Math.max(
      1,
      spec.ar ??
        resolvedStats?.special1?.toHit ??
        kind?.special1?.toHit ??
        attack2Ar,
    )
    const ac = Math.max(
      0,
      spec.ac ?? resolvedStats?.armor ?? resolvedStats?.armour ?? level * 5,
    )

    const isKillable =
      spec.isKillable ??
      spec.killable ??
      (isNpc ? false : (kind?.killable ?? true))
    const petIgnore = Boolean(spec.petIgnore ?? kind?.petIgnore ?? false)
    const isBoss = Boolean(
      spec.isBoss ??
        (kind?.isBoss || kind?.boss || rank === 'unique'),
    )
    const isPrimeEvil = Boolean(
      spec.isPrimeEvil ?? kind?.isPrimeEvil ?? kind?.primeevil ?? false,
    )
    const isUndead = Boolean(spec.isUndead ?? kind?.isUndead ?? false)
    const isDemon = Boolean(spec.isDemon ?? kind?.isDemon ?? false)
    const isFlying = Boolean(
      spec.isFlying ?? spec.flying ?? kind?.isFlying ?? kind?.flying ?? false,
    )
    const modeMissiles = kind?.modeMissiles
    // 1.13c resurrection is a `MonStats.txt` `Skill1..8` row with `srvdofunc=97` on the caster:
    // FallenShaman -> Resurrect (181), FetishShaman/GreaterMummy -> Resurrect2 (327).
    // SkeletonRaise (158) has an empty `srvdofunc` and is the raise sequence (`seq_skeletonraise` /
    // `seq_fethisraise`) played on the revived unit, never a corpse-resurrecting spell cast by skeletons/fetishes.
    const resurrectSkillId =
      spec.resurrectSkillId ??
      (kind?.skills ?? rawClassKind?.skills ?? []).find(
        (s) => s.skillId === 181 || s.skillId === 327,
      )?.skillId
    const hasModeMissile = Boolean(
      modeMissiles?.MissA1 ||
        modeMissiles?.MissA2 ||
        modeMissiles?.MissS1 ||
        modeMissiles?.MissC ||
        getMonsterModeMissile113c(defId, 'A1') ||
        getMonsterModeMissile113c(defId, 'A2') ||
        getMonsterModeMissile113c(defId, 'S1') ||
        getMonsterModeMissile113c(defId, 'C'),
    )
    // Ranged attacks come from MonStats `RangedType` / mode missiles, or the MonAi.txt
    // behavior family — never from the monster's display name.
    const aiName = spec.ai ?? kind?.ai ?? rawClassKind?.ai ?? ''
    const isRanged = Boolean(
      spec.isRanged ??
        (kind?.ranged ||
          kind?.isRanged ||
          rawClassKind?.ranged ||
          rawClassKind?.isRanged ||
          hasModeMissile ||
          monsterProfile113c(aiName).ranged),
    )

    const resistances = {
      phys:
        spec.resistances?.phys ?? resolvedStats?.resistances?.physical ?? 0,
      magic:
        spec.resistances?.magic ?? resolvedStats?.resistances?.magic ?? 0,
      fire: spec.resistances?.fire ?? resolvedStats?.resistances?.fire ?? 0,
      light:
        spec.resistances?.light ??
        spec.resistances?.lightning ??
        resolvedStats?.resistances?.lightning ??
        0,
      cold: spec.resistances?.cold ?? resolvedStats?.resistances?.cold ?? 0,
      poison:
        spec.resistances?.poison ?? resolvedStats?.resistances?.poison ?? 0,
    }

    // Store inventories are filled per player when a trade / gamble window opens (handleNpcAction).
    const vendorPool: ServerItemEntry[] = []

    const specMeleeOverride = spec.minDmg !== undefined || spec.maxDmg !== undefined
    const attack2MinDmg = specMeleeOverride
      ? minDmg
      : Math.max(
          1,
          resolvedStats?.attack2?.minDamage ??
            resolvedStats?.attack2?.min ??
            kind?.attack2?.minDamage ??
            minDmg,
        )
    const attack2MaxDmg = specMeleeOverride
      ? maxDmg
      : Math.max(
          attack2MinDmg,
          resolvedStats?.attack2?.maxDamage ??
            resolvedStats?.attack2?.max ??
            kind?.attack2?.maxDamage ??
            maxDmg,
        )
    const special1MinDmg = specMeleeOverride
      ? minDmg
      : Math.max(
          1,
          resolvedStats?.special1?.minDamage ??
            resolvedStats?.special1?.min ??
            kind?.special1?.minDamage ??
            attack2MinDmg,
        )
    const special1MaxDmg = specMeleeOverride
      ? maxDmg
      : Math.max(
          special1MinDmg,
          resolvedStats?.special1?.maxDamage ??
            resolvedStats?.special1?.max ??
            kind?.special1?.maxDamage ??
            attack2MaxDmg,
        )
    const elementalAttacks =
      resolvedStats?.elementalAttacks ?? kind?.elementalAttacks ?? []
    const hasAttack2 = Boolean(
      (resolvedStats?.attack2?.maxDamage ?? resolvedStats?.attack2?.max ??
        kind?.attack2?.maxDamage ?? kind?.attack2?.max ?? 0) > 0,
    )
    const hasSpecial1 = Boolean(
      (resolvedStats?.special1?.maxDamage ?? resolvedStats?.special1?.max ??
        kind?.special1?.maxDamage ?? kind?.special1?.max ?? 0) > 0,
    )

    const record: InternalMonsterRecord = {
      unitId,
      classId,
      hcIdx,
      defId,
      superUniqueId: spec.superUniqueId,
      name:
        spec.name ??
        resolvedStats?.name ??
        kind?.id ??
        (isNpc ? `NPC_${classId}` : `Monster_${classId}`),
      areaId,
      x: spec.x,
      y: spec.y,
      hp,
      maxHp,
      baseMaxHp,
      level,
      baseXp,
      minDmg,
      maxDmg,
      attack2MinDmg,
      attack2MaxDmg,
      special1MinDmg,
      special1MaxDmg,
      hasAttack2,
      hasSpecial1,
      elementalAttacks,
      pendingAttack: undefined,
      pendingAllyAttack: undefined,
      ar,
      attack2Ar,
      special1Ar,
      ac,
      mode: 1,
      dead: false,
      isNpc,
      isVendor,
      isKillable,
      petIgnore,
      isBoss,
      isPrimeEvil,
      isUndead,
      isDemon,
      isFlying,
      isRanged,
      modeMissiles,
      noRatio,
      rank,
      modifiers: modifierNames,
      umodIds,
      monType: spec.monType ?? kind?.monType ?? rawClassKind?.monType ?? '',
      sizeX: kind?.sizeX ?? rawClassKind?.sizeX ?? 2,
      skills: resolvedStats?.skills ?? kind?.skills ?? [],
      skillCooldown: 0,
      skillCursor: 0,
      threatPlayerId: 0,
      threatUntilFrame: 0,
      lastHitByMerc: false,
      wanderCooldown: 90,
      wanderTargetX: Number.NaN,
      wanderTargetY: Number.NaN,
      hitRecoveryUntilFrame: 0,
      pendingResurrection: undefined,
      teleportCooldownUntilFrame: 0,
      pendingDeathExplosion: undefined,
      resurrectSkillId,
      auraSkillId,
      ai: spec.ai ?? kind?.ai ?? 'Idle',
      aiDelay: Math.max(1, spec.aiDelay ?? kind?.aiDelay ?? 15),
      aiParams: spec.aiParams ?? kind?.aiParams ?? [0, 0, 0, 0, 0, 0, 0, 0],
      nextAiFrame: 0,
      pathRunning: false,
      spawnedChildren: 0,
      consecutiveA2: 0,
      frenzyUntilFrame: 0,
      frenzySpeedPct: 0,
      resistances,
      drain: spec.drain ?? kind?.drain ?? 100,
      coldEffect: spec.coldEffect ?? kind?.coldEffect ?? -50,
      damageRegen: spec.damageRegen ?? kind?.damageRegen ?? 0,
      regenCarry: 0,
      poisonBitrate256: 0,
      poisonRemainingFrames: 0,
      poisonCarry256: 0,
      poisonAttackerId: 0,
      poisonSkillId: 0,
      toBlock: spec.toBlock ?? kind?.toBlock ?? 0,
      velocity: spec.velocity ?? kind?.velocity ?? 6,
      runSpeed: spec.runSpeed ?? kind?.runVelocity ?? 9,
      stepSpeed: spec.stepSpeed,
      // MonStats `aidist` is the AI sight distance; 0 means the 1.13c default ~20 sub-tiles.
      aggroRadius:
        spec.aggroRadius ??
        ((kind?.aiDistance ?? rawClassKind?.aiDistance ?? 0) > 0
          ? (kind?.aiDistance ?? rawClassKind?.aiDistance ?? 20)
          : 20),
      cooldown: 0,
      // MonStats `aidel` is the AI think interval (difficulty tier already hydrated in `kind`).
      cooldownTicks: Math.max(1, Math.floor(spec.aiDelay ?? kind?.aiDelay ?? rawClassKind?.aiDelay ?? 6)),
      frozenTicks: 0,
      chillTicks: 0,
      convertedUntilFrame: 0,
      convertedByPlayerId: 0,
      path: [],
      pathIndex: 0,
      pathTargetX: Number.NaN,
      pathTargetY: Number.NaN,
      homeX: spec.x,
      homeY: spec.y,
      fleeTicks: 0,
      fleeTargetX: Number.NaN,
      fleeTargetY: Number.NaN,
      shattered: false,
      revivedByShaman: false,
      aiDisabled: Boolean(spec.aiDisabled || isNpc),
      pendingDropItems: undefined,
      pendingDropFrame: 0,
      baalThroneWave: 0,
      baalThroneFlags: 0,
      baalThroneTimerFrame: 0,
      pendingBaalWaveSpawn: undefined,
      states: new Set(),
      stateTimers: new Map(),
      vendorPool,
      vendorStoreGenerated: false,
    }
    this.monsters.set(unitId, record)

    this.broadcastToArea(areaId, {
      type: 'UnitAssign',
      unitType: 'monster',
      unitId,
      classId,
      name: record.name,
      x: record.x,
      y: record.y,
      areaId,
      unit: {
        unitType: 1,
        id: unitId,
        classId,
        name: record.name,
        x: record.x,
        y: record.y,
        mode: 1,
        lifePct: 128,
        ...(record.umodIds.length > 0 ? { bossMods: [...record.umodIds] } : {}),
      },
    })
    return unitId
  }

  spawnObject(spec: SpawnObjectSpec): number {
    const unitId = this.allocateUnitId()
    const areaId = spec.areaId ?? this.defaultAreaId ?? 1
    const resolvedPreset =
      spec.classId >= 574 && spec.classId <= 582
        ? resolvePresetObject113c(spec.classId, areaId, Math.round(spec.x), Math.round(spec.y))
        : null
    const classId = resolvedPreset?.classId ?? spec.classId
    const a3q3Completed = [...this.players.values()].some((p) =>
      hasQuestFlag113c(p.questFlags, 'a3q3', QUEST_FLAG_COMPLETED_113C),
    )
    // D2Game InitFn 47 (0x6fc8f140) for Durance of Hate Stairs (Objects.txt 386) and
    // InitFn 60 (0x6fd084a0) for Compelling Orb (Objects.txt 404): start in OBJMODE_OPENED (2)
    // if A3Q3 (Khalim's Will) is already completed, else OBJMODE_NEUTRAL (0).
    const initialMode =
      spec.mode ??
      ((classId === 386 || classId === 404) && a3q3Completed ? 2 : 0)
    const destAreaId =
      spec.destAreaId ?? (classId === 386 ? 100 : undefined)
    const record: InternalObjectRecord = {
      unitId,
      classId,
      areaId,
      x: spec.x,
      y: spec.y,
      mode: initialMode,
      isWaypoint: Boolean(spec.isWaypoint),
      isShrine: Boolean(spec.isShrine),
      shrineType:
        spec.shrineType ??
        (CANONICAL_113C_OBJECTS[classId]?.isShrine ? 1 + this.rng.rand(22) : 1),
      destAreaId,
      portalOwnerId: undefined,
      isLocked: Boolean(spec.isLocked),
      isSparkling:
        spec.isSparkling === true ||
        resolvedPreset?.isSparkling === true ||
        classId === 397 ||
        getObjectsTxtRecord113c(classId).operateFn === 58,
      shrineResetFrame: 0,
      useCount: 0,
    }
    this.objects.set(unitId, record)

    this.broadcastToArea(areaId, {
      type: 'UnitAssign',
      unitType: 'object',
      unitId,
      classId: record.classId,
      x: record.x,
      y: record.y,
      areaId,
      unit: {
        unitType: 2,
        id: unitId,
        classId: record.classId,
        x: record.x,
        y: record.y,
        mode: record.mode,
      },
    })
    // D2Game InitFn 60 (0x6fd084a0): when Compelling Orb (404) spawns in mode 0,
    // spawn the invisible MonStats 366 compellingorb monster with MONUMOD_QUESTCOMPLETE (22).
    if (record.classId === 404 && record.mode === 0) {
      record.linkedMonsterId = this.spawnMonster({
        classId: 366,
        x: record.x,
        y: record.y,
        areaId,
        isKillable: false,
        aiDisabled: true,
        monUMods: [22],
      })
    }
    return unitId
  }

  spawnGroundItem(spec: {
    readonly code: string
    readonly x: number
    readonly y: number
    readonly areaId?: number | undefined
    readonly quality?: number | undefined
    readonly level?: number | undefined
    readonly cost?: number | undefined
  }): number {
    const unitId = this.allocateUnitId()
    const info = lookupBaseInfo(spec.code)
    const areaId = spec.areaId ?? this.defaultAreaId ?? 1
    const entry: ServerItemEntry = {
      unitId,
      code: spec.code.trim(),
      name: info.name,
      quality: spec.quality ?? 2,
      level: spec.level ?? 1,
      location: 'ground',
      x: spec.x,
      y: spec.y,
      width: info.width,
      height: info.height,
      areaId,
      ownerId: 0,
      bodyLoc: 0,
      storePage: 0,
      cost: spec.cost ?? info.cost,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: info.maxDurability,
      maxDurability: info.maxDurability,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    }
    this.groundItems.set(unitId, entry)

    this.broadcastToArea(areaId, {
      type: 'ItemEvent',
      action: 'groundSpawn',
      itemId: unitId,
      code: entry.code,
      x: entry.x,
      y: entry.y,
      container: 'ground',
      item: this.serverEntryToItemData(entry),
    })
    return unitId
  }

  getGroundItems(): readonly ServerItemEntry[] {
    return [...this.groundItems.values()]
  }

  enqueueCommand(playerUnitId: number, command: ClientCommand): void {
    if (!this.players.has(playerUnitId)) return
    this.commandQueue.push({ playerUnitId, command })
  }

  /**
   * #1327: 1.13c room-based population. When a player stands in a DRLG room, that
   * room and its near rooms (touching bounds, `pRoom->ppRoomsNear`) are populated
   * once from the level's `Levels.txt` plan (`MonDen`, `NumMon`, `mon`/`nmon`,
   * `umon` + `MonUMin..MonUMax` elites with `MonUMod.txt` affixes), with
   * `MonStats.txt` + `MonLvl.txt` stats at the level's `MonLvl*Ex`. Towns and
   * `MonDen = 0` levels never populate; monsters only land on walkable cells.
   */
  private streamWildernessRoomsForPlayer(player: InternalPlayerRecord): void {
    if (TOWN_AREAS.has(player.areaId)) return
    const provider = this.areaRoomProvider
    const walkable = this.terrainWalkableCheck
    if (!provider || !walkable) return

    let state = this.areaPopulations.get(player.areaId)
    if (!state) {
      const rooms = provider(player.areaId) ?? []
      const levelSeed = (this.currentMapSeed ^ Math.imul(player.areaId, 0x9e3779b1)) >>> 0
      state = {
        rooms,
        plan: planLevelPopulation113c(player.areaId, this.difficulty, rooms, levelSeed),
        populated: new Set<number>(),
      }
      this.areaPopulations.set(player.areaId, state)
    }
    const plan = state.plan
    if (!plan) return

    const px = Math.floor(player.x)
    const py = Math.floor(player.y)
    const current = state.rooms.find(
      (r) => px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h,
    )
    if (!current) return

    const areaId = player.areaId
    for (const room of state.rooms) {
      if (state.populated.has(room.index)) continue
      const near =
        room.x <= current.x + current.w &&
        room.x + room.w >= current.x &&
        room.y <= current.y + current.h &&
        room.y + room.h >= current.y
      if (!near) continue
      state.populated.add(room.index)
      const spawns = planRoomPopulation113c(plan, room, (x, y) =>
        walkable(areaId, x, y, false),
      )
      for (let i = 0; i < spawns.length; i++) {
        const s = spawns[i]!
        this.spawnMonster({
          classId: s.kind.hcIdx,
          areaId,
          x: s.x,
          y: s.y,
          rank: s.rank,
          modifiers: s.modifiers,
          areaLevel: plan.plan.monsterLevel,
          statSeed: (room.seed ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0,
        })
      }
    }
  }

  /**
   * Spawn a `SuperUniques.txt` boss (DRLG preset `type 1`, index `>= MonStats count`)
   * with its `Mod1..Mod3` affixes and `MinGrp..MaxGrp` minions (`MonStats.txt`
   * `minion1`/`minion2`, or its own class when it has none).
   *
   * @returns the unit ids, boss first.
   */
  spawnSuperUnique(spec: {
    readonly superUniqueIndex: number
    readonly x: number
    readonly y: number
    readonly areaId?: number | undefined
  }): number[] {
    const su = getSuperUniqueByIndex(spec.superUniqueIndex)
    if (!su) {
      throw new Error(`SuperUniques.txt has no row ${String(spec.superUniqueIndex)}`)
    }
    const diffName =
      this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
    const kinds = getCanonicalMonsterKinds(diffName)
    const bossKind = kinds.get(su.monsterId)
    if (!bossKind) {
      throw new Error(`SuperUnique ${su.id}: Class '${su.monsterId}' is not a MonStats.txt Id`)
    }
    const areaId = spec.areaId ?? this.defaultAreaId ?? 1
    const levelPlan = getLevelMonsterPlan113c(areaId, diffName)
    const areaLevel = levelPlan?.monsterLevel
    // D2Game.dll 0x6FC454FC: Baal Throne wave bosses (SuperUniques 61..65) receive MONUMOD_QUESTCOMPLETE (22).
    const isBaalWaveBoss = spec.superUniqueIndex >= 61 && spec.superUniqueIndex <= 65
    const bossUMods = isBaalWaveBoss
      ? [...su.modifiers, MON_UMOD.QUESTCOMPLETE]
      : su.modifiers
    const ids: number[] = []
    ids.push(
      this.spawnMonster({
        classId: bossKind.hcIdx,
        name: su.name ?? su.nameKey,
        areaId,
        x: spec.x,
        y: spec.y,
        rank: 'superunique',
        superUniqueId: su.id,
        monUMods: bossUMods,
        areaLevel,
      }),
    )

    // D2Game.dll 0x6FC45382: when SuperUniques.txt MinGrp > 0, add +difficulty (0/1/2) to MinGrp and MaxGrp.
    const minionIds = CANONICAL_BOSS_MINIONS[su.id] ?? [su.monsterId]
    const diffBonus = su.minMinions > 0 ? this.difficulty : 0
    const minMinions = Math.max(0, su.minMinions + diffBonus)
    const maxMinions = Math.max(minMinions, su.maxMinions + diffBonus)
    const count = minMinions + this.rng.rand(maxMinions - minMinions + 1)
    const extraColdMageCount = spec.superUniqueIndex === 62 ? 10 : 0
    const totalNeeded = count + extraColdMageCount
    const offsets: (readonly [number, number])[] = []
    for (let r = 1; r <= 5 && offsets.length < Math.max(totalNeeded * 4, 24); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r) offsets.push([dx, dy])
        }
      }
    }
    let placed = 0
    let offsetCursor = 0
    for (; offsetCursor < offsets.length && placed < count; offsetCursor++) {
      const [dx, dy] = offsets[offsetCursor]!
      const x = Math.round(spec.x) + dx
      const y = Math.round(spec.y) + dy
      if (this.terrainWalkableCheck && !this.terrainWalkableCheck(areaId, x, y, false)) continue
      const minionId = minionIds[this.rng.rand(minionIds.length)]!
      const minionKind = kinds.get(minionId)
      if (!minionKind) {
        throw new Error(`SuperUnique ${su.id}: minion '${minionId}' is not a MonStats.txt Id`)
      }
      ids.push(
        this.spawnMonster({
          classId: minionKind.hcIdx,
          areaId,
          x,
          y,
          rank: 'minion',
          areaLevel,
        }),
      )
      placed++
    }
    // D2Game.dll 0x6FC456CB -> sub_6FD0DE90(pGame, pRoom, x, y, 381, 1, 5, 0):
    // Wave 2 (SuperUnique 62, Achmel the Cursed / Baal Subject 2) spawns a hardcoded extra pack
    // of 10 Burning Dead Mages (skmage_cold3, hcIdx = 381).
    if (extraColdMageCount > 0) {
      let extraPlaced = 0
      for (; offsetCursor < offsets.length && extraPlaced < extraColdMageCount; offsetCursor++) {
        const [dx, dy] = offsets[offsetCursor]!
        const x = Math.round(spec.x) + dx
        const y = Math.round(spec.y) + dy
        if (this.terrainWalkableCheck && !this.terrainWalkableCheck(areaId, x, y, false)) continue
        ids.push(
          this.spawnMonster({
            classId: 381,
            areaId,
            x,
            y,
            rank: 'minion',
            areaLevel,
          }),
        )
        extraPlaced++
      }
    }
    return ids
  }

  stepFrame(): Map<number, readonly ServerEvent[]> {
    for (let i = this.pendingObjectSpawns.length - 1; i >= 0; i--) {
      const pending = this.pendingObjectSpawns[i]!
      if (this.currentFrame < pending.frame) continue
      this.pendingObjectSpawns.splice(i, 1)
      this.spawnObject({
        classId: pending.classId,
        x: pending.x,
        y: pending.y,
        areaId: pending.areaId,
        mode: 1,
        ...(pending.destAreaId !== undefined ? { destAreaId: pending.destAreaId } : {}),
      })
    }
    for (let i = this.pendingObjectModeTransitions.length - 1; i >= 0; i--) {
      const pending = this.pendingObjectModeTransitions[i]!
      if (this.currentFrame < pending.frame) continue
      this.pendingObjectModeTransitions.splice(i, 1)
      const obj = this.objects.get(pending.unitId)
      if (obj !== undefined) {
        this.setObjectMode(obj, pending.mode)
      }
    }

    // Drain queued C2S commands in deterministic FIFO order; control commands
    // (`PauseGame` and `/players N` chat commands) execute even around pause transitions.
    const pending = this.commandQueue.splice(0, this.commandQueue.length)
    const deferredWhilePaused: QueuedPlayerCommand[] = []
    for (const item of pending) {
      const { playerUnitId, command } = item
      const player = this.players.get(playerUnitId)
      if (!player) continue
      if (command.type === 'PauseGame') {
        this.setPaused(Boolean(command.paused))
        continue
      }
      const isPlayersChat =
        command.type === 'Chat' &&
        /^\s*\/players\s*:?\s*\d+\s*$/i.test(command.text)
      if (this.pausedState && !isPlayersChat) {
        deferredWhilePaused.push(item)
        continue
      }
      try {
        this.processPlayerCommand(player, command)
      } catch (err) {
        // A malformed command must not abort the whole 25 Hz frame for every player.
        this.emitToPlayer(playerUnitId, {
          type: 'Chat',
          kind: 'system',
          text: `Command failed: ${command.type}`,
        })
      }
    }
    this.stepPendingInteractions()
    if (deferredWhilePaused.length > 0) {
      this.commandQueue.unshift(...deferredWhilePaused)
    }

    if (this.pausedState) {
      const pausedMap = new Map<number, readonly ServerEvent[]>()
      for (const [pid, queue] of this.outbox.entries()) {
        pausedMap.set(pid, [...queue])
      }
      return pausedMap
    }

    this.currentFrame++
    this.rng.nextUint32()

    // 2. Stream wilderness rooms & step player movement
    for (const player of this.players.values()) {
      this.streamWildernessRoomsForPlayer(player)
      if (player.dead) continue
      this.stepPlayerMovement(player)
      this.revealAreaRoomsNearPlayer(player, true)
      this.stepPlayerVitals(player)
      this.stepUnitStates(
        player.states,
        player.stateTimers,
        'player',
        player.unitId,
        player.areaId,
      )
    }

    // 2b. Persistent combat states (skill buffs / curses / auras) and aura pulses
    this.stepPersistentCombatStates()
    this.stepPlayerAuras()

    // 3. Step missiles & collision
    this.stepMissiles()

    // Shrines return to their idle mode after Shrines.txt ResetTime.
    for (const obj of this.objects.values()) {
      if (obj.mode === 2 && obj.shrineResetFrame > 0 && this.currentFrame >= obj.shrineResetFrame) {
        obj.shrineResetFrame = 0
        this.setObjectMode(obj, 0)
      }
    }

    // 4. Step monster AI & state timers
    for (const monster of this.monsters.values()) {
      if (monster.dead) {
        this.resolvePendingDeathExplosion(monster)
        if (
          monster.pendingDropItems !== undefined &&
          this.currentFrame >= monster.pendingDropFrame
        ) {
          const items = monster.pendingDropItems
          monster.pendingDropItems = undefined
          this.spawnDroppedItems(items, monster.areaId, monster.x, monster.y)
        }
        continue
      }
      this.stepUnitStates(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
      )
      if (monster.frozenTicks > 0) {
        monster.frozenTicks =
          monster.states.has(1) || monster.states.has(29)
            ? Math.max(0, monster.frozenTicks - 1)
            : 0
      }
      if (monster.chillTicks > 0) {
        monster.chillTicks = monster.states.has(11)
          ? Math.max(0, monster.chillTicks - 1)
          : 0
      }
      if (!monster.isNpc) {
        this.stepMonsterPoison(monster)
        if (monster.dead) continue
        this.stepMonsterRegen(monster)
      }
      if (
        !monster.aiDisabled &&
        !monster.isNpc &&
        this.isMonsterInActiveAoi(monster)
      ) {
        this.stepMonsterAi(monster)
      }
      this.stepPendingMonsterAttack(monster)
      this.stepPendingAllyAttack(monster)
      this.stepPendingResurrection(monster)
    }

    // 5. Step mercenaries & summoned pets (F13)
    this.stepMercenaries()
    this.stepSummonedPets()

    const frameMap = new Map<number, readonly ServerEvent[]>()
    for (const [pid, queue] of this.outbox.entries()) {
      frameMap.set(pid, [...queue])
    }
    return frameMap
  }

  stepFrames(count: number): void {
    if (!Number.isFinite(count) || count <= 0) return
    const n = Math.floor(count)
    for (let i = 0; i < n; i++) {
      this.stepFrame()
    }
  }

  private processPlayerCommand(player: InternalPlayerRecord, cmd: ClientCommand): void {
    switch (cmd.type) {
      case 'Move': {
        if (player.dead) return
        const tx = cmd.to?.x ?? cmd.x ?? player.x
        const ty = cmd.to?.y ?? cmd.y ?? player.y
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = undefined
        player.targetX = tx
        player.targetY = ty
        player.run = cmd.run ?? true
        player.mode = player.run ? 3 : 2
        break
      }
      case 'WalkToLocation': {
        if (player.dead) return
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = undefined
        player.targetX = cmd.x
        player.targetY = cmd.y
        player.run = false
        player.mode = 2
        break
      }
      case 'RunToLocation': {
        if (player.dead) return
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = undefined
        player.targetX = cmd.x
        player.targetY = cmd.y
        player.run = true
        player.mode = 3
        break
      }
      case 'MoveToUnit':
      case 'WalkToTarget':
      case 'RunToTarget': {
        if (player.dead) return
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = undefined
        const targetId =
          cmd.type === 'MoveToUnit' ? cmd.target.id : cmd.unitId
        const pos = this.findUnitPosition(targetId, player.areaId)
        if (pos) {
          let targetX = pos.x
          let targetY = pos.y
          const warpTile = this.warpTiles.get(targetId)
          if (
            warpTile !== undefined &&
            warpTile.areaId === player.areaId &&
            this.loadedAreas.has(player.areaId) &&
            !this.isWorldWalkableForPlayer(player.areaId, targetX, targetY)
          ) {
            const stand = findStandableNear(
              (x, y) =>
                this.isWorldWalkableForPlayer(player.areaId, x, y) &&
                D2Common_10399_AtSubtiles(
                  warpTile.x,
                  warpTile.y,
                  0,
                  x,
                  y,
                  PLAYER_SIZE_X_113C,
                ) <= WARP_INTERACT_DISTANCE_SUBTILES &&
                this.hasInteractionLineOfSight(player.areaId, x, y, warpTile.x, warpTile.y),
              warpTile.x,
              warpTile.y,
              WARP_INTERACT_DISTANCE_SUBTILES,
            )
            if (stand !== null) {
              targetX = stand.x
              targetY = stand.y
            }
          }
          player.targetX = targetX
          player.targetY = targetY
          player.run =
            cmd.type === 'RunToTarget' ||
            (cmd.type === 'MoveToUnit' && cmd.run)
          player.mode = player.run ? 3 : 2
        }
        break
      }
      case 'SelectSkill': {
        const skillId = Number(cmd.skill ?? cmd.skillId ?? 0)
        if (cmd.hand === 'left') {
          player.leftSkill = skillId
        } else {
          player.rightSkill = skillId
        }
        this.emitToPlayer(player.unitId, {
          type: 'ActiveSkill',
          unitId: player.unitId,
          hand: cmd.hand,
          skill: skillId,
          itemId: cmd.itemId ?? 0xffffffff,
        })
        break
      }
      case 'CastSkillAtLocation':
      case 'CastLeftSkillOnLocation':
      case 'CastRightSkillOnLocation':
      case 'SkillAt': {
        if (player.dead) return
        const hand =
          cmd.type === 'CastLeftSkillOnLocation'
            ? 'left'
            : cmd.type === 'CastRightSkillOnLocation'
              ? 'right'
              : (cmd.hand ?? 'right')
        const tx = cmd.type === 'SkillAt' ? cmd.at.x : cmd.x
        const ty = cmd.type === 'SkillAt' ? cmd.at.y : cmd.y
        const explicitSkillId =
          cmd.type === 'CastSkillAtLocation' ? cmd.skillId : undefined
        const skillId =
          explicitSkillId !== undefined
            ? explicitSkillId
            : hand === 'left'
              ? player.leftSkill
              : player.rightSkill
        this.executeSkillAtLocation(player, skillId, tx, ty)
        break
      }
      case 'CastSkillOnTarget':
      case 'CastLeftSkillOnTarget':
      case 'CastRightSkillOnTarget':
      case 'SkillOn': {
        if (player.dead) return
        const hand =
          cmd.type === 'CastLeftSkillOnTarget'
            ? 'left'
            : cmd.type === 'CastRightSkillOnTarget'
              ? 'right'
              : (cmd.hand ?? 'right')
        const targetId =
          cmd.type === 'SkillOn'
            ? cmd.target.id
            : cmd.type === 'CastSkillOnTarget'
              ? Number(cmd.targetId ?? 0)
              : cmd.unitId
        const explicitSkillId =
          cmd.type === 'CastSkillOnTarget' ? cmd.skillId : undefined
        const skillId =
          explicitSkillId !== undefined
            ? explicitSkillId
            : hand === 'left'
              ? player.leftSkill
              : player.rightSkill
        this.executeSkillOnTarget(player, skillId, targetId)
        break
      }
      case 'Interact':
      case 'InteractEntity':
      case 'OperateObject': {
        if (player.dead) return
        const targetId =
          cmd.type === 'OperateObject'
            ? cmd.objectId
            : cmd.type === 'Interact'
              ? cmd.target.id
              : cmd.targetId
        // C2S 0x13 InteractUnit(5, warpId): `UNIT_TILE` warps (D2Client 0x6facafbd).
        const rawTargetType: unknown =
          cmd.type === 'Interact' ? cmd.target.unitType : cmd.type === 'InteractEntity' ? cmd.targetType : 2
        const isWarpTile = rawTargetType === 5 || rawTargetType === 'tile' || rawTargetType === 'warp'
        if (isWarpTile) {
          this.handleWarpTileInteract(player, targetId)
          break
        }
        this.handleInteract(player, targetId)
        break
      }
      case 'TakeWarp':
      case 'WarpTo': {
        if (player.dead) return
        this.handleWarpTileInteract(player, cmd.warpId)
        break
      }
      case 'WaypointGo': {
        if (player.dead) return
        if (cmd.destAreaId === 0 || cmd.destAreaId === player.areaId) {
          player.activeWaypointUnitId = 0
          if (player.pendingInteraction?.kind === 'waypoint') {
            player.pendingInteraction = undefined
          }
          return
        }
        if (!this.canUseWaypoint(player, cmd.destAreaId)) {
          if (player.activeWaypointUnitId !== 0) {
            // D2Game 0x6fcf0de4..0x6fcf0e61: walking away from an opened waypoint or
            // requesting an invalid destination clears the active waypoint session.
            player.activeWaypointUnitId = 0
            return
          }
          // 1.13c accepts a far WaypointGo by walking to the current waypoint.
          if (
            WAYPOINT_AREA_IDS.includes(cmd.destAreaId) &&
            player.waypoints.has(cmd.destAreaId) &&
            areaToAct(cmd.destAreaId) <= player.unlockedAct
          ) {
            const areaWaypoints = [...this.objects.values()].filter(
              (obj) => obj.areaId === player.areaId && obj.isWaypoint,
            )
            const wp =
              areaWaypoints.find((obj) => obj.unitId === cmd.waypointId) ??
              areaWaypoints[0]
            if (
              wp !== undefined &&
              !areaWaypoints.some(
                (obj) =>
                  Math.hypot(obj.x - player.x, obj.y - player.y) <=
                  WAYPOINT_INTERACT_DISTANCE_SUBTILES,
              )
            ) {
              player.pendingInteraction = {
                kind: 'waypoint',
                id: wp.unitId,
                destAreaId: cmd.destAreaId,
              }
              player.pendingInteractionSteps = 0
            }
          }
          return
        }
        this.transitionPlayerArea(player, cmd.destAreaId, { kind: 'waypoint' })
        break
      }
      case 'TownPortal': {
        if (player.dead) return
        this.openTownPortal(player)
        break
      }
      case 'ItemPickup':
      case 'PickUpItem': {
        if (player.dead) return
        this.handleItemPickup(player, cmd.itemId, Boolean(cmd.toCursor))
        break
      }
      case 'ItemToCursor': {
        if (player.dead) return
        this.handleItemToCursor(player, cmd.itemId)
        break
      }
      case 'ItemDrop': {
        if (player.dead) return
        this.handleItemDrop(player, cmd.itemId)
        break
      }
      case 'ItemPlace':
      case 'ItemMove': {
        if (player.dead) return
        const rawContainer =
          cmd.type === 'ItemMove'
            ? (cmd.container ?? 'inventory')
            : cmd.buffer === 4
              ? 'stash'
              : cmd.buffer === 3
                ? 'cube'
                : 'inventory'
        const container: 'inventory' | 'stash' | 'cube' | 'belt' =
          rawContainer === 'stash' || rawContainer === 'cube' || rawContainer === 'belt'
            ? rawContainer
            : 'inventory'
        this.handleItemMove(player, cmd.itemId, cmd.x, cmd.y, container)
        break
      }
      case 'ItemEquip':
      case 'ItemSwap':
      case 'ItemSwap2Handed':
      case 'ItemSwap2HandedDual': {
        if (player.dead) return
        const slot = Number(cmd.slot ?? (cmd as { bodyLoc?: number }).bodyLoc ?? 1)
        const removeOppositeHand =
          cmd.type === 'ItemSwap2Handed' || cmd.type === 'ItemSwap2HandedDual'
        this.handleItemEquip(player, cmd.itemId, slot, removeOppositeHand)
        break
      }
      case 'ItemUnequip': {
        if (player.dead) return
        this.handleItemUnequip(player, cmd.slot)
        break
      }
      case 'BeltPut': {
        if (player.dead) return
        this.handleBeltPut(player, cmd.itemId, cmd.slot)
        break
      }
      case 'BeltRemove':
      case 'BeltUse':
      case 'ItemUse': {
        if (player.dead) return
        this.handleBeltUse(player, cmd.itemId)
        break
      }
      case 'NpcInit':
      case 'NpcHeal': {
        const npcId = cmd.type === 'NpcHeal' ? cmd.npcId : cmd.target.id
        this.handleNpcInteract(player, npcId, cmd.type === 'NpcHeal')
        break
      }
      case 'NpcCancel': {
        player.activeNpcId = undefined
        player.activeVendorMode = null
        break
      }
      case 'NpcOpenTrade':
      case 'NpcOpenGamble':
      case 'NpcEntityAction':
      case 'NpcAction': {
        const npcId = cmd.npcId
        const complement =
          cmd.type === 'NpcAction' || cmd.type === 'NpcEntityAction'
            ? cmd.complement
            : undefined
        const travelAction = 'action' in cmd && cmd.action === 0
        if (
          (cmd.type === 'NpcEntityAction' || cmd.type === 'NpcAction') &&
          travelAction &&
          (complement === undefined || complement === 0) &&
          this.handleAkaraRespec(player, npcId)
        ) {
          break
        }
        if (
          cmd.type === 'NpcEntityAction' &&
          travelAction &&
          complement !== undefined &&
          (this.handleCursorArtisanService(player, npcId, complement) ||
            this.handleArtisanService(player, npcId, complement))
        ) {
          break
        }
        if (
          complement !== undefined &&
          ACT_TOWN_AREAS.includes(complement) &&
          travelAction
        ) {
          this.handleNpcTravel(player, npcId, complement)
          break
        }
        const actionType =
          cmd.type === 'NpcAction' || cmd.type === 'NpcEntityAction'
            ? cmd.action
            : cmd.type === 'NpcOpenGamble'
              ? 'gamble'
              : 'trade'
        if (actionType === 'heal' || actionType === 0) {
          this.handleNpcInteract(player, npcId, actionType === 'heal')
        } else if (Number(actionType) === 3) {
          this.handleNpcHireList(player, npcId)
        } else {
          this.handleNpcAction(player, npcId, actionType === 'gamble')
        }
        break
      }
      case 'NpcBuy':
      case 'NpcGamble': {
        const isGamble =
          cmd.type === 'NpcGamble' || Boolean(cmd.gamble ?? cmd.buyType === 2)
        const explicitCost = cmd.type === 'NpcBuy' ? cmd.cost : undefined
        this.handleNpcBuy(player, cmd.npcId, cmd.itemId, isGamble, explicitCost)
        break
      }
      case 'NpcSell': {
        this.handleNpcSell(player, cmd.npcId, cmd.itemId)
        break
      }
      case 'NpcRepairItem': {
        this.handleNpcRepair(player, cmd.npcId, cmd.itemId)
        break
      }
      case 'NpcRepairAll': {
        this.handleNpcRepair(player, cmd.npcId)
        break
      }
      case 'NpcIdentifyAll': {
        this.handleNpcIdentifyAll(player, cmd.npcId)
        break
      }
      case 'NpcIdentifyGamble': {
        this.handleNpcIdentifyItem(player, player.activeNpcId ?? 0, cmd.itemId)
        break
      }
      case 'HireMerc':
      case 'MercHire': {
        this.handleNpcHire(player, cmd.npcId, cmd.mercId)
        break
      }
      case 'NpcResurrectMerc':
      case 'MercResurrect': {
        this.handleMercResurrect(player, cmd.npcId)
        break
      }
      case 'AddStatPoint':
      case 'AllocateStat': {
        const amount =
          cmd.type === 'AllocateStat'
            ? (cmd.amount ?? cmd.count ?? 1)
            : (cmd.count ?? 1)
        this.handleAllocateStat(player, cmd.statId, Math.max(1, amount))
        break
      }
      case 'AddSkillPoint':
      case 'AllocateSkill': {
        this.handleAllocateSkill(player, cmd.skillId)
        break
      }
      case 'Resurrect':
      case 'Respawn': {
        this.handleRespawn(player)
        break
      }
      case 'Party':
      case 'PartyAction': {
        this.handlePartyCommand(player, cmd.action, cmd.targetPlayerId)
        break
      }
      case 'Chat': {
        this.handleChatCommand(player, cmd.text, cmd.whisperTo)
        break
      }
      case 'UpdatePlayerPos': {
        this.handleUpdatePlayerPos(player, cmd.x, cmd.y)
        break
      }
      default:
        break
    }
  }

  /**
   * Advance one player by one 25Hz tick (issue #1329).
   *
   * Uses the same {@link LocalMovementPredictor} as the client, so the server matches the
   * client's D2Common 1.13c step (walk 9.0 / run 13.5 sub-tiles per second = 0.36 / 0.54 per
   * tick, run bonus dropped when stamina is exhausted) and follows the same `findPathWorld`
   * waypoints (size-2 `+` footprint) against the area collision callback, halting at walls.
   *
   * Broadcast rules: the walk/run `UnitMove` goes to the other players in the area only — D2Game
   * skips the moving player's own client for its stand/walk/run messages (D2MOO `PlrMsg.cpp`,
   * `stru_6FD30708`); the owner predicts locally and is checked through `LifeMana` positions
   * (D2Client tolerance gate 0x6FADA1B0 → C2S `0x5F` → S2C `0x15`).
   */
  private stepPlayerMovement(player: InternalPlayerRecord): void {
    this.ensureAdjacentAreasLoaded(player.areaId)
    const motion = this.getPlayerMotion(player)
    const mover = motion.mover

    // Another system (area change, teleport, respawn, `0x5F` warp, `movePlayer`) moved the
    // player since the last step: restart from the new position.
    if (player.x !== motion.x || player.y !== motion.y) {
      mover.setPosition(player.x, player.y)
      motion.x = player.x
      motion.y = player.y
      motion.moving = false
      motion.plannedX = Number.NaN
      motion.plannedY = Number.NaN
    }

    const hasTarget = Math.hypot(player.targetX - player.x, player.targetY - player.y) > 0.01
    if (hasTarget && (player.targetX !== motion.plannedX || player.targetY !== motion.plannedY)) {
      motion.plannedX = player.targetX
      motion.plannedY = player.targetY
      const areaId = player.areaId
      mover.setCollisionChecker(
        this.terrainWalkableCheck ? (sx, sy) => this.isPlayerSubTileBlocked(areaId, sx, sy) : null,
      )
      mover.setPath(
        this.findPlayerPath(
          areaId,
          Math.round(player.x),
          Math.round(player.y),
          player.targetX,
          player.targetY,
        ),
        player.run,
      )
      motion.moving = true
    }

    // STAT_STAMINA == 0: running degrades to walking (D2Client checks the same stat before
    // sending run, `CommandMapper.isStaminaExhausted`; the predictor drops the run bonus).
    this.applyPlayerVelocityModifiers(player, mover)
    const staminaExhausted =
      player.staminaExhausted || player.stamina <= 0 || player.staminaFixed <= 0
    mover.setStaminaExhausted(staminaExhausted)
    if (staminaExhausted && player.run) {
      player.run = false
      if (motion.moving) player.mode = 2
    }
    mover.setRunning(player.run)

    if (mover.getRemainingWaypoints().length === 0) {
      if (motion.moving) {
        this.finishPlayerMove(player, motion)
      } else if (!hasTarget) {
        player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
      }
      return
    }

    const snap = mover.stepTicks(1)
    player.x = snap.logicalX
    player.y = snap.logicalY
    motion.x = player.x
    motion.y = player.y
    this.maybeSwitchPlayerAreaSeamless(player)

    const segmentEnd = snap.currentWaypoint
    if (segmentEnd === null) {
      this.finishPlayerMove(player, motion)
    } else {
      const toX = Math.round(segmentEnd.x)
      const toY = Math.round(segmentEnd.y)
      const velocityPercent = Math.round(
        (mover.getEffectiveSpeedSubTilesPerSec() / D2_BASE_WALK_SUBTILES_PER_SEC) * 100,
      )
      this.broadcastToAreaExcept(player.areaId, player.unitId, {
        type: 'UnitMove',
        unitType: 0,
        id: player.unitId,
        unitId: player.unitId,
        mode: player.run ? 'run' : 'walk',
        from: { x: Math.round(player.x), y: Math.round(player.y) },
        to: { x: toX, y: toY },
        x: Math.round(player.x),
        y: Math.round(player.y),
        currentX: Math.round(player.x),
        currentY: Math.round(player.y),
        targetX: toX,
        targetY: toY,
        velocityPercent,
      })
    }

    if (player.corpseId !== undefined && player.corpseItems.length > 0) {
      const cDist = Math.hypot(player.x - player.corpseX, player.y - player.corpseY)
      if (
        cDist <= 3 &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, player.corpseX, player.corpseY)
      ) {
        this.recoverPlayerCorpse(player)
      }
    }
  }

  /**
   * Resolve a player skill cast through the canonical 1.13c skill registry (#1328): the `Skills.txt`
   * row, `evaluateSkill113c` numbers (mana cost, 5-band physical/elemental damage with synergies,
   * `delay` cooldown) and the server `Missiles.txt` row named by `srvmissile` / `srvmissilea`.
   * Returns `null` when D2Game refuses the cast (unknown row, passive skill, `InTown = 0` in town,
   * insufficient mana, `delay` cooldown still running).
   */
  private resolvePlayerSkillCast(
    player: InternalPlayerRecord,
    skillId: number,
  ): PlayerSkillCast | null {
    if (this.registry.getSkillById(0) === undefined) {
      throw new Error(
        'GameInstance: Skills.txt is not loaded in the data registry; player skill casts cannot be resolved',
      )
    }
    const skill = this.registry.getSkillById(skillId)
    // Unknown Skills.txt row (malformed client command) or passive skill: D2Game drops the cast.
    if (skill === undefined || skill.passive) return null
    if (!skill.inTown && TOWN_AREAS.has(player.areaId)) return null
    const readyFrame = this.playerSkillReadyFrame.get(player.unitId)?.get(skillId)
    if (readyFrame !== undefined && this.currentFrame < readyFrame) return null
    if (!this.playerMeetsSkillRestrict(player, skill)) return null

    // D2Game only casts skills present in the player's skill list: hard points / +skill items on
    // class skills, `item_nonclassskill` oskills, or the universal default skills. Otherwise an
    // equipped `item_charged_skill` (204) with charges left casts it at the charge level.
    let slvl = this.resolvePlayerSkillLevel(player, skill)
    let chargeItem: ServerItemEntry | undefined
    if (slvl <= 0) {
      const charged = findChargedSkill(player.items, skill.id)
      if (charged === undefined) return null
      slvl = charged.slvl
      chargeItem = charged.item
    }
    const statList = new UnitStatList(this.registry, {
      level: player.level,
      strength: player.strength,
      dexterity: player.dexterity,
      vitality: player.vitality,
      energy: player.energy,
    })
    for (const [id, lvl] of player.skills) {
      statList.setBaseSkillLevel(id, lvl)
    }
    const blvl = player.skills.get(skillId) ?? 0
    if (slvl > blvl) statList.setBonusSkillLevel(skillId, slvl - blvl)
    const evalResult = evaluateSkill113c({
      registry: this.registry,
      skill,
      slvl,
      blvl,
      statList,
      difficulty: this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0,
    })
    if (chargeItem === undefined && player.manaFixed < evalResult.manaCost256) return null

    const missileName = resolvePlayerServerMissileName(skill, evalResult)
    let missile: MissileRecord | undefined
    if (missileName !== '') {
      missile = this.registry.getMissileByName(missileName)
      if (missile === undefined) {
        throw new Error(
          `GameInstance: Skills.txt row ${skillId} (${skill.name}) references unknown Missiles.txt row "${missileName}"`,
        )
      }
    }
    return { skill, slvl, evalResult, missile, chargeItem, statList, blvl }
  }

  /**
   * Evaluate a `Skills.txt` calc cell (`calc1..calc4`, `DmgSymPerCalc`, ...) for a resolved cast with
   * the same context as `evaluateSkillCore113c` (`lvl` = cast slvl, `blvl`, caster stats). Empty = 0.
   */
  private evaluatePlayerSkillCalc(cast: PlayerSkillCast, expr: string): number {
    if (expr.trim() === '') return 0
    const statList = cast.statList
    return evaluateCalc(expr, {
      registry: this.registry,
      activeSkill: cast.skill,
      slvl: Math.max(1, cast.slvl),
      blvl: cast.blvl,
      ulvl: statList.getAccruedStat('level'),
      getBaseSkillLevel: (id: number) => statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => statList.getEffectiveSkillLevel(id),
      getUnitStat: (statNameOrId: string | number, baseOnly?: boolean) => statList.getAccruedStat(statNameOrId, baseOnly),
    })
  }

  /**
   * Effective level of `skill` in the player's skill list (0 = not castable):
   * - universal default skills (Attack, Kick, Throw, Unsummon, Left Hand Throw/Swing, scroll/book
   *   Identify & Town Portal) are always level 1;
   * - own-class skills need hard points (`player.skills`), then add `item_allskills` (127),
   *   `item_addclassskills` (83, param = class), `item_addskill_tab` (188, param =
   *   `SkillDesc.SkillPage - 1 + 8 * class`, `skillTabStatParam`), `item_singleskill` (107, param =
   *   skill) and `item_nonclassskill` (97, param = skill); without hard points only an oskill grants it;
   * - other-class / monster rows are only castable through `item_nonclassskill` oskills.
   */
  private resolvePlayerSkillLevel(player: InternalPlayerRecord, skill: SkillRecord): number {
    if (UNIVERSAL_PLAYER_SKILL_IDS.has(skill.id)) return 1
    const tabParam = this.resolveSkillTabParam(skill)
    let allSkills = 0
    let classSkills = 0
    let tabSkills = 0
    let singleSkill = 0
    let oskill = 0
    for (const stat of collectEquippedItemStats(player.items)) {
      if (stat.statId === STAT_ITEM_ALLSKILLS) allSkills += stat.value
      else if (stat.statId === STAT_ITEM_ADDCLASSSKILLS && stat.param === player.classId) classSkills += stat.value
      else if (
        stat.statId === STAT_ITEM_ADDSKILL_TAB &&
        tabParam !== undefined &&
        decodeSkillTabParam(stat.param) !== undefined &&
        stat.param === tabParam
      ) {
        tabSkills += stat.value
      } else if (stat.statId === STAT_ITEM_SINGLESKILL && stat.param === skill.id) singleSkill += stat.value
      else if (stat.statId === STAT_ITEM_NONCLASSSKILL && stat.param === skill.id) oskill += stat.value
    }
    const hardPoints = player.skills.get(skill.id) ?? 0
    if (skill.charClass === player.classCode && hardPoints > 0) {
      return hardPoints + allSkills + classSkills + tabSkills + singleSkill + oskill
    }
    return Math.max(0, oskill)
  }

  /**
   * Stat 188 param of the skill's tab: `SkillDesc.txt` `SkillPage` (1..3) of the row named by
   * `Skills.txt` `skilldesc`, on the class from `CharStats` order. `undefined` for skills without a
   * class tab (universal / monster rows).
   */
  private resolveSkillTabParam(skill: SkillRecord): number | undefined {
    const classId = CLASS_CODE_TO_ID[skill.charClass]
    if (classId === undefined || skill.skillDesc === '') return undefined
    const desc = this.registry.getSkillDesc(skill.skillDesc)
    if (desc === undefined) {
      throw new Error(`GameInstance: Skills.txt row ${skill.id} references unknown SkillDesc.txt row "${skill.skillDesc}"`)
    }
    const page = Number(desc['SkillPage'] ?? '')
    if (!Number.isInteger(page) || page < 1 || page > 3) return undefined
    return skillTabStatParam(classId, page - 1)
  }

  /**
   * `Skills.txt` `restrict` against the shapeshift states (`States.txt` `wolf` / `bear`):
   * 0 = refused while shapeshifted, 1 = allowed in any form, 2 = requires `State1..3`.
   */
  private playerMeetsSkillRestrict(player: InternalPlayerRecord, skill: SkillRecord): boolean {
    const hasStateNamed = (name: string): boolean => {
      if (name === '') return false
      const rec = this.registry.getStateByName(name)
      if (rec === undefined) {
        throw new Error(`GameInstance: Skills.txt row ${skill.id} references unknown States.txt row "${name}"`)
      }
      return player.states.has(rec.id)
    }
    if (skill.restrict === 2) {
      return hasStateNamed(skill.state1) || hasStateNamed(skill.state2) || hasStateNamed(skill.state3)
    }
    if (skill.restrict === 0) {
      return !hasStateNamed('wolf') && !hasStateNamed('bear')
    }
    return true
  }

  /**
   * Physical damage range of the equipped weapon (`Weapons.txt` via `resolveWeaponBase113c`):
   * one- or two-handed `MinDam/MaxDam`, on-weapon `item_maxdamage_percent` (17) and flat
   * `item_mindamage` / `item_maxdamage` (21 / 22), scaled by the `StrBonus` / `DexBonus` stat
   * bonus (`calculatePhysicalWeaponDamage`). Unarmed players hit for 1-2 (`getAttackWeaponInfo`).
   */
  private resolvePlayerWeaponDamage(player: InternalPlayerRecord): { min: number; max: number } {
    const equipped = player.items.filter((i) => i.location === 'equipped')
    const handItem = (loc: number) => equipped.find((i) => i.bodyLoc === loc)
    const right = handItem(BODYLOC_RIGHT_ARM)
    const left = handItem(BODYLOC_LEFT_ARM)
    const rightBase = right ? resolveWeaponBase113c(right.code) : undefined
    const leftBase = left ? resolveWeaponBase113c(left.code) : undefined
    const weapon = rightBase ? right : leftBase ? left : undefined
    const base = rightBase ?? leftBase
    // Off-weapon %ED from skill buffs / auras (Might, Fanaticism, Battle Orders' party, ...) carried
    // by the persistent combat bus; a player that never received a state has none.
    const combat = this.playerCombat.get(player.unitId)
    const offWeaponEdPercent = combat === undefined ? 0 : combat.statList.getModifierBonus('damagepercent')
    if (weapon === undefined || base === undefined) {
      const unarmed = getAttackWeaponInfo(null)
      const range = calculatePhysicalWeaponDamage({
        weaponBaseMin: unarmed.damageMin,
        weaponBaseMax: unarmed.damageMax,
        offWeaponEdPercent,
      })
      return { min: range.finalMinDamage, max: Math.max(range.finalMinDamage, range.finalMaxDamage) }
    }
    const otherHand = weapon === right ? left : right
    const useTwoHand =
      base.twoHanded &&
      base.twoHandedMindam !== undefined &&
      base.twoHandedMaxdam !== undefined &&
      (!base.oneOrTwoHanded || otherHand === undefined)
    const weaponMin = useTwoHand ? base.twoHandedMindam! : base.mindam
    const weaponMax = useTwoHand ? base.twoHandedMaxdam! : base.maxdam
    let onWeaponEd = 0
    let flatMin = 0
    let flatMax = 0
    for (const stat of collectItemStats(weapon)) {
      if (stat.statId === STAT_ITEM_MAXDAMAGE_PERCENT) onWeaponEd += stat.value
      else if (stat.statId === (useTwoHand ? STAT_SECONDARY_MINDAMAGE : STAT_MINDAMAGE)) flatMin += stat.value
      else if (stat.statId === (useTwoHand ? STAT_SECONDARY_MAXDAMAGE : STAT_MAXDAMAGE)) flatMax += stat.value
    }
    const statBonusPercent =
      Math.floor((player.strength * base.strBonus) / 100) +
      Math.floor((player.dexterity * base.dexBonus) / 100)
    const minRange = calculatePhysicalWeaponDamage({
      weaponBaseMin: weaponMin,
      weaponBaseMax: weaponMin,
      onWeaponEdPercent: onWeaponEd,
      flatDamage: flatMin,
      offWeaponEdPercent,
      statBonusPercent,
    })
    const maxRange = calculatePhysicalWeaponDamage({
      weaponBaseMin: weaponMax,
      weaponBaseMax: weaponMax,
      onWeaponEdPercent: onWeaponEd,
      flatDamage: flatMax,
      offWeaponEdPercent,
      statBonusPercent,
    })
    const min = Math.max(1, minRange.finalMinDamage)
    return { min, max: Math.max(min, maxRange.finalMaxDamage) }
  }

  /** Spend the `Skills.txt` mana cost (256-fixed) and arm the `delay` cooldown of an accepted cast. */
  private commitPlayerSkillCast(player: InternalPlayerRecord, cast: PlayerSkillCast): void {
    if (cast.chargeItem !== undefined) {
      // Charged casts cost a charge instead of mana.
      consumeSkillCharge(cast.chargeItem, cast.skill.id)
    }
    const cost256 = cast.chargeItem !== undefined ? 0 : cast.evalResult.manaCost256
    if (cost256 > 0) {
      player.manaFixed = Math.max(0, player.manaFixed - cost256)
      player.mana = Math.floor(player.manaFixed / FIXED_ONE)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 8,
        value: player.manaFixed,
      })
    }
    if (cast.evalResult.cooldownFrames > 0) {
      let ready = this.playerSkillReadyFrame.get(player.unitId)
      if (ready === undefined) {
        ready = new Map()
        this.playerSkillReadyFrame.set(player.unitId, ready)
      }
      ready.set(cast.skill.id, this.currentFrame + cast.evalResult.cooldownFrames)
    }
  }

  /**
   * Roll the damage of one cast from the registry evaluation: weapon-sourced part (`SrcDam`/128 of the
   * base hit, scaled by the skill's `%ED`), plus the `MinDam..MaxDam` physical band and the
   * `EMin..EMax` elemental band (only when `Skills.txt` / `Missiles.txt` define an `EType`, so buff
   * parameters stored in `EMin` such as Inner Sight or Energy Shield never turn into damage).
   */
  private rollPlayerSkillPhysDamage(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    physDamagePctOverride?: number,
  ): number {
    const ev = cast.evalResult
    let total = 0
    if (ev.srcDam > 0) {
      const weapon = this.resolvePlayerWeaponDamage(player)
      const weaponHit = Math.trunc((this.rollInclusive(weapon.min, weapon.max) * ev.srcDam) / 128)
      const edPct = physDamagePctOverride ?? ev.physDamagePct
      total += Math.trunc((weaponHit * (100 + edPct)) / 100)
    }
    total += this.rollInclusive(ev.minPhysDmg, ev.maxPhysDmg)
    return total
  }

  private rollPlayerSkillDamage(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    physDamagePctOverride?: number,
  ): number {
    const ev = cast.evalResult
    let total = this.rollPlayerSkillPhysDamage(player, cast, physDamagePctOverride)
    const hasElemType = cast.skill.eType !== '' || (cast.missile?.eType ?? '') !== ''
    if (hasElemType) {
      total += this.rollInclusive(ev.minElemDmg, ev.maxElemDmg)
    }
    return total
  }

  private rollInclusive(min: number, max: number): number {
    const lo = Math.max(0, Math.trunc(min))
    const hi = Math.max(lo, Math.trunc(max))
    return hi > lo ? lo + this.rng.rand(hi - lo + 1) : lo
  }

  /** Broadcast the 0x4D (location) / 0x4C (unit) cast so every client plays the caster's cast sequence. */
  private broadcastPlayerSkillCast(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    target: { readonly x: number; readonly y: number } | { readonly unitType: UnitType; readonly id: number },
  ): void {
    this.broadcastToArea(player.areaId, {
      type: 'SkillCast',
      caster: { unitType: 0, id: player.unitId },
      skill: cast.skill.id,
      skillId: cast.skill.id,
      level: cast.slvl,
      target,
    })
  }

  /**
   * Launch the skill's server missile (`Missiles.txt` row id, `Range` + `LevRange` lifetime). Missiles
   * with `Vel = 0` (Meteor / Blizzard / Fist of the Heavens centres, Blaze, ...) are created at the
   * target location, all others fly from the caster toward it.
   */
  private launchPlayerSkillMissile(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    missileRec: MissileRecord,
    tx: number,
    ty: number,
    damage: number,
  ): void {
    const stationary = missileRec.vel <= 0
    const startX = stationary ? tx : player.x
    const startY = stationary ? ty : player.y
    const dx = tx - player.x
    const dy = ty - player.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    const speed = stationary ? 0 : PLAYER_MISSILE_SPEED_SUBTILES
    const lifetime = Math.max(1, missileRec.range + missileRec.levRange * (cast.slvl - 1))
    const missileUnitId = this.allocateUnitId()
    const isPoisonSkillMissile =
      damage > 0 &&
      (normalizeMissileElement(missileRec.eType || cast.skill.eType) === 'pois' ||
        cast.evalResult.elemType === 'pois') &&
      cast.evalResult.durationFrames > 0
    const poisonBitrate256 = isPoisonSkillMissile
      ? this.rollInclusive(cast.evalResult.minElemDmg256, cast.evalResult.maxElemDmg256)
      : 0
    const physDamage = isPoisonSkillMissile ? this.rollPlayerSkillPhysDamage(player, cast) : damage
    const elemDurationFrames = isPoisonSkillMissile ? cast.evalResult.durationFrames : 0
    const elemDamage = isPoisonSkillMissile
      ? Math.floor((poisonBitrate256 * elemDurationFrames) / FIXED_ONE)
      : 0
    const missile: InternalMissileRecord = {
      unitId: missileUnitId,
      missileId: missileRec.id,
      skillId: cast.skill.id,
      ownerType: 'player',
      ownerId: player.unitId,
      areaId: player.areaId,
      x: startX,
      y: startY,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      damage,
      remainingFrames: lifetime,
      collideType: missileRec.collideType,
      size: Math.max(1, missileRec.size),
      pierce: missileRec.pierce,
      nextHit: missileRec.nextHit,
      nextDelay: Math.max(0, missileRec.nextDelay),
      element:
        normalizeMissileElement(missileRec.eType || cast.skill.eType) ?? 'phys',
      physDamage,
      elemDamage,
      elemDurationFrames,
      ...(isPoisonSkillMissile ? { poisonBitrate256 } : {}),
      hitCooldowns: new Map(),
      guaranteedHit: false,
    }
    // Zero-damage missiles (warcry / curse / buff carriers) are visual only: they must never collide
    // and run the `applyDamageToMonster` minimum-1 hit path.
    if (damage > 0) {
      this.missiles.set(missileUnitId, missile)
    }

    this.broadcastToArea(player.areaId, {
      type: 'CreateMissile',
      missileId: missileUnitId,
      missileClassId: missileRec.id,
      at: { x: Math.round(startX), y: Math.round(startY) },
      target: { x: Math.round(tx), y: Math.round(ty) },
      x: Math.round(startX),
      y: Math.round(startY),
      targetX: Math.round(tx),
      targetY: Math.round(ty),
      skillId: cast.skill.id,
      level: cast.slvl,
      ownerType: 0,
      ownerUnitType: 'player',
      ownerId: player.unitId,
      areaId: player.areaId,
    } as ServerEvent)
  }

  /** Static Field (`srvdofunc` 20): hits every hostile within the evaluated radius around the caster. */
  private applyStaticField(player: InternalPlayerRecord, cast: PlayerSkillCast): void {
    const radius = cast.evalResult.radiusSubtiles
    for (const m of this.monsters.values()) {
      if (m.dead || m.isNpc || m.areaId !== player.areaId) continue
      if (Math.hypot(m.x - player.x, m.y - player.y) <= radius) {
        this.applyDamageToMonster(player, m, 0, cast.skill.id)
      }
    }
  }

  /**
   * Nova ring (`srvdofunc` 22: Frost Nova 44, Nova 48, Poison Nova 92): radial ring of bolts
   * expanding 360° from the caster's position (`D2Game.dll` `srvdofunc` 22). Hits every hostile
   * within the missile ring expansion radius around `(player.x, player.y)`.
   */
  private executeNovaSkill(player: InternalPlayerRecord, cast: PlayerSkillCast): void {
    const msl = cast.missile
    const ringRadius =
      msl !== undefined
        ? Math.max(9, Math.round(((msl.vel || 16) * (msl.range || 14)) / 20))
        : 9
    for (const m of [...this.monsters.values()]) {
      if (m.dead || m.isNpc || m.areaId !== player.areaId) continue
      if (Math.hypot(m.x - player.x, m.y - player.y) <= ringRadius) {
        if (cast.evalResult.elemType === 'pois' && cast.evalResult.durationFrames > 0) {
          const bitrate256 = this.rollInclusive(
            cast.evalResult.minElemDmg256,
            cast.evalResult.maxElemDmg256,
          )
          if (bitrate256 > 0) {
            this.applyMonsterPoisonDot(
              player,
              m,
              bitrate256,
              cast.evalResult.durationFrames,
              cast.skill.id,
            )
          }
        } else {
          const damage = this.rollPlayerSkillDamage(player, cast)
          if (damage > 0) {
            this.applyDamageToMonster(player, m, damage, cast.skill.id)
          }
        }
      }
    }
  }

  private getPlayerMotion(player: InternalPlayerRecord): PlayerMotionState {
    let motion = this.playerMotion.get(player.unitId)
    if (!motion) {
      motion = {
        mover: new LocalMovementPredictor({ initialX: player.x, initialY: player.y }),
        x: player.x,
        y: player.y,
        plannedX: player.x,
        plannedY: player.y,
        moving: false,
        syncWarpUntilFrame: 0,
      }
      this.playerMotion.set(player.unitId, motion)
    }
    return motion
  }

  /**
   * Walkability of a world sub-tile for a player standing in `areaId`: the active area plus
   * every loaded seam neighbour (#1335), matching the client's cross-LevelView composite.
   */
  private isWorldWalkableForPlayer(areaId: number, x: number, y: number): boolean {
    const check = this.terrainWalkableCheck
    if (!check) return true
    const current = this.loadedAreas.get(areaId)
    if (!current) return check(areaId, x, y)
    if (current.isWalkable(areaId, x, y)) {
      return !this.isClosedDoorAt(areaId, x, y)
    }
    for (const id of current.adjacentAreaIds) {
      const area = this.loadedAreas.get(id)
      if (area && area.isWalkable(id, x, y)) {
        return !this.isClosedDoorAt(id, x, y)
      }
    }
    return false
  }

  /** Closed Objects.txt doors block their footprint until OperateFn opens them (mode 2). */
  private isClosedDoorAt(areaId: number, x: number, y: number, ignoreObjectUnitId?: number): boolean {
    for (const obj of this.objects.values()) {
      if (obj.unitId === ignoreObjectUnitId) continue
      if (obj.areaId !== areaId || obj.mode === 2) continue
      const rec = getObjectsTxtRecord113c(obj.classId)
      if (rec.isDoor !== 1) continue
      const meta = CANONICAL_113C_OBJECTS[obj.classId]
      const sizeX = meta?.sizeX ?? 1
      const sizeY = meta?.sizeY ?? 1
      const minX = Math.round(obj.x) - Math.trunc(sizeX / 2)
      const minY = Math.round(obj.y) - Math.trunc(sizeY / 2)
      if (x >= minX && x < minX + sizeX && y >= minY && y < minY + sizeY) {
        return true
      }
    }
    return false
  }

  /** Sub-tile walk collision for a player (`true` = blocked) from the area collision callback. */
  private isPlayerSubTileBlocked(areaId: number, subX: number, subY: number): boolean {
    if (!this.terrainWalkableCheck) {
      throw new Error('isPlayerSubTileBlocked requires a terrain walkability callback')
    }
    return !this.isWorldWalkableForPlayer(areaId, subX, subY)
  }

  /**
   * Player path from `(fromX, fromY)` to `(toX, toY)` with the client's `findPathWorld`
   * (`unitSize: 2`), over a collision window sampled from the area collision callback. Without a
   * collision callback (no level loaded) the path is the straight segment, exactly like the
   * client predictor's fallback when it has no level view.
   */
  private findPlayerPath(
    areaId: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): readonly SubTilePoint[] {
    const check = this.terrainWalkableCheck
    if (!check) return [{ x: toX, y: toY }]
    const isTown = TOWN_AREAS.has(areaId)
    const margin = isTown ? PLAYER_TOWN_PATH_WINDOW_MARGIN : PLAYER_PATH_WINDOW_MARGIN
    const minX = Math.max(0, Math.floor(Math.min(fromX, toX)) - margin)
    const minY = Math.max(0, Math.floor(Math.min(fromY, toY)) - margin)
    const maxX = Math.floor(Math.max(fromX, toX)) + margin
    const maxY = Math.floor(Math.max(fromY, toY)) + margin
    const subWidth = maxX - minX + 1
    const subHeight = maxY - minY + 1
    const walkable = new Uint8Array(subWidth * subHeight)
    for (let ly = 0; ly < subHeight; ly++) {
      for (let lx = 0; lx < subWidth; lx++) {
        walkable[ly * subWidth + lx] = this.isWorldWalkableForPlayer(areaId, minX + lx, minY + ly) ? 1 : 0
      }
    }
    return findPathWorld(
      { subWidth, subHeight, walkable, subOriginX: minX, subOriginY: minY },
      fromX,
      fromY,
      toX,
      toY,
      isTown
        ? { unitSize: 2, maxAstarObstacleDistanceSq: TOWN_ASTAR_OBSTACLE_DISTANCE_SQ }
        : { unitSize: 2 },
    ).path
  }

  /**
   * 1.13c move-velocity modifiers for the shared predictor: item FRW (stat 96), skill/aura
   * `velocitypercent` (stat 67), equipped armor `speed` penalty, chill/decrepify/holy-freeze
   * slow, and stamina exhaustion. Keeps server ticks aligned with the client predictor.
   */
  private applyPlayerVelocityModifiers(player: InternalPlayerRecord, mover: LocalMovementPredictor): void {
    const itemFrw = this.sumEquippedItemStat(player, 96)
    const combat = this.playerCombatContext(player)
    const velocityPercent = Math.trunc(combat.statList.getAccruedStat('velocitypercent'))
    const skillVelocityPercent = Math.max(0, velocityPercent)
    let armorSpeedPenaltyPercent = 0
    for (const item of player.items) {
      if (item.location === 'equipped' && item.durability > 0) {
        armorSpeedPenaltyPercent += resolveArmorSpeed113c(item.code)
      }
    }
    // 1.13c slow is the real state/stat total, not a fixed 50%: item_slow
    // (clay golem / chill), negative STAT_VELOCITYPERCENT, cold/decrepify 50%,
    // and Holy Freeze's diminishing-returns slowPct for an enemy-applied `holywindcold` (44).
    // The caster's own `holywind` (43) never slows: SrvDo081 (D2Game 0x6FCBABC0) puts only
    // `passivestat1..5` (cold damage) on the caster; `aurastat1..3` go to scanned targets.
    const itemSlow = Math.max(0, Math.trunc(combat.statList.getAccruedStat('item_slow')))
    const holy = combat.stateBus.getState('holywindcold')
    const holySlow = holy ? calculateHolyFreezeStats(holy.slvl).slowPct : 0
    const coldSlow = player.states.has(11) ? 50 : 0
    const decrepifySlow = player.states.has(60) ? 50 : 0
    const slowPercent = Math.max(
      itemSlow,
      Math.max(0, -velocityPercent),
      holySlow,
      coldSlow,
      decrepifySlow,
    )
    mover.setVelocityModifiers({
      fasterRunWalkPercent: itemFrw,
      skillVelocityPercent,
      armorSpeedPenaltyPercent,
      slowPercent,
      staminaExhausted: player.staminaExhausted || player.staminaFixed <= 0,
    })
  }

  /**
   * 1.13c per-tick stamina drain/recovery and life/mana regeneration (#1336).
   *
   * - Running drains `CharStats.RunDrain` (20 for most classes, 15 for Barbarian) in
   *   1/256-point units per frame, scaled by the `stamdrain` item stat.
   * - Walking/idle recovers `maxstamina/256` per frame, scaled by `staminarecoverybonus`.
   * - Mana regenerates over `CharStats.ManaRegen` seconds (120 s full pool), scaled by
   *   `manaregen`; the `nomanaregen` state (85) suppresses it.
   * - Life regenerates `maxhp/65536` per frame plus `hpregen` (1/256 HP per frame);
   *   `item_replenish_life` is the equipped stat 74.
   */
  private stepPlayerVitals(player: InternalPlayerRecord): void {
    if (player.dead) return
    const motion = this.getPlayerMotion(player)
    const running = player.run && motion.moving
    const charStats = CANONICAL_CHARSTATS[player.classCode]
    const beforeHp = player.hp
    const beforeMana = player.mana
    const beforeStamina = player.stamina

    if (running) {
      // 1.13c PLAYER_UpdateStamina 0x6FC95DC0: chest (bodyLoc 3) and shield
      // (bodyLoc 4/5) Armor.txt `speed` raise the drain; item stat 162 is the
      // drain percentage, and the Stamina Shrine (state 136) suppresses it.
      let armorSpeed = 0
      for (const item of player.items) {
        if (
          item.location === 'equipped' &&
          item.durability > 0 &&
          (item.bodyLoc === 3 || item.bodyLoc === 4 || item.bodyLoc === 5)
        ) {
          armorSpeed += resolveArmorSpeed113c(item.code)
        }
      }
      const armorPenalty = 100 + armorSpeed
      const drainPct = 100 + this.sumEquippedItemStat(player, 162)
      const shrineStamina = player.states.has(136) ? 0 : 1
      const drain =
        shrineStamina === 0
          ? 0
          : Math.max(
              1,
              Math.floor(
                (charStats.runDrain * armorPenalty * Math.max(0, drainPct)) / 10_000,
              ),
            )
      player.staminaFixed = Math.max(0, player.staminaFixed - drain)
      if (player.staminaFixed <= 0) {
        player.staminaExhausted = true
        player.run = false
        if (motion.moving) player.mode = 2
      }
    } else {
      // 1.13c 0x6FC95E90: standing still recovers, town walking recovers, and
      // town standing recovers at 2x. Outdoor walking does not recover stamina.
      const inTown = TOWN_AREAS.has(player.areaId)
      const standing = !motion.moving
      if (standing || inTown) {
        const recoveryPct =
          this.sumEquippedItemStat(player, 28) +
          Math.trunc(this.playerCombatContext(player).statList.getAccruedStat('staminarecoverybonus'))
        let recover = Math.max(
          0,
          Math.floor((player.maxStaminaFixed * (100 + recoveryPct)) / (100 * 256)),
        )
        if (inTown && standing) recover *= 2
        player.staminaFixed = Math.min(player.maxStaminaFixed, player.staminaFixed + recover)
      }
    }

    // 25% hysteresis: exhausted players cannot run again until stamina is back
    // above a quarter of the maximum (or a potion/shrine refills it).
    if (
      player.staminaExhausted &&
      player.staminaFixed >= Math.floor(player.maxStaminaFixed / 4)
    ) {
      player.staminaExhausted = false
    }
    if (player.staminaExhausted) player.run = false

    if (!player.states.has(85)) {
      const manaRegenPct = this.sumEquippedItemStat(player, 27)
      const manaPerFrame = Math.max(
        0,
        Math.round(
          (player.maxManaFixed * (100 + manaRegenPct)) /
            (100 * 25 * (charStats.manaRegenSeconds || 120)),
        ),
      )
      player.manaFixed = Math.min(player.maxManaFixed, player.manaFixed + manaPerFrame)
    }

    const hpRegen =
      this.sumEquippedItemStat(player, 74) +
      Math.trunc(this.playerCombatContext(player).statList.getAccruedStat('hpregen'))
    const lifePerFrame = Math.max(
      0,
      Math.round(player.maxHpFixed / 65536 + (hpRegen * FIXED_ONE) / 256),
    )
    player.hpFixed = Math.min(player.maxHpFixed, player.hpFixed + lifePerFrame)

    player.hp = Math.floor(player.hpFixed / FIXED_ONE)
    player.mana = Math.floor(player.manaFixed / FIXED_ONE)
    player.stamina = player.staminaExhausted
      ? 0
      : Math.floor(player.staminaFixed / FIXED_ONE)
    if (
      player.hp !== beforeHp ||
      player.mana !== beforeMana ||
      player.stamina !== beforeStamina
    ) {
      this.emitToPlayer(player.unitId, {
        type: 'LifeMana',
        life: player.hp,
        mana: player.mana,
        stamina: player.stamina,
        at: playerWirePosition(player),
        vx: 0,
        vy: 0,
      })
    }
  }

  /**
   * End of a path (arrival or blocked segment): the player stands, the other clients get the
   * stand `UnitMove`, and the owner gets an authoritative `LifeMana` position for its tolerance
   * gate (D2Client 0x6FADA1B0, flag 0, zero motion vector).
   */
  private finishPlayerMove(player: InternalPlayerRecord, motion: PlayerMotionState): void {
    motion.mover.stop()
    motion.moving = false
    player.targetX = player.x
    player.targetY = player.y
    motion.plannedX = player.x
    motion.plannedY = player.y
    player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
    const at = { x: Math.round(player.x), y: Math.round(player.y) }
    this.broadcastToAreaExcept(player.areaId, player.unitId, {
      type: 'UnitMove',
      unitType: 0,
      id: player.unitId,
      unitId: player.unitId,
      mode: 'stop',
      from: at,
      to: at,
      x: at.x,
      y: at.y,
      currentX: at.x,
      currentY: at.y,
      targetX: at.x,
      targetY: at.y,
    })
    this.emitToPlayer(player.unitId, {
      type: 'LifeMana',
      life: player.hp,
      mana: player.mana,
      stamina: player.stamina,
      at,
      vx: 0,
      vy: 0,
    })
  }

  /**
   * C2S `0x5F UpdatePlayerPos` (D2Game `D2GAME_PACKETCALLBACK_Rcv0x5F_UpdatePlayerPos`,
   * 0x6FC88530, D2MOO `PlrMsg.cpp`). The client sends its own sub-tile when its tolerance gate
   * finds the server position out of range:
   *  - dead player → ignored;
   *  - distance < 5 → ignored;
   *  - `STATE_SYNC_WARPED`, distance < 15 or > 45 → walk (run if in RN) toward the reported
   *    position (`sub_6FC817D0`);
   *  - otherwise warp to the reported position when a path reaches it exactly, setting
   *    `STATE_SYNC_WARPED` for 125 frames; if not, answer S2C `0x15` with the server position.
   */
  private handleUpdatePlayerPos(player: InternalPlayerRecord, clientX: number, clientY: number): void {
    if (player.dead) return
    if (
      !Number.isInteger(clientX) ||
      !Number.isInteger(clientY) ||
      clientX < 0 ||
      clientY < 0 ||
      clientX > 0xffff ||
      clientY > 0xffff
    ) {
      return
    }
    const serverX = Math.round(player.x)
    const serverY = Math.round(player.y)
    const distance = unitsDistanceToCoordinates113c(serverX, serverY, clientX, clientY)
    if (distance < UPDATE_POS_IGNORE_DISTANCE) return

    const motion = this.getPlayerMotion(player)
    const syncWarped = this.currentFrame < motion.syncWarpUntilFrame
    if (
      syncWarped ||
      distance < UPDATE_POS_WARP_MIN_DISTANCE ||
      distance > UPDATE_POS_WARP_MAX_DISTANCE
    ) {
      player.run = player.mode === 3
      player.mode = player.run ? 3 : 2
      player.targetX = clientX
      player.targetY = clientY
      return
    }

    const path = this.findPlayerPath(player.areaId, serverX, serverY, clientX, clientY)
    const last = path[path.length - 1]
    const reachesClient =
      last !== undefined && Math.round(last.x) === clientX && Math.round(last.y) === clientY
    if (!reachesClient) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitReassign',
        unitType: 0,
        id: player.unitId,
        unitId: player.unitId,
        at: { x: serverX, y: serverY },
        x: serverX,
        y: serverY,
        snap: false,
      })
      return
    }

    player.x = clientX
    player.y = clientY
    if (!motion.moving) {
      // An idle player stays put; a moving one keeps heading for its target from the new spot.
      player.targetX = clientX
      player.targetY = clientY
    }
    motion.syncWarpUntilFrame =
      this.currentFrame +
      SYNC_WARP_DELAY_FRAMES +
      this.rng.rand(SYNC_WARP_RANDOM_DELAY_FRAMES + 1)
    // The owner is already at the reported position; only the other clients are re-placed.
    this.broadcastToAreaExcept(player.areaId, player.unitId, {
      type: 'UnitReassign',
      unitType: 0,
      id: player.unitId,
      unitId: player.unitId,
      at: { x: clientX, y: clientY },
      x: clientX,
      y: clientY,
      snap: false,
    })
  }

  /**
   * Non-damage effect of an accepted missile-less cast, driven by the `Skills.txt` row and the
   * registry evaluation (#1328):
   * - Unsummon (3) dismisses the owner's pet at the target; `summon` / `pettype` rows create the pet
   *   through `summonPet` (`SummonManager`);
   * - `aura = 1` rows keep `aurastate` on the caster until another aura replaces it;
   * - `auratargetstate` rows (curses, Inner Sight, Slow Missiles, Taunt, Cloak of Shadows) apply that
   *   state for `durationFrames` to every hostile within `radiusSubtiles` of the target (only the
   *   clicked monster when the radius is 0);
   * - other `aurastate` rows (armors, Energy Shield, Enchant, shapeshift, Fade, ...) apply the state
   *   to the caster for `durationFrames`; absorb-limited armors (`durationFrames = 0`) persist.
   */
  /** Persistent combat context of a player, re-synced from the authoritative record. */
  private playerCombatContext(player: InternalPlayerRecord): CombatUnitContext {
    let unit = this.playerCombat.get(player.unitId)
    if (unit === undefined) {
      const statList = new UnitStatList(this.registry)
      unit = { statList, stateBus: new StateBus(statList, this.registry) }
      this.playerCombat.set(player.unitId, unit)
    }
    const st = unit.statList
    st.setBaseStat('level', player.level)
    st.setBaseStat('strength', player.strength)
    st.setBaseStat('dexterity', player.dexterity)
    st.setBaseStat('vitality', player.vitality)
    st.setBaseStat('energy', player.energy)
    st.setBaseStat('maxhp', player.maxHpFixed)
    st.setHp256(player.hpFixed)
    st.setBaseStat('maxmana', player.maxManaFixed)
    st.setMana256(player.manaFixed)
    const anyaResist = hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_COMPLETED_113C)
      ? 10
      : 0
    st.setBaseStat('fireresist', anyaResist)
    st.setBaseStat('lightresist', anyaResist)
    st.setBaseStat('coldresist', anyaResist)
    st.setBaseStat('poisonresist', anyaResist)
    for (const [id, lvl] of player.skills) st.setBaseSkillLevel(id, lvl)
    return {
      id: `player_${player.unitId}`,
      name: player.name,
      unitType: 'player',
      statList: st,
      stateBus: unit.stateBus,
      x: player.x,
      y: player.y,
      resistPenalty: difficultyResistPenalty(this.difficulty),
      lifeStealDivisor: difficultyLifeStealDivisor(this.difficulty),
      manaStealDivisor: difficultyManaStealDivisor(this.difficulty),
    }
  }

  /** Persistent combat context of a monster, re-synced from the authoritative record. */
  private monsterCombatContext(monster: InternalMonsterRecord): CombatUnitContext {
    let unit = this.monsterCombat.get(monster.unitId)
    if (unit === undefined) {
      const statList = new UnitStatList(this.registry)
      unit = { statList, stateBus: new StateBus(statList, this.registry) }
      this.monsterCombat.set(monster.unitId, unit)
    }
    const st = unit.statList
    st.setBaseStat('level', monster.level)
    st.setBaseStat('armorclass', monster.ac)
    st.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
    st.setHp256(monster.hp * FIXED_ONE)
    st.setBaseStat('damageresist', monster.resistances.phys)
    st.setBaseStat('magicresist', monster.resistances.magic)
    st.setBaseStat('fireresist', monster.resistances.fire)
    st.setBaseStat('lightresist', monster.resistances.light)
    st.setBaseStat('coldresist', monster.resistances.cold)
    st.setBaseStat('poisonresist', monster.resistances.poison)
    return {
      id: `monster_${monster.unitId}`,
      name: monster.name,
      unitType: 'monster',
      statList: st,
      stateBus: unit.stateBus,
      x: monster.x,
      y: monster.y,
      isUndead: monster.isUndead,
      isDemon: monster.isDemon,
      isBoss: monster.isBoss,
      isPrimeEvil: monster.isPrimeEvil,
      coldEffect: monster.coldEffect,
      drain: monster.drain,
    }
  }

  /**
   * Copy the persistent states (with their `aurastat` modifiers) of a unit onto a per-hit
   * `StateBus`, skipping states the hit already models, so buffs / curses / auras reach
   * `executeSUnitDmg`.
   */
  private mirrorPersistentStates(source: PersistentCombatUnit | undefined, target: StateBus): void {
    if (source === undefined) return
    for (const e of source.stateBus.getActiveEntries()) {
      if (target.hasState(e.stateId)) continue
      const remaining = e.expireFrame > 0 ? Math.max(1, e.expireFrame - this.currentFrame) : 0
      target.applyState({
        stateNameOrId: e.stateId,
        sourceUnitId: e.sourceUnitId,
        sourceSkillId: e.sourceSkillId,
        slvl: e.slvl,
        durationFrames: remaining,
        currentFrame: this.currentFrame,
        stats: e.stats,
        isAuraOverride: e.isAura,
      })
    }
  }

  /** `Skills.txt` `aurastat1..6` / `aurastatcalc1..6` evaluated at `slvl` (same rule as `AuraScanner`). */
  private evaluateSkillStateStats(skill: SkillRecord, slvl: number, statList: UnitStatList): Record<string, number> {
    const calcCtx = {
      registry: this.registry,
      activeSkill: skill,
      slvl,
      blvl: statList.getBaseSkillLevel(skill.id),
      getBaseSkillLevel: (id: number) => statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => statList.getEffectiveSkillLevel(id),
    }
    const stats: Record<string, number> = {}
    const pairs: [string, string][] = [
      [skill.auraStat1, skill.auraStatCalc1],
      [skill.auraStat2, skill.auraStatCalc2],
      [skill.auraStat3, skill.auraStatCalc3],
      [skill.auraStat4, skill.auraStatCalc4],
      [skill.auraStat5, skill.auraStatCalc5],
      [skill.auraStat6, skill.auraStatCalc6],
    ]
    for (const [name, calc] of pairs) {
      if (name && calc) stats[name.toLowerCase()] = evaluateCalc(calc, calcCtx)
    }
    return stats
  }

  /** Expire persistent combat states and drop contexts of units that left / died. */
  private stepPersistentCombatStates(): void {
    for (const [id, unit] of this.playerCombat) {
      if (!this.players.has(id)) this.playerCombat.delete(id)
      else unit.stateBus.tick(this.currentFrame)
    }
    for (const [id, unit] of this.monsterCombat) {
      const m = this.monsters.get(id)
      if (m === undefined || m.dead) {
        this.monsterCombat.delete(id)
        continue
      }
      unit.stateBus.tick(this.currentFrame)
      // #1334: Conversion is applied to the combat StateBus by Skills.txt
      // handlers. Mirror it onto the authoritative monster record so the AI can
      // switch alignment and the client sees state 53 (conversion aura).
      const conversion = unit.stateBus.getActiveEntries().find(e => e.stateId === 53)
      if (conversion !== undefined) {
        const expireFrame = conversion.expireFrame > 0 ? conversion.expireFrame : this.currentFrame + 1
        if (m.convertedUntilFrame <= this.currentFrame) {
          m.convertedUntilFrame = expireFrame
          const sourcePlayerId = Number.parseInt(conversion.sourceUnitId.replace(/^player_/, ''), 10)
          m.convertedByPlayerId = Number.isFinite(sourcePlayerId) ? sourcePlayerId : 0
          if (!m.states.has(53)) {
            this.applyUnitState(
              m.states,
              m.stateTimers,
              'monster',
              m.unitId,
              m.areaId,
              53,
              Math.max(1, expireFrame - this.currentFrame),
            )
          }
        } else {
          m.convertedUntilFrame = Math.max(m.convertedUntilFrame, expireFrame)
        }
      }
    }
  }

  /** Whether a monster is currently converted (state 53) and fights for a player. */
  private isMonsterConverted(monster: InternalMonsterRecord): boolean {
    return monster.convertedUntilFrame > this.currentFrame
  }

  /**
   * Run every player's selected aura through its `AuraScanner` (`perdelay` pulses): friendly stat
   * auras on same-area players in range, Prayer / Meditation / Cleansing heals, Redemption corpses,
   * Conviction / Holy Freeze / Holy Fire / Holy Shock / Sanctuary on hostiles in range. Units are
   * pre-filtered by the evaluated `aurarangecalc` radius (sub-tile `dx² + dy² <= r²`, 0x6FCC0C70);
   * the scanner then applies the same radius and the `aurafilter` bits. HP / mana results are
   * written back.
   */
  private stepPlayerAuras(): void {
    for (const [ownerId, aura] of this.playerAuraScanners) {
      const owner = this.players.get(ownerId)
      if (owner === undefined || owner.dead) continue
      const inRange = (x: number, y: number) => isWithinAuraRange(x - owner.x, y - owner.y, aura.radiusSubtiles)
      const allyRecords = [...this.players.values()].filter(
        (p) => !p.dead && p.areaId === owner.areaId && (p === owner || inRange(p.x, p.y)),
      )
      const enemyRecords = [...this.monsters.values()].filter(
        (m) => !m.dead && !m.isNpc && m.isKillable && !this.isMonsterConverted(m) && m.areaId === owner.areaId && inRange(m.x, m.y),
      )
      const corpseRecords = [...this.monsters.values()].filter(
        (m) =>
          m.dead &&
          !m.shattered &&
          !m.isNpc &&
          m.areaId === owner.areaId &&
          inRange(m.x, m.y),
      )
      const ownerCtx = this.playerCombatContext(owner)
      const allies = allyRecords.map((p) => (p === owner ? ownerCtx : this.playerCombatContext(p)))
      const enemies = enemyRecords.map((m) => this.monsterCombatContext(m))
      const corpses: CorpseContext[] = corpseRecords.map((m) => ({ id: String(m.unitId), consumed: false, x: m.x, y: m.y }))
      aura.scanner.tick(this.currentFrame, allies, enemies, corpses, {
        isTown: TOWN_AREAS.has(owner.areaId),
        // aurafilter `0x200` (D2Common ord 11076, collision mask 4): wall/door ray like a flying walker.
        hasLineOfSight: (src, tgt) =>
          src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined
            ? false
            : this.isMonsterStepWalkable(owner.areaId, src.x, src.y, tgt.x, tgt.y, true),
        rng: this.rng,
      })

      allyRecords.forEach((p, i) => this.syncPlayerVitalsFromCombat(p, allies[i]!))
      enemyRecords.forEach((m, i) => {
        const hpAfter = Math.max(0, Math.ceil(enemies[i]!.statList.getHp256() / FIXED_ONE))
        const dealt = m.hp - hpAfter
        if (dealt > 0) {
          this.finishMonsterDamage(owner, m, dealt, aura.skillId, this.resolveSkillDamageChannel(aura.skillId))
        }
      })
      corpseRecords.forEach((m, i) => {
        if (corpses[i]!.consumed) m.shattered = true
      })
      // Prayer's per-frame mana drain shuts the aura down at 0 mana.
      if (aura.skillId === SKILL_PRAYER && !ownerCtx.stateBus.hasState('prayer')) {
        this.stopPlayerAura(owner)
      }
    }
  }

  /** Write HP / mana changed by an aura pulse back to the player record (+ client stat updates). */
  private syncPlayerVitalsFromCombat(player: InternalPlayerRecord, ctx: CombatUnitContext): void {
    const hp256 = Math.min(player.maxHpFixed, Math.max(0, ctx.statList.getHp256()))
    const mana256 = Math.min(player.maxManaFixed, Math.max(0, ctx.statList.getMana256()))
    if (hp256 !== player.hpFixed) {
      player.hpFixed = hp256
      player.hp = Math.max(0, Math.ceil(hp256 / FIXED_ONE))
      this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 6, value: player.hpFixed })
    }
    if (mana256 !== player.manaFixed) {
      player.manaFixed = mana256
      const mana = Math.floor(mana256 / FIXED_ONE)
      if (mana !== player.mana) {
        player.mana = mana
        this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 8, value: player.manaFixed })
      }
    }
  }

  /** Deselect the player's aura: stop its pulses and remove the caster aura state. */
  private stopPlayerAura(player: InternalPlayerRecord): void {
    this.playerAuraScanners.delete(player.unitId)
    const stateId = this.playerActiveAuraState.get(player.unitId)
    if (stateId !== undefined) {
      this.playerActiveAuraState.delete(player.unitId)
      this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId)
      this.playerCombat.get(player.unitId)?.stateBus.removeState(stateId)
    }
  }

  private applyPlayerSkillEffect(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    tx: number,
    ty: number,
    targetMonster: InternalMonsterRecord | undefined,
  ): void {
    const { skill, evalResult } = cast
    if (skill.id === SKILL_UNSUMMON) {
      this.unsummonPetAt(player.unitId, tx, ty)
      return
    }
    if (skill.summon !== '' || skill.petType !== '') {
      this.summonPet(player.unitId, {
        skillId: skill.id,
        slvl: cast.slvl,
        x: tx,
        y: ty,
        corpseMonsterId:
          targetMonster?.dead && !targetMonster.shattered ? targetMonster.unitId : undefined,
      })
      // Summon rows that also carry a caster `aurastate` (Dopplezon, Shadow Warrior, Iron Golem
      // thorns) only take that state through the pet's own runtime.
      return
    }
    const stateByName = (name: string): number => {
      const rec = this.registry.getStateByName(name)
      if (rec === undefined) {
        throw new Error(`GameInstance: Skills.txt row ${skill.id} references unknown States.txt row "${name}"`)
      }
      return rec.id
    }
    if (skill.aura) {
      if (skill.auraState === '') return
      const stateId = stateByName(skill.auraState)
      const previous = this.playerActiveAuraState.get(player.unitId)
      if (previous !== undefined && previous !== stateId) {
        this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, previous)
        this.playerCombat.get(player.unitId)?.stateBus.removeState(previous)
      }
      this.playerActiveAuraState.set(player.unitId, stateId)
      this.applyPersistentUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId)
      // The aura's periodic pulse (`perdelay`) runs through `AuraScanner` from the next frames on.
      const ownerCtx = this.playerCombatContext(player)
      const scanner = new AuraScanner(this.registry, (this.currentMapSeed ^ player.unitId) >>> 0)
      scanner.setActiveAura(ownerCtx, skill.id, cast.slvl, this.currentFrame + 1)
      this.playerAuraScanners.set(player.unitId, {
        scanner,
        skillId: skill.id,
        radiusSubtiles: evalResult.radiusSubtiles,
      })
      return
    }
    if (skill.auraTgtState !== '' && evalResult.durationFrames > 0) {
      const stateId = stateByName(skill.auraTgtState)
      const radius = evalResult.radiusSubtiles
      const casterStats = this.playerCombatContext(player).statList
      const stats = this.evaluateSkillStateStats(skill, cast.slvl, casterStats)
      for (const m of this.monsters.values()) {
        if (m.dead || m.isNpc || m.areaId !== player.areaId) continue
        const inArea = radius > 0 ? Math.hypot(m.x - tx, m.y - ty) <= radius : m === targetMonster
        if (inArea) {
          this.applyUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, stateId, evalResult.durationFrames)
          this.monsterCombatContext(m).stateBus.applyState({
            stateNameOrId: stateId,
            sourceUnitId: `player_${player.unitId}`,
            sourceSkillId: skill.id,
            slvl: cast.slvl,
            durationFrames: evalResult.durationFrames,
            currentFrame: this.currentFrame,
            stats,
          })
        }
      }
    }
    if (skill.auraState !== '' && skill.srvDoFunc !== SRVDOFUNC_WHIRLWIND) {
      const stateId = stateByName(skill.auraState)
      if (evalResult.durationFrames > 0) {
        this.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId, evalResult.durationFrames)
      } else {
        this.applyPersistentUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId)
      }
      const ctx = this.playerCombatContext(player)
      ctx.stateBus.applyState({
        stateNameOrId: stateId,
        sourceUnitId: ctx.id,
        sourceSkillId: skill.id,
        slvl: cast.slvl,
        durationFrames: Math.max(0, evalResult.durationFrames),
        currentFrame: this.currentFrame,
        stats: this.evaluateSkillStateStats(skill, cast.slvl, ctx.statList),
      })
    }
  }

  /**
   * Move the player for a movement skill (Teleport, Charge, Leap, Leap Attack, Dragon Flight,
   * Whirlwind) to the last reachable point of the walk path toward (x, y), then broadcast the
   * authoritative `0x15` re-assign. Teleport ignores walls (D2Game places it directly).
   */
  private relocatePlayerForSkill(player: InternalPlayerRecord, x: number, y: number, throughWalls: boolean): void {
    let destX = x
    let destY = y
    if (!throughWalls) {
      const path = this.findPlayerPath(player.areaId, Math.round(player.x), Math.round(player.y), Math.round(x), Math.round(y))
      const last = path[path.length - 1]
      if (last === undefined) return
      destX = last.x
      destY = last.y
    }
    player.x = destX
    player.y = destY
    player.targetX = destX
    player.targetY = destY
    this.broadcastToArea(player.areaId, {
      type: 'UnitReassign',
      unitType: 0,
      id: player.unitId,
      unitId: player.unitId,
      at: { x: destX, y: destY },
      x: destX,
      y: destY,
      snap: true,
    })
  }

  /** Point `standoff` sub-tiles short of (tx, ty) on the line from the player (melee arrival spot). */
  private pointBefore(player: InternalPlayerRecord, tx: number, ty: number, standoff: number): { x: number; y: number } {
    const dx = tx - player.x
    const dy = ty - player.y
    const dist = Math.hypot(dx, dy)
    if (dist <= standoff) return { x: player.x, y: player.y }
    return { x: tx - (dx / dist) * standoff, y: ty - (dy / dist) * standoff }
  }

  /**
   * Whirlwind (`srvdofunc` 76): spin along the path to (tx, ty), striking each hostile within melee
   * reach of the path once with the skill's weapon damage.
   */
  private executeWhirlwind(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void {
    const startX = player.x
    const startY = player.y
    this.relocatePlayerForSkill(player, tx, ty, false)
    const endX = player.x
    const endY = player.y
    const segLen = Math.hypot(endX - startX, endY - startY)
    for (const m of this.monsters.values()) {
      if (m.dead || m.isNpc || m.areaId !== player.areaId) continue
      let t = 0
      if (segLen > 0) {
        t = ((m.x - startX) * (endX - startX) + (m.y - startY) * (endY - startY)) / (segLen * segLen)
        t = Math.max(0, Math.min(1, t))
      }
      const px = startX + (endX - startX) * t
      const py = startY + (endY - startY) * t
      if (Math.hypot(m.x - px, m.y - py) <= PLAYER_MELEE_REACH_SUBTILES) {
        const damage = this.rollPlayerSkillDamage(player, cast)
        if (damage > 0) this.applyDamageToMonster(player, m, damage, cast.skill.id)
      }
    }
  }

  /**
   * Direct-hit spells without a missile (Telekinesis `srvdofunc` 21, Psychic Hammer 33, Mind Blast
   * 51): the evaluated physical band is applied as physical damage and the `EMin..EMax` band in the
   * skill's `EType` channel.
   */
  private applyDirectSkillDamage(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void {
    const ev = cast.evalResult
    const phys = this.rollInclusive(ev.minPhysDmg, ev.maxPhysDmg)
    const elem = cast.skill.eType !== '' ? this.rollInclusive(ev.minElemDmg, ev.maxElemDmg) : 0
    if (phys > 0) this.applyDamageToMonster(player, monster, phys, cast.skill.id, 'phys')
    if (elem > 0 && !monster.dead) this.applyDamageToMonster(player, monster, elem, cast.skill.id)
  }

  /**
   * Mind Blast (`srvdofunc` 51): damages every hostile within `radiusSubtiles` of the target and stuns
   * it (`States.txt` `stunned`) for `computeMindBlastStunDuration`. Monster conversion (switching
   * the monster's alignment) has no GameInstance runtime yet and is not applied.
   */
  private executeMindBlast(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void {
    const radius = cast.evalResult.radiusSubtiles
    const stunFrames = computeMindBlastStunDuration(cast.slvl)
    const stunned = this.registry.getStateByName('stunned')
    if (stunned === undefined) {
      throw new Error('GameInstance: States.txt row stunned is missing')
    }
    const targets = [...this.monsters.values()].filter(
      (m) => !m.dead && !m.isNpc && !this.isMonsterConverted(m) && m.areaId === player.areaId && Math.hypot(m.x - tx, m.y - ty) <= radius,
    )
    for (const m of targets) {
      this.applyDirectSkillDamage(player, cast, m)
      if (m.dead) continue
      this.applyUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, stunned.id, stunFrames)
      // Mind Blast 1.13c conversion: the target fights for the caster while stunned.
      m.convertedUntilFrame = this.currentFrame + stunFrames
      m.convertedByPlayerId = player.unitId
      m.threatPlayerId = 0
      m.threatUntilFrame = 0
      const conversionState = this.registry.getStateByName('conversion')
      if (conversionState !== undefined) {
        this.applyUnitState(
          m.states,
          m.stateTimers,
          'monster',
          m.unitId,
          m.areaId,
          conversionState.id,
          stunFrames,
        )
      }
    }
  }

  /**
   * Corpse Explosion (`srvdofunc` 55): consumes the corpse nearest to the target and deals
   * `computeCorpseExplosion113c` damage (70-120% of the corpse's max life, scaled by caster/corpse
   * level, 50% physical in the inner ring + 50% fire in the outer ring) to every hostile in range.
   */
  private executeCorpseExplosion(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    tx: number,
    ty: number,
    targetCorpse?: InternalMonsterRecord,
  ): void {
    let corpse: InternalMonsterRecord | undefined =
      targetCorpse !== undefined &&
      targetCorpse.dead &&
      !targetCorpse.shattered &&
      !targetCorpse.isNpc &&
      targetCorpse.areaId === player.areaId
        ? targetCorpse
        : undefined
    if (corpse === undefined) {
      let best = Number.POSITIVE_INFINITY
      const maxSearchDist = Math.max(PLAYER_MELEE_REACH_SUBTILES, 12)
      for (const m of this.monsters.values()) {
        if (!m.dead || m.shattered || m.isNpc || m.areaId !== player.areaId) continue
        const d = Math.hypot(m.x - tx, m.y - ty)
        if (d <= maxSearchDist && d < best) {
          best = d
          corpse = m
        }
      }
    }
    if (corpse === undefined) return
    corpse.shattered = true
    this.broadcastToArea(corpse.areaId, {
      type: 'UnitRemove',
      unitType: 1,
      id: corpse.unitId,
      unitId: corpse.unitId,
    })
    const rollPct = 70 + this.rng.rand(51)
    for (const m of [...this.monsters.values()]) {
      if (m.dead || m.isNpc || m.areaId !== player.areaId) continue
      const d = Math.hypot(m.x - corpse.x, m.y - corpse.y)
      const out = computeCorpseExplosion113c({
        corpseBaseHp: corpse.baseMaxHp || corpse.maxHp,
        rollPct,
        casterLevel: player.level,
        corpseLevel: corpse.level,
        slvl: cast.slvl,
        distanceSubtiles: d,
      })
      if (d > out.outerFireRadiusSubtiles) continue
      if (d <= out.innerPhysRadiusSubtiles && out.rawPhysDamage > 0) {
        this.applyDamageToMonster(player, m, out.rawPhysDamage, cast.skill.id, 'phys')
      }
      if (!m.dead && out.rawFireDamage > 0) {
        this.applyDamageToMonster(player, m, out.rawFireDamage, cast.skill.id, 'fire')
      }
    }
  }

  /** `Skills.txt` `DmgSymPerCalc` of the cast: the physical synergy %ED (0 when the cell is empty). */
  private playerSkillPhysSynergyPct(cast: PlayerSkillCast): number {
    return this.evaluatePlayerSkillCalc(cast, cast.skill.dmgSymPerCalc)
  }

  /**
   * #1417: create the server missiles of a missile skill the way its `Skills.txt` `srvdofunc` does in
   * `D2Game.dll` (`gpSkillSrvDoFnTable` @ `0x6FD274A8`, `classifyPlayerSrvDoMissile113c`):
   * - SrvDo008 `0x6FC6D420` (Multiple Shot, Teeth, Shock Wave): `calc1` missiles fanned through the
   *   target (`srvdo008FanTargets113c`). `calc1` is the missile count, not %ED, so the weapon part only
   *   carries the `DmgSymPerCalc` synergy.
   * - SrvDo012 `0x6FC6DCD0` (Strafe): `executeStrafe`.
   * - SrvDo017 / 117 / 118 (Charged Bolt, Firestorm, Twister / Tornado): `calc1` missiles toward the target.
   * - single-missile srvdofuncs (and skills without one) launch one `srvmissile`; every other
   *   srvdofunc is reported through `reportUnmodeledPlayerSrvDoFunc` before the single launch.
   */
  private launchPlayerSkillMissiles(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    missileRec: MissileRecord,
    tx: number,
    ty: number,
    primaryTarget?: InternalMonsterRecord,
  ): void {
    const mode = classifyPlayerSrvDoMissile113c(cast.skill.srvDoFunc)
    if (mode === 'fan') {
      const count = this.evaluatePlayerSkillCalc(cast, cast.skill.calc1)
      const triggered = this.evaluatePlayerSkillCalc(cast, cast.skill.calc3)
      const edPct = this.playerSkillPhysSynergyPct(cast)
      for (const t of srvdo008FanTargets113c(player.x, player.y, tx, ty, count, triggered)) {
        this.launchPlayerSkillMissile(player, cast, missileRec, t.x, t.y, this.rollPlayerSkillDamage(player, cast, edPct))
      }
      return
    }
    if (mode === 'strafe') {
      this.executeStrafe(player, cast, missileRec, tx, ty, primaryTarget)
      return
    }
    if (mode === 'volley') {
      const count = this.evaluatePlayerSkillCalc(cast, cast.skill.calc1)
      for (let i = 0; i < count; i++) {
        this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, this.rollPlayerSkillDamage(player, cast))
      }
      return
    }
    if (mode === 'unmodeled') this.reportUnmodeledPlayerSrvDoFunc(cast.skill)
    this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, this.rollPlayerSkillDamage(player, cast))
  }

  /**
   * Strafe (SrvSt008 `0x6FC6C870` + SrvDo012 `0x6FC6DCD0`): the hostiles inside `aurarangecalc`
   * (`radiusSubtiles`) around the caster set the shot count `strafeShotCount113c(calc1, calc3, n)`;
   * each shot is one `srvmissilea` at the next target, carrying `calc2` (+ `DmgSymPerCalc`) as %ED.
   * The clicked monster is shot first, the rest nearest-first, cycling when there are fewer targets
   * than shots. With no target in range SrvDo012 fires its single shot at the cast location and then
   * finds no next target.
   */
  private executeStrafe(
    player: InternalPlayerRecord,
    cast: PlayerSkillCast,
    missileRec: MissileRecord,
    tx: number,
    ty: number,
    primaryTarget?: InternalMonsterRecord,
  ): void {
    const radius = cast.evalResult.radiusSubtiles
    const inRange = [...this.monsters.values()]
      .filter(
        (m) =>
          !m.dead &&
          !m.isNpc &&
          !this.isMonsterConverted(m) &&
          m.areaId === player.areaId &&
          Math.hypot(m.x - player.x, m.y - player.y) <= radius,
      )
      .sort((a, b) => {
        if (a === primaryTarget) return -1
        if (b === primaryTarget) return 1
        const d = Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)
        return d !== 0 ? d : a.unitId - b.unitId
      })
    const edPct = this.evaluatePlayerSkillCalc(cast, cast.skill.calc2) + this.playerSkillPhysSynergyPct(cast)
    if (inRange.length === 0) {
      this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, this.rollPlayerSkillDamage(player, cast, edPct))
      return
    }
    const shots = strafeShotCount113c(
      this.evaluatePlayerSkillCalc(cast, cast.skill.calc1),
      this.evaluatePlayerSkillCalc(cast, cast.skill.calc3),
      inRange.length,
    )
    for (let i = 0; i < shots; i++) {
      const target = inRange[i % inRange.length]!
      this.launchPlayerSkillMissile(
        player,
        cast,
        missileRec,
        target.x,
        target.y,
        this.rollPlayerSkillDamage(player, cast, edPct),
      )
    }
  }

  /** Report (once per srvdofunc) a missile skill whose 1.13c srvdofunc volley is not implemented. */
  private reportUnmodeledPlayerSrvDoFunc(skill: SkillRecord): void {
    if (this.unmodeledPlayerSrvDoFuncs.has(skill.srvDoFunc)) return
    this.unmodeledPlayerSrvDoFuncs.add(skill.srvDoFunc)
    console.warn(
      `GameInstance: Skills.txt srvdofunc ${skill.srvDoFunc} (skill ${skill.id} ${skill.name}) has no 1.13c missile ` +
        'volley implementation; launching a single srvmissile',
    )
  }

  /** #1417 diagnostics: srvdofuncs reported by `reportUnmodeledPlayerSrvDoFunc`, ascending. */
  getUnmodeledPlayerSrvDoFuncs(): number[] {
    return [...this.unmodeledPlayerSrvDoFuncs].sort((a, b) => a - b)
  }

  private executeSkillAtLocation(
    player: InternalPlayerRecord,
    skillId: number,
    tx: number,
    ty: number,
    targetCorpse?: InternalMonsterRecord,
  ): void {
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return
    const cast = this.resolvePlayerSkillCast(player, skillId)
    if (cast === null) return
    this.commitPlayerSkillCast(player, cast)
    this.broadcastPlayerSkillCast(player, cast, { x: Math.round(tx), y: Math.round(ty) })

    const doFunc = cast.skill.srvDoFunc
    if (skillId === SKILL_TELEPORT) {
      this.relocatePlayerForSkill(player, tx, ty, true)
      return
    }

    if (skillId === 219 || skillId === 220) {
      this.openTownPortal(player)
      return
    }

    if (doFunc === SRVDOFUNC_WHIRLWIND) {
      this.executeWhirlwind(player, cast, tx, ty)
      return
    }
    if (doFunc === SRVDOFUNC_LEAP || doFunc === SRVDOFUNC_LEAP_ATTACK) {
      this.relocatePlayerForSkill(player, tx, ty, false)
    }
    if (doFunc === SRVDOFUNC_NOVA) {
      this.executeNovaSkill(player, cast)
      if (cast.missile !== undefined) {
        this.launchPlayerSkillMissile(player, cast, cast.missile, tx, ty, 0)
      }
      return
    }

    if (cast.missile !== undefined) {
      this.launchPlayerSkillMissiles(player, cast, cast.missile, tx, ty)
      return
    }
    if (skillId === 42) {
      this.applyStaticField(player, cast)
      return
    }
    if (doFunc === SRVDOFUNC_CORPSE_EXPLOSION) {
      this.executeCorpseExplosion(player, cast, tx, ty, targetCorpse)
      return
    }
    if (doFunc === SRVDOFUNC_MIND_BLAST) {
      this.executeMindBlast(player, cast, tx, ty)
      return
    }
    // Melee strikes on an empty location hit nothing; everything else applies its registry effect.
    if (cast.skill.range !== 'h2h' && cast.skill.range !== 'both') {
      this.applyPlayerSkillEffect(player, cast, tx, ty, targetCorpse)
    }
  }

  private executeSkillOnTarget(
    player: InternalPlayerRecord,
    skillId: number,
    targetId: number,
  ): void {
    const clicked = this.monsters.get(targetId)
    if (clicked && clicked.dead && !clicked.isNpc && clicked.areaId === player.areaId) {
      // A cast on a corpse (Corpse Explosion, Raise Skeleton, Revive, ...) targets that corpse.
      this.executeSkillAtLocation(player, skillId, clicked.x, clicked.y, clicked)
      return
    }
    let monster = clicked
    if (!monster || monster.dead || monster.isNpc || monster.areaId !== player.areaId) {
      // Fallback: if targetId refers to the nearest hostile monster in the player's area
      for (const candidate of this.monsters.values()) {
        if (!candidate.dead && !candidate.isNpc && candidate.areaId === player.areaId) {
          monster = candidate
          break
        }
      }
    }
    if (!monster) return

    const cast = this.resolvePlayerSkillCast(player, skillId)
    if (cast === null) return
    const doFunc = cast.skill.srvDoFunc
    const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
    const isMovementStrike =
      doFunc === SRVDOFUNC_CHARGE || doFunc === SRVDOFUNC_LEAP_ATTACK || doFunc === SRVDOFUNC_DRAGON_FLIGHT
    const isMeleeStrike =
      !isMovementStrike &&
      cast.missile === undefined &&
      (cast.skill.range === 'h2h' || cast.skill.range === 'both')
    if (isMeleeStrike && dist > PLAYER_MELEE_REACH_SUBTILES) return

    this.commitPlayerSkillCast(player, cast)
    this.broadcastPlayerSkillCast(player, cast, { unitType: 1, id: monster.unitId })

    if (skillId === SKILL_TELEPORT) {
      this.relocatePlayerForSkill(player, monster.x, monster.y, true)
      return
    }
    if (doFunc === SRVDOFUNC_WHIRLWIND) {
      this.executeWhirlwind(player, cast, monster.x, monster.y)
      return
    }
    if (isMovementStrike) {
      // Charge / Leap Attack / Dragon Flight: arrive next to the target, then strike it.
      const arrival = this.pointBefore(player, monster.x, monster.y, 1)
      this.relocatePlayerForSkill(player, arrival.x, arrival.y, false)
      if (Math.hypot(monster.x - player.x, monster.y - player.y) <= PLAYER_MELEE_REACH_SUBTILES) {
        const damage = this.rollPlayerSkillDamage(player, cast)
        if (damage > 0) this.applyDamageToMonster(player, monster, damage, skillId)
      }
      return
    }
    if (doFunc === SRVDOFUNC_LEAP) {
      this.relocatePlayerForSkill(player, monster.x, monster.y, false)
    }
    if (doFunc === SRVDOFUNC_NOVA) {
      this.executeNovaSkill(player, cast)
      if (cast.missile !== undefined) {
        this.launchPlayerSkillMissile(player, cast, cast.missile, monster.x, monster.y, 0)
      }
      return
    }

    if (cast.missile !== undefined) {
      this.launchPlayerSkillMissiles(player, cast, cast.missile, monster.x, monster.y, monster)
      return
    }
    if (skillId === 42) {
      this.applyStaticField(player, cast)
      return
    }
    if (doFunc === SRVDOFUNC_TELEKINESIS || doFunc === SRVDOFUNC_PSYCHIC_HAMMER) {
      this.applyDirectSkillDamage(player, cast, monster)
      return
    }
    if (doFunc === SRVDOFUNC_MIND_BLAST) {
      this.executeMindBlast(player, cast, monster.x, monster.y)
      return
    }
    if (doFunc === SRVDOFUNC_CORPSE_EXPLOSION) {
      this.executeCorpseExplosion(player, cast, monster.x, monster.y)
      return
    }
    if (isMeleeStrike) {
      if (cast.evalResult.elemType === 'pois' && cast.evalResult.durationFrames > 0) {
        const physDamage = this.rollPlayerSkillPhysDamage(player, cast)
        if (physDamage > 0) {
          this.applyDamageToMonster(player, monster, physDamage, skillId, 'phys')
        }
        const bitrate256 = this.rollInclusive(
          cast.evalResult.minElemDmg256,
          cast.evalResult.maxElemDmg256,
        )
        if (bitrate256 > 0 && !monster.dead) {
          this.applyMonsterPoisonDot(
            player,
            monster,
            bitrate256,
            cast.evalResult.durationFrames,
            skillId,
          )
        }
        return
      }
      const damage = this.rollPlayerSkillDamage(player, cast)
      if (damage > 0) {
        this.applyDamageToMonster(player, monster, damage, skillId)
      }
      return
    }
    this.applyPlayerSkillEffect(player, cast, monster.x, monster.y, monster)
  }


  private spawnMonsterMissile(
    monster: InternalMonsterRecord,
    targetX: number,
    targetY: number,
    damage: number,
    missileClassId = 1,
    skillId = 0,
    options: {
      readonly missile?: MissileRecord | undefined
      readonly skillLevel?: number | undefined
      readonly physDamage?: number | undefined
      readonly elemDamage?: number | undefined
      readonly element?: MissileDamageChannel | undefined
      readonly elemDurationFrames?: number | undefined
      /** Death-effect nova: never miss, never block, never stop on terrain. */
      readonly guaranteed?: boolean | undefined
      /** Monster-vs-monster projectile (Confuse/Conversion/Attract). */
      readonly hitMonsters?: boolean | undefined
    } = {},
  ): number {
    const dx = targetX - monster.x
    const dy = targetY - monster.y
    const dist = Math.max(0.5, Math.hypot(dx, dy))
    // The data registry carries the full Missiles.txt row (Vel/Range/LevRange/Size/
    // CollideType/Pierce/NextDelay/EType); `getMissileTxtData` only has the art subset.
    const meta = options.missile ?? this.registry.getMissileById(missileClassId)
    const resolvedClassId = meta?.id ?? missileClassId
    const skillLevel = Math.max(1, options.skillLevel ?? monster.level)
    const speed = meta === undefined ? 1.8 : meta.vel > 0 ? meta.vel / 16 : 0
    const rangeTicks =
      meta === undefined ? 45 : Math.max(2, meta.range + meta.levRange * (skillLevel - 1))
    const element =
      options.element ??
      normalizeMissileElement(meta?.eType) ??
      missileClassElementFallback(resolvedClassId) ??
      'phys'
    const stationary = meta !== undefined && meta.vel <= 0
    const startX = stationary ? targetX : monster.x
    const startY = stationary ? targetY : monster.y
    const physDamage =
      Math.max(0, Math.floor(options.physDamage ?? (element === 'phys' ? damage : 0)))
    const elemDamage =
      Math.max(0, Math.floor(options.elemDamage ?? (element === 'phys' ? 0 : damage)))
    const totalDamage = Math.max(1, physDamage + elemDamage)
    const missileUnitId = this.allocateUnitId()
    const missile: InternalMissileRecord = {
      unitId: missileUnitId,
      missileId: resolvedClassId,
      skillId,
      ownerType: 'monster',
      ownerId: monster.unitId,
      areaId: monster.areaId,
      x: startX,
      y: startY,
      vx: speed > 0 ? (dx / dist) * speed : 0,
      vy: speed > 0 ? (dy / dist) * speed : 0,
      damage: totalDamage,
      remainingFrames: rangeTicks,
      collideType: meta?.collideType ?? 3,
      size: Math.max(1, meta?.size ?? 1),
      pierce: meta?.pierce === true,
      nextHit: meta?.nextHit === true,
      nextDelay: Math.max(0, meta?.nextDelay ?? 0),
      element,
      physDamage,
      elemDamage,
      elemDurationFrames: Math.max(0, options.elemDurationFrames ?? 0),
      hitCooldowns: new Map(),
      guaranteedHit: options.guaranteed === true,
      ...(options.hitMonsters === true ? { hitMonsters: true } : {}),
    }
    this.missiles.set(missileUnitId, missile)

    this.broadcastToArea(monster.areaId, {
      type: 'CreateMissile',
      missileId: missileUnitId,
      missileClassId: resolvedClassId,
      at: { x: Math.round(startX), y: Math.round(startY) },
      target: { x: Math.round(targetX), y: Math.round(targetY) },
      x: Math.round(startX),
      y: Math.round(startY),
      targetX: Math.round(targetX),
      targetY: Math.round(targetY),
      skillId,
      level: skillLevel,
      ownerType: 1,
      ownerUnitType: 'monster',
      ownerId: monster.unitId,
      sourceUnitId: monster.unitId,
      areaId: monster.areaId,
    } as ServerEvent)
    return missileUnitId
  }

  private resolveSkillDamageChannel(
    skillId: number,
  ): 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois' {
    if (skillId <= 0) return 'phys'
    switch (skillId) {
      // Magic damage skills
      case 6: // Magic Arrow
      case 67: // Teeth
      case 84: // Bone Spear
      case 93: // Bone Spirit
      case 101: // Holy Bolt
      case 112: // Blessed Hammer
      case 152: // Berserk
        return 'mag'
      // Fire damage skills
      case 7: // Fire Arrow
      case 16: // Exploding Arrow
      case 27: // Immolation Arrow
      case 36: // Fire Bolt
      case 41: // Inferno
      case 46: // Blaze
      case 47: // Fire Ball
      case 51: // Fire Wall
      case 52: // Enchant
      case 56: // Meteor
      case 62: // Hydra
      case 225: // Firestorm
      case 229: // Molten Boulder
      case 234: // Fissure
      case 239: // Fire Claws
      case 244: // Volcano
      case 249: // Armageddon
      case 251: // Fire Blast
      case 262: // Wake of Fire
      case 272: // Wake of Inferno
        return 'fire'
      // Lightning damage skills
      case 14: // Power Strike
      case 20: // Lightning Bolt
      case 24: // Charged Strike
      case 34: // Lightning Strike
      case 35: // Lightning Fury
      case 38: // Charged Bolt
      case 42: // Static Field
      case 48: // Nova
      case 49: // Lightning
      case 53: // Chain Lightning
      case 57: // Thunder Storm
      case 118: // Holy Shock
      case 121: // Fist of the Heavens
      case 256: // Shock Web
      case 259: // Claws of Thunder
      case 261: // Charged Bolt Sentry
      case 271: // Lightning Sentry
        return 'ltng'
      // Cold damage skills
      case 11: // Cold Arrow
      case 21: // Ice Arrow
      case 31: // Freezing Arrow
      case 39: // Ice Bolt
      case 44: // Frost Nova
      case 45: // Ice Blast
      case 55: // Glacial Spike
      case 59: // Blizzard
      case 64: // Frozen Orb
      case 114: // Holy Freeze
      case 230: // Arctic Blast
      case 250: // Hurricane
      case 280: // Blades of Ice
        return 'cold'
      // Poison damage skills
      case 15: // Poison Javelin
      case 25: // Plague Javelin
      case 73: // Poison Dagger
      case 83: // Poison Explosion
      case 92: // Poison Nova
      case 222: // Poison Creeper
      case 238: // Rabies
      case 278: // Venom
        return 'pois'
      default: {
        const sk = this.registry?.getSkillById(skillId)
        const et = sk?.eType?.toLowerCase() ?? ''
        if (et === 'fire') return 'fire'
        if (et === 'ltng') return 'ltng'
        if (et === 'cold' || et === 'free') return 'cold'
        if (et === 'mag') return 'mag'
        if (et === 'pois') return 'pois'
        return 'phys'
      }
    }
  }

  applyDamageToMonster(
    attackerOrMonsterId: InternalPlayerRecord | number,
    monsterOrDamage: InternalMonsterRecord | number,
    damageOrAttackerId?: number,
    skillIdArg = 0,
    channelOverride?: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois',
    source: 'player' | 'merc' = 'player',
  ): void {
    let attacker: InternalPlayerRecord | undefined
    let monster: InternalMonsterRecord | undefined
    let damage: number
    let skillId: number
    let effectiveSource: 'player' | 'merc' =
      source === 'merc' || (channelOverride as string | undefined) === 'merc' ? 'merc' : 'player'
    if (typeof attackerOrMonsterId === 'number') {
      monster = this.monsters.get(attackerOrMonsterId)
      damage = Number(monsterOrDamage)
      const mercAttacker =
        typeof damageOrAttackerId === 'number'
          ? this.mercenaries.get(damageOrAttackerId)
          : undefined
      if (mercAttacker !== undefined) {
        effectiveSource = 'merc'
      }
      attacker =
        (typeof damageOrAttackerId === 'number'
          ? (this.players.get(damageOrAttackerId) ??
            (mercAttacker !== undefined
              ? this.players.get(mercAttacker.ownerPlayerId)
              : undefined))
          : undefined) ?? this.players.values().next().value
      skillId = skillIdArg
    } else {
      attacker = attackerOrMonsterId
      monster = monsterOrDamage as InternalMonsterRecord
      damage = Number(damageOrAttackerId ?? 0)
      skillId = skillIdArg
    }
    if (!monster || monster.dead || monster.isNpc || !monster.isKillable) return
    monster.lastHitByMerc = effectiveSource === 'merc'
    if (!attacker) {
      attacker = {
        unitId: 0,
        name: 'DefaultAttacker',
        classId: 0,
        classCode: 'ama',
        level: 30,
        act: 0,
        areaId: monster.areaId,
        x: monster.x,
        y: monster.y,
        targetX: monster.x,
        targetY: monster.y,
        run: true,
        mode: 1,
        hp: 500,
        maxHp: 500,
        hpFixed: 500 * FIXED_ONE,
        maxHpFixed: 500 * FIXED_ONE,
        mana: 200,
        maxMana: 200,
        manaFixed: 200 * FIXED_ONE,
        maxManaFixed: 200 * FIXED_ONE,
        stamina: 200,
        maxStamina: 200,
        staminaFixed: 200 * FIXED_ONE,
        maxStaminaFixed: 200 * FIXED_ONE,
        staminaExhausted: false,
        experience: 0,
        gold: 0,
        goldBank: 0,
        strength: 50,
        dexterity: 50,
        vitality: 50,
        energy: 50,
        statPts: 0,
        newSkills: 0,
        leftSkill: 0,
        rightSkill: 0,
        skills: new Map(),
        states: new Set(),
        stateTimers: new Map(),
        items: [],
        corpseItems: [],
        ironGolemItem: null,
        waypoints: new Set([1]),
        hasExplicitWaypoints: false,
        activeWaypointUnitId: 0,
        unlockedAct: 0,
        lastWarpInteractFrame: -1000,
        revealedRoomKeys: new Set(),
        questFlags: new Uint16Array(48),
        vendorPools: new Map(),
        vendorPoolModes: new Map(),
        vendorPoolsByMode: new Map(),
        activeVendorMode: null,
        dead: false,
        corpseId: undefined,
        corpseX: 0,
        corpseY: 0,
        activeNpcId: undefined,
        partyId: 0xffff,
        d2sTemplate: undefined,
      }
    }
    if (attacker === undefined) return

    // 1.13c Holy Bolt (skillId 101): undead-only gate (deals 0 damage to non-undead targets)
    if (skillId === 101 && !monster.isUndead) {
      return
    }

    const attackerStats = new UnitStatList()
    attackerStats.setBaseStat('level', attacker.level)
    attackerStats.setBaseStat('maxhp', attacker.maxHpFixed)
    attackerStats.setHp256(attacker.hpFixed)
    attackerStats.setBaseStat('maxmana', attacker.maxManaFixed)
    attackerStats.setMana256(attacker.manaFixed)
    // Life / mana steal (D2Game 0x6FCFBA40) belongs to the real player that landed the hit; a
    // hireling hit routed through its owner (`source === 'merc'`) never steals for the owner.
    const stealer =
      effectiveSource === 'player' && this.players.get(attacker.unitId) === attacker ? attacker : undefined
    if (stealer !== undefined) {
      attackerStats.setBaseStat('lifedrainmindam', this.playerStealPct(stealer, 60))
      attackerStats.setBaseStat('manadrainmindam', this.playerStealPct(stealer, 62))
    }
    const attackerStateBus = new StateBus(attackerStats, this.registry)
    const attackerCtx: CombatUnitContext = {
      id: `player_${attacker.unitId}`,
      name: attacker.name,
      unitType: 'player',
      statList: attackerStats,
      stateBus: attackerStateBus,
      x: attacker.x,
      y: attacker.y,
      weaponMinPhys: 0,
      weaponMaxPhys: 0,
      lifeStealDivisor: difficultyLifeStealDivisor(this.difficulty),
      manaStealDivisor: difficultyManaStealDivisor(this.difficulty),
    }

    const defenderStats = new UnitStatList()
    defenderStats.setBaseStat('level', monster.level)
    defenderStats.setBaseStat('armorclass', monster.ac)
    defenderStats.setBaseStat('toblock', 0)
    defenderStats.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
    defenderStats.setHp256(monster.hp * FIXED_ONE)
    defenderStats.setBaseStat('damageresist', monster.resistances.phys)
    defenderStats.setBaseStat('magicresist', monster.resistances.magic)
    defenderStats.setBaseStat('fireresist', monster.resistances.fire)
    defenderStats.setBaseStat('lightresist', monster.resistances.light)
    defenderStats.setBaseStat('coldresist', monster.resistances.cold)
    defenderStats.setBaseStat('poisonresist', monster.resistances.poison)

    const defenderStateBus = new StateBus(defenderStats, this.registry)
    if (monster.states.has(9)) {
      defenderStateBus.applyState({
        stateNameOrId: 'amplifydamage',
        sourceSkillId: 66,
        slvl: 1,
        durationFrames: 100,
      })
    }
    if (monster.states.has(60)) {
      defenderStateBus.applyState({
        stateNameOrId: 'decrepify',
        sourceSkillId: 87,
        slvl: 1,
        durationFrames: 100,
      })
    }
    if (monster.states.has(61)) {
      defenderStateBus.applyState({
        stateNameOrId: 'lowerresist',
        sourceSkillId: 91,
        slvl: 10,
        durationFrames: 100,
      })
    }
    if (monster.states.has(28)) {
      defenderStateBus.applyState({
        stateNameOrId: 'conviction',
        sourceSkillId: 123,
        slvl: 10,
        durationFrames: 100,
        stats: { conviction_pierce: 75 },
      })
    }

    // Curses / aura debuffs (Conviction, Holy Freeze, ...) carried by the monster's persistent bus.
    this.mirrorPersistentStates(this.monsterCombat.get(monster.unitId), defenderStateBus)

    const defenderCtx: CombatUnitContext = {
      id: `monster_${monster.unitId}`,
      name: monster.name,
      unitType: 'monster',
      statList: defenderStats,
      stateBus: defenderStateBus,
      x: monster.x,
      y: monster.y,
      isUndead: monster.isUndead,
      isDemon: monster.isDemon,
      isBoss: monster.isBoss,
      isPrimeEvil: monster.isPrimeEvil,
      drain: monster.drain,
    }

    const channel = channelOverride ?? this.resolveSkillDamageChannel(skillId)
    const rawDmg = Math.max(1, Math.floor(damage))
    let dealtDamage = 0

    if (skillId === 42) {
      // 1.13c Static Field (skillId 42): 25% current HP reduction with difficulty floor caps
      const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId: 42,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'ltng',
        elemMin256: 0,
        elemMax256: 0,
        autoHit: true,
        unblockable: true,
      }, this.rng)
      if (dmgOut.immuneToElem || dmgOut.elemDamage256 <= 0) {
        return
      }
      const floorPct =
        this.difficulty === 2 ? 50 : this.difficulty === 1 ? 33 : 0
      const minHp =
        floorPct > 0
          ? Math.max(1, Math.floor((monster.maxHp * floorPct) / 100))
          : 1
      if (monster.hp <= minHp) {
        return
      }
      const staticLoss = Math.max(1, Math.floor(dmgOut.elemDamage256 / FIXED_ONE))
      const nextHp = Math.max(minHp, monster.hp - staticLoss)
      dealtDamage = monster.hp - nextHp
      if (dealtDamage <= 0) {
        return
      }
    } else if (channel === 'phys') {
      const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: rawDmg * FIXED_ONE,
        flatPhysMax256: rawDmg * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      }, this.rng)
      if (stealer !== undefined) this.applyPlayerStealOutcome(stealer, dmgOut)
      if (dmgOut.immuneToPhys || dmgOut.totalDamage256 <= 0) {
        return
      }
      dealtDamage = Math.max(1, Math.floor(dmgOut.totalDamage256 / FIXED_ONE))

      // 1.13c Crushing Blow (statId 136): 1/4 normal, 1/8 boss/unique/champion, mitigated by positive phys resist
      let cbChance = 0
      for (const item of attacker.items) {
        if (item.location === 'equipped') {
          cbChance += item.stats.get(136) ?? 0
        }
      }
      if (cbChance > 0 && (cbChance >= 100 || this.rng.rand(100) < cbChance)) {
        const isBossOrUnique =
          monster.isBoss ||
          monster.isPrimeEvil ||
          monster.rank === 'unique' ||
          monster.rank === 'champion'
        const cbDivisor = isBossOrUnique ? 8 : 4
        let cbLoss = Math.floor(monster.hp / cbDivisor)
        const effPhysRes = defenderStats.getAccruedStat('damageresist')
        if (effPhysRes > 0) {
          cbLoss = Math.floor(
            (cbLoss * (100 - Math.min(100, effPhysRes))) / 100,
          )
        }
        dealtDamage += Math.max(0, cbLoss)
      }
    } else if (channel === 'pois') {
      const sk = this.registry?.getSkillById(skillId)
      const dur = sk && sk.eLen > 0 ? sk.eLen : 50
      const rawBitrate256 = Math.max(1, Math.round((rawDmg * FIXED_ONE) / dur))
      this.applyMonsterPoisonDot(
        attacker,
        monster,
        rawBitrate256,
        dur,
        skillId,
        effectiveSource,
      )
      return
    } else {
      const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId,
        attackKind: 'spell',
        srcDam: 0,
        elemType: channel,
        elemMin256: rawDmg * FIXED_ONE,
        elemMax256: rawDmg * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      }, this.rng)
      if (dmgOut.immuneToElem || dmgOut.totalDamage256 <= 0) {
        return
      }
      dealtDamage = Math.max(1, Math.floor(dmgOut.totalDamage256 / FIXED_ONE))
    }

    this.finishMonsterDamage(attacker, monster, dealtDamage, skillId, channel)
  }

  /**
   * 1.13c poison application (`D2Game.dll` `0x6FCF6C60`): mitigates the rolled per-frame poison
   * bitrate (`1/256` HP/frame) against the monster's `poisonresist`, applies `STATE_POISON` (`2`)
   * for `durationFrames` (`ELen`), and arms per-frame ticking in `stepMonsterPoison`.
   */
  private applyMonsterPoisonDot(
    attacker: InternalPlayerRecord,
    monster: InternalMonsterRecord,
    rawBitrate256: number,
    durationFrames: number,
    skillId: number,
    effectiveSource: 'player' | 'merc' = 'player',
  ): void {
    if (monster.dead || monster.isNpc || !monster.isKillable) return
    if (rawBitrate256 <= 0 || durationFrames <= 0) return

    const attackerStats = new UnitStatList()
    attackerStats.setBaseStat('level', attacker.level)
    const attackerStateBus = new StateBus(attackerStats, this.registry)
    const attackerCtx: CombatUnitContext = {
      id: `player_${attacker.unitId}`,
      name: attacker.name,
      unitType: 'player',
      statList: attackerStats,
      stateBus: attackerStateBus,
      x: attacker.x,
      y: attacker.y,
    }

    const defenderStats = new UnitStatList()
    defenderStats.setBaseStat('level', monster.level)
    defenderStats.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
    defenderStats.setHp256(monster.hp * FIXED_ONE)
    defenderStats.setBaseStat('poisonresist', monster.resistances.poison)
    const defenderStateBus = new StateBus(defenderStats, this.registry)
    if (monster.states.has(61)) {
      defenderStateBus.applyState({
        stateNameOrId: 'lowerresist',
        sourceSkillId: 91,
        slvl: 10,
        durationFrames: 100,
      })
    }
    this.mirrorPersistentStates(this.monsterCombat.get(monster.unitId), defenderStateBus)

    const defenderCtx: CombatUnitContext = {
      id: `monster_${monster.unitId}`,
      name: monster.name,
      unitType: 'monster',
      statList: defenderStats,
      stateBus: defenderStateBus,
      x: monster.x,
      y: monster.y,
      isUndead: monster.isUndead,
      isDemon: monster.isDemon,
      isBoss: monster.isBoss,
      isPrimeEvil: monster.isPrimeEvil,
      drain: monster.drain,
    }

    const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
      skillId,
      attackKind: 'spell',
      srcDam: 0,
      elemType: 'pois',
      elemMin256: rawBitrate256,
      elemMax256: rawBitrate256,
      elemDurationFrames: durationFrames,
      autoHit: true,
      unblockable: true,
    }, this.rng)
    if (dmgOut.immuneToElem || dmgOut.elemDamage256 <= 0) {
      return
    }
    const bitrate256 = dmgOut.elemDamage256
    monster.lastHitByMerc = effectiveSource === 'merc'
    monster.threatPlayerId = attacker.unitId
    monster.threatUntilFrame = this.currentFrame + MONSTER_THREAT_FRAMES

    // In 1.13c (`0x6FCF6C60`), a new poison overrides when no poison is active or the new bitrate >= current
    if (monster.poisonRemainingFrames <= 0 || bitrate256 >= monster.poisonBitrate256) {
      monster.poisonBitrate256 = bitrate256
      monster.poisonRemainingFrames = durationFrames
      monster.poisonCarry256 = 0
      monster.poisonAttackerId = attacker.unitId
      monster.poisonSkillId = skillId
    }
    this.applyUnitState(
      monster.states,
      monster.stateTimers,
      'monster',
      monster.unitId,
      monster.areaId,
      2,
      monster.poisonRemainingFrames,
    )
  }

  /**
   * Apply resolved damage to a monster: HP loss, chill from cold skills, the HP update, Lightning
   * Enchanted on-struck bolts, and the death / get-hit mode (shared by hits and aura pulses).
   */
  private finishMonsterDamage(
    attacker: InternalPlayerRecord,
    monster: InternalMonsterRecord,
    dealtDamage: number,
    skillId: number,
    channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois',
  ): void {
    monster.hp = Math.max(0, monster.hp - dealtDamage)
    if (
      monster.umodIds.includes(26) &&
      monster.hp > 0 &&
      monster.hp * 2 < monster.maxHp &&
      this.currentFrame >= monster.teleportCooldownUntilFrame
    ) {
      this.teleportEliteAwayFrom(monster, attacker)
    }
    monster.threatPlayerId = attacker.unitId
    monster.threatUntilFrame = this.currentFrame + MONSTER_THREAT_FRAMES

    if (
      (skillId === 39 ||
        skillId === 44 ||
        skillId === 45 ||
        skillId === 55 ||
        skillId === 59 ||
        skillId === 64) &&
      monster.resistances.cold < 100 &&
      monster.coldEffect !== 0
    ) {
      this.applyUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        11,
        50,
      )
    }

    this.broadcastToArea(monster.areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId: monster.unitId,
      statId: 6,
      value: monster.hp,
    })

    // F12.4: MonUMod 17 `lightning` / 20 `scarab` emits `lightunique` (#195) on struck.
    const isLightningEnchanted =
      monster.umodIds.includes(MON_UMOD.LIGHTNING) ||
      monster.umodIds.includes(MON_UMOD.SCARAB) ||
      isScarabMonster(monster.hcIdx, monster.defId)
    if (isLightningEnchanted && monster.hp > 0) {
      const vectors = computeChargedBolt8WayVectors(monster.x, monster.y, 1.5)
      // MonUMod.txt constant 33 = % of the monster's rolled attack damage.
      const lightningUmodId = monster.umodIds.includes(MON_UMOD.LIGHTNING)
        ? MON_UMOD.LIGHTNING
        : MON_UMOD.SCARAB
      const rolledMonDmg =
        monster.maxDmg > monster.minDmg
          ? monster.minDmg + this.rng.rand(monster.maxDmg - monster.minDmg + 1)
          : monster.minDmg
      const boltDmg = Math.max(
        1,
        Math.floor(
          (rolledMonDmg * monUmodConstant113c(lightningUmodId)) / 100,
        ),
      )
      for (const vec of vectors) {
        this.spawnMonsterMissile(
          monster,
          vec.targetX,
          vec.targetY,
          boltDmg,
          195,
          195,
        )
      }
    }

    if (monster.hp <= 0) {
      this.applyMonsterDeath(monster, attacker, channel)
    } else {
      this.maybeEnterMonsterHitRecovery(monster, dealtDamage)
      const canBeInterrupted = !monster.isBoss && !monster.isPrimeEvil
      if (canBeInterrupted && this.sumPlayerItemStat(attacker, 117) > 0) {
        this.applyMonsterState(monster.unitId, 52, 120_000)
      }
      const isRadialAuraPulse = skillId > 0 && Boolean(this.registry.getSkillById(skillId)?.aura)
      const itemKnockback = !isRadialAuraPulse && this.sumPlayerItemStat(attacker, 81) > 0
      if (
        canBeInterrupted &&
        attacker.areaId === monster.areaId &&
        (MONSTER_KNOCKBACK_SKILLS.has(skillId) || itemKnockback)
      ) {
        this.knockbackMonster(monster, attacker.x, attacker.y)
      }
    }
  }

  /** Unified 1.13c monster death: shatter flag, death mode broadcast, drops / XP / death FX. */
  private applyMonsterDeath(
    monster: InternalMonsterRecord,
    creditedPlayer: InternalPlayerRecord | undefined,
    channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois',
  ): void {
    if (monster.dead) return
    monster.pendingAttack = undefined
    monster.pendingAllyAttack = undefined
    monster.pendingResurrection = undefined
    if (
      monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(11) ||
      monster.frozenTicks > 0 ||
      monster.chillTicks > 0 ||
      channel === 'cold'
    ) {
      monster.shattered = true
    }
    monster.dead = true
    monster.mode = 12
    monster.path = []
    monster.pathIndex = 0
    monster.pathTargetX = Number.NaN
    monster.pathTargetY = Number.NaN
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode: 12,
      lifePct: 0,
    })
    this.onMonsterKilled(creditedPlayer, monster)
  }

  private resolvePendingDeathExplosion(monster: InternalMonsterRecord): void {
    const pending = monster.pendingDeathExplosion
    if (pending === undefined || this.currentFrame < pending.frame) return
    monster.pendingDeathExplosion = undefined
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (Math.hypot(p.x - monster.x, p.y - monster.y) > pending.radius) continue
      this.applyPlayerElementalDamage(p, { phys: pending.phys, fire: pending.fire })
    }
    this.damageMercsAndPetsInRadius(
      monster.areaId,
      monster.x,
      monster.y,
      pending.radius,
      pending.phys,
      'phys',
    )
    this.damageMercsAndPetsInRadius(
      monster.areaId,
      monster.x,
      monster.y,
      pending.radius,
      pending.fire,
      'fire',
    )
  }

  /** MonUMod 26 Teleportation: blink away when badly hurt. */
  private teleportEliteAwayFrom(
    monster: InternalMonsterRecord,
    attacker: InternalPlayerRecord,
  ): void {
    const fromX = monster.x
    const fromY = monster.y
    const baseAngle = Math.atan2(monster.y - attacker.y, monster.x - attacker.x)
    for (const offset of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, Math.PI]) {
      const angle = baseAngle + offset
      const tx = monster.x + Math.cos(angle) * 8
      const ty = monster.y + Math.sin(angle) * 8
      if (
        this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) ||
        (this.terrainWalkableCheck &&
          !this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), monster.isFlying))
      ) {
        continue
      }
      if (this.isMonsterCellOccupied(monster, tx, ty)) continue
      monster.x = tx
      monster.y = ty
      monster.path = []
      monster.pathIndex = 0
      monster.pathTargetX = Number.NaN
      monster.pathTargetY = Number.NaN
      monster.mode = 1
      monster.teleportCooldownUntilFrame = this.currentFrame + 250
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMove',
        unitType: 'monster',
        id: monster.unitId,
        unitId: monster.unitId,
        mode: 'run',
        from: { x: Math.round(fromX), y: Math.round(fromY) },
        to: { x: Math.round(tx), y: Math.round(ty) },
        x: Math.round(tx),
        y: Math.round(ty),
        currentX: Math.round(tx),
        currentY: Math.round(ty),
        targetX: Math.round(tx),
        targetY: Math.round(ty),
        areaId: monster.areaId,
      })
      // 1.13c UMOD_TELEPORT restores one third of max life on landing.
      const heal = Math.max(1, Math.floor(monster.maxHp / 3))
      const nextHp = Math.min(monster.maxHp, monster.hp + heal)
      if (nextHp > monster.hp) {
        monster.hp = nextHp
        this.broadcastToArea(monster.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: monster.unitId,
          statId: 6,
          value: monster.hp,
        })
      }
      return
    }
  }

  /** AnimData `{code}GH{baseW}` / `{code}GHHTH` full animation duration in 25 Hz frames. */
  private monsterHitRecoveryFrames(monster: InternalMonsterRecord): number {
    const monRow = MONSTATS_113C_ROWS[monster.hcIdx]
    const code = monRow?.code?.trim().toUpperCase()
    if (code !== undefined && code !== '') {
      const baseW = monRow?.baseW?.trim().toUpperCase() || 'HTH'
      const record =
        this.registry.getAnimDataRecord(`${code}GH${baseW}`) ??
        (baseW !== 'HTH' ? this.registry.getAnimDataRecord(`${code}GHHTH`) : undefined)
      if (record !== undefined && record.framesPerDirection > 0 && record.hasSpeed) {
        const speed = Math.max(1, record.animationSpeed)
        return Math.max(1, Math.floor((record.framesPerDirection * 256) / speed))
      }
    }
    return MONSTER_HIT_RECOVERY_FRAMES
  }

  /** 1.13c gethit: tiered max-life threshold (`3/8`, `1/6`, `1/12`), `neverCount` / `mGH` gates, and `AnimData.d2` `GH` lock. */
  private maybeEnterMonsterHitRecovery(
    monster: InternalMonsterRecord,
    dealtDamage: number,
  ): void {
    if (monster.dead || monster.isBoss || monster.isPrimeEvil) return
    const monRow = MONSTATS_113C_ROWS[monster.hcIdx]
    if (monRow?.neverCount) return
    if (
      monster.hcIdx >= 0 &&
      monster.hcIdx * MONSTER_PATH_DATA_STRIDE + 12 < MONSTER_PATH_DATA.length &&
      (MONSTER_PATH_DATA[monster.hcIdx * MONSTER_PATH_DATA_STRIDE + 12]! & 0x08) === 0
    ) {
      return
    }
    if (
      monster.frozenTicks > 0 ||
      monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25)
    ) {
      return
    }
    // 1.13c gethit probability tiers: >= 3/8 max life always, >= 1/6 75%,
    // >= 1/12 37.5%, below 1/12 never.
    const ratio = monster.maxHp > 0 ? dealtDamage / monster.maxHp : 0
    let chancePct = 0
    if (ratio >= 3 / 8) chancePct = 100
    else if (ratio >= 1 / 6) chancePct = 75
    else if (ratio >= 1 / 12) chancePct = 38
    if (chancePct <= 0 || this.rng.rand(100) >= chancePct) return
    monster.pendingAttack = undefined
    monster.pendingAllyAttack = undefined
    monster.pendingResurrection = undefined
    monster.hitRecoveryUntilFrame = this.currentFrame + this.monsterHitRecoveryFrames(monster)
    monster.path = []
    monster.pathIndex = 0
    monster.pathTargetX = Number.NaN
    monster.pathTargetY = Number.NaN
    monster.mode = 3
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode: 3,
      lifePct:
        monster.maxHp > 0
          ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128))
          : 0,
    })
  }

  /**
   * Confusion (59) / Attract (57) / Conversion (53) monster-vs-monster attack. Runs the
   * shared `executeSUnitDmg` physical pipeline (to-hit, block, resistances) and then the
   * unified death flow so clients, drops, XP and death effects all observe the kill.
   */
  private attackMonsterTarget(
    attacker: InternalMonsterRecord,
    target: InternalMonsterRecord,
  ): void {
    if (target.dead || attacker.dead) return
    const attackerStats = new UnitStatList()
    attackerStats.setBaseStat('level', attacker.level)
    attackerStats.setBaseStat('tohit', attacker.ar)
    attackerStats.setBaseStat('maxhp', attacker.maxHp * FIXED_ONE)
    attackerStats.setHp256(attacker.hp * FIXED_ONE)
    const attackerCtx: CombatUnitContext = {
      id: `monster_${attacker.unitId}`,
      name: attacker.name,
      unitType: 'monster',
      statList: attackerStats,
      stateBus: new StateBus(attackerStats, this.registry),
      x: attacker.x,
      y: attacker.y,
      isUndead: attacker.isUndead,
      isDemon: attacker.isDemon,
      isBoss: attacker.isBoss,
      isPrimeEvil: attacker.isPrimeEvil,
      coldEffect: attacker.coldEffect,
    }

    const defenderStats = new UnitStatList()
    defenderStats.setBaseStat('level', target.level)
    defenderStats.setBaseStat('armorclass', target.ac)
    defenderStats.setBaseStat('toblock', target.toBlock)
    defenderStats.setBaseStat('maxhp', target.maxHp * FIXED_ONE)
    defenderStats.setHp256(target.hp * FIXED_ONE)
    defenderStats.setBaseStat('damageresist', target.resistances.phys)
    defenderStats.setBaseStat('magicresist', target.resistances.magic)
    defenderStats.setBaseStat('fireresist', target.resistances.fire)
    defenderStats.setBaseStat('lightresist', target.resistances.light)
    defenderStats.setBaseStat('coldresist', target.resistances.cold)
    defenderStats.setBaseStat('poisonresist', target.resistances.poison)
    const defenderStateBus = new StateBus(defenderStats, this.registry)
    this.mirrorPersistentStates(this.monsterCombat.get(target.unitId), defenderStateBus)
    const defenderCtx: CombatUnitContext = {
      id: `monster_${target.unitId}`,
      name: target.name,
      unitType: 'monster',
      statList: defenderStats,
      stateBus: defenderStateBus,
      x: target.x,
      y: target.y,
      isUndead: target.isUndead,
      isDemon: target.isDemon,
      isBoss: target.isBoss,
      isPrimeEvil: target.isPrimeEvil,
      coldEffect: target.coldEffect,
      drain: target.drain,
    }

    this.broadcastToArea(attacker.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: attacker.unitId,
      mode: 4,
      at: { x: Math.round(attacker.x), y: Math.round(attacker.y) },
      lifePct:
        attacker.maxHp > 0
          ? Math.round((attacker.hp / attacker.maxHp) * 128)
          : 0,
    })
    const auraDmgPct = this.monsterAuraDamageBonusPct(attacker)
    // Confused/attracted monsters use their real A1/A2 damage riders too, not
    // just the pure physical band.
    const rider = attacker.elementalAttacks.find(
      (entry) =>
        (entry.mode === 'A1' || entry.mode === 'A2') &&
        (entry.chancePct >= 100 || this.rng.rand(100) < entry.chancePct),
    )
    const riderType =
      rider?.type === 'ltng'
        ? 'ltng'
        : rider?.type === 'cold' || rider?.type === 'frze'
          ? 'cold'
          : rider?.type === 'pois'
            ? 'pois'
            : rider?.type === 'mag'
              ? 'mag'
              : rider?.type === 'fire'
                ? 'fire'
                : undefined
    const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
      skillId: 0,
      attackKind: 'melee',
      srcDam: 0,
      flatPhysMin256: Math.floor(attacker.minDmg * FIXED_ONE * (1 + auraDmgPct / 100)),
      flatPhysMax256: Math.floor(attacker.maxDmg * FIXED_ONE * (1 + auraDmgPct / 100)),
      ...(riderType !== undefined
        ? {
            elemType: riderType,
            elemMin256:
              Math.max(0, rider?.minDamage ?? rider?.min ?? 0) * FIXED_ONE,
            elemMax256:
              Math.max(0, rider?.maxDamage ?? rider?.max ?? 0) * FIXED_ONE,
            elemDurationFrames: rider?.durationFrames ?? rider?.duration ?? 0,
          }
        : {}),
    }, this.rng)
    if (!dmgOut.hit) return
    const dealtDamage = Math.floor(dmgOut.totalDamage256 / FIXED_ONE)
    if (dealtDamage <= 0) return

    target.hp = Math.max(0, target.hp - dealtDamage)
    this.broadcastToArea(target.areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId: target.unitId,
      statId: 6,
      value: target.hp,
    })
    if (target.hp <= 0) {
      const credited = this.creditedPlayerForMonsterKill(attacker, target)
      this.applyMonsterDeath(target, credited, 'phys')
    } else {
      this.maybeEnterMonsterHitRecovery(target, dealtDamage)
    }
  }

  /** Direct conversion (53) or curse (Attract 57 / Confuse 59) caster on a single monster without fallback. */
  private directCreditedPlayerForMonster(
    monster: InternalMonsterRecord,
  ): InternalPlayerRecord | undefined {
    const converted = this.players.get(monster.convertedByPlayerId)
    if (converted && !converted.dead && converted.areaId === monster.areaId) {
      return converted
    }
    for (const entry of this.monsterCombat.get(monster.unitId)?.stateBus.getActiveEntries() ?? []) {
      if (entry.stateId !== 53 && entry.stateId !== 57 && entry.stateId !== 59) continue
      const sourceId = Number.parseInt(entry.sourceUnitId.replace(/^player_/, ''), 10)
      const source = Number.isFinite(sourceId) ? this.players.get(sourceId) : undefined
      if (source && !source.dead && source.areaId === monster.areaId) return source
    }
    return undefined
  }

  /**
   * Curse / conversion caster credited for a monster-vs-monster kill (`D2Game.dll`
   * `SUNITDMG_GetMasterUnit`): checks `attacker` first, then `target` (e.g. a normal monster
   * killing an Attracted/Converted target), and only falls back to the nearest living player
   * in the area when neither monster carries an explicit caster unit.
   */
  private creditedPlayerForMonsterKill(
    attacker: InternalMonsterRecord,
    target?: InternalMonsterRecord,
  ): InternalPlayerRecord | undefined {
    const directAttacker = this.directCreditedPlayerForMonster(attacker)
    if (directAttacker !== undefined) return directAttacker
    if (target !== undefined) {
      const directTarget = this.directCreditedPlayerForMonster(target)
      if (directTarget !== undefined) return directTarget
    }
    let nearest: InternalPlayerRecord | undefined
    let nearestDist = Infinity
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== attacker.areaId) continue
      const d = Math.hypot(p.x - attacker.x, p.y - attacker.y)
      if (d < nearestDist) {
        nearestDist = d
        nearest = p
      }
    }
    return nearest
  }

  /**
   * 1.13c knockback: push the target away from the attacker until the terrain blocks the
   * path (D2Common `PATHTYPE_KNOCKBACK_SERVER`). Clients animate the `kb` path (`cmd 0x14`).
   */
  private knockbackMonster(
    monster: InternalMonsterRecord,
    fromX: number,
    fromY: number,
  ): void {
    const dx = monster.x - fromX
    const dy = monster.y - fromY
    const len = Math.hypot(dx, dy)
    if (!Number.isFinite(len) || len <= 0) return
    const ux = dx / len
    const uy = dy / len
    // Fixed turrets and prime evils cannot be knocked back. 1.13c size
    // resistance: Small 100%, Medium 50%, Large 25%; travel is 2-3 sub-tiles.
    if (monster.velocity <= 0) return
    if (monster.isBoss && monster.isPrimeEvil) return
    const sizeChance = monster.sizeX <= 1 ? 100 : monster.sizeX === 2 ? 50 : 25
    if (this.rng.rand(100) >= sizeChance) return
    const knockDistance = 2 + this.rng.rand(MONSTER_KNOCKBACK_DISTANCE - 1)
    const startX = monster.x
    const startY = monster.y
    let endX = startX
    let endY = startY
    for (let travelled = 1; travelled <= knockDistance; travelled++) {
      const tx = startX + ux * travelled
      const ty = startY + uy * travelled
      if (!this.isMonsterStepWalkable(monster.areaId, endX, endY, tx, ty, monster.isFlying)) {
        break
      }
      if (this.isMonsterCellOccupied(monster, tx, ty)) break
      endX = tx
      endY = ty
    }
    if (endX === startX && endY === startY) return
    monster.x = endX
    monster.y = endY
    monster.mode = MONMODE_KNOCKBACK
    monster.pendingAttack = undefined
    monster.pendingAllyAttack = undefined
    monster.pendingResurrection = undefined
    monster.path = []
    monster.pathIndex = 0
    monster.pathTargetX = Number.NaN
    monster.pathTargetY = Number.NaN
    const from = { x: Math.round(startX), y: Math.round(startY) }
    const at = { x: Math.round(endX), y: Math.round(endY) }
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMove',
      unitType: 'monster',
      id: monster.unitId,
      unitId: monster.unitId,
      mode: 'knockback',
      from,
      to: at,
      x: at.x,
      y: at.y,
    })
  }

  /**
   * Broadcast a static Missiles.txt explosion (the death effect itself is resolved
   * server-side so it can use the full physical/fire split and player resistances).
   */
  private broadcastExplosionMissile(
    monster: InternalMonsterRecord,
    missileClassId: number,
  ): void {
    const at = { x: Math.round(monster.x), y: Math.round(monster.y) }
    this.broadcastToArea(monster.areaId, {
      type: 'CreateMissile',
      missileId: this.allocateUnitId(),
      missileClassId,
      at,
      target: at,
      x: at.x,
      y: at.y,
      targetX: at.x,
      targetY: at.y,
      skillId: missileClassId,
      level: Math.max(1, monster.level),
      ownerType: 1,
      ownerUnitType: 'monster',
      ownerId: monster.unitId,
      sourceUnitId: monster.unitId,
      areaId: monster.areaId,
    } as ServerEvent)
  }

  /**
   * Player resistance % from equipped item stats + persistent states (monster damage side).
   * Player branch of `D2Game.dll` 0x6FCFB3C0: elemental channels add `DifficultyLevels.txt`
   * `ResistPenalty`, then `res <= 0 ? max(-100, res) : min(res, cap)` with
   * cap = 50 (`damageresist`) or `min(95, 75 + max{elem}resist)`.
   */
  private playerResistPct(
    player: InternalPlayerRecord,
    kind: 'phys' | 'fire' | 'cold' | 'light',
  ): number {
    const resStatId = { phys: 36, fire: 39, cold: 43, light: 41 }[kind]
    const maxStatId = { phys: undefined, fire: 40, cold: 44, light: 42 }[kind]
    let value = 0
    let maxBonus = 0
    for (const item of player.items) {
      if (item.location !== 'equipped') continue
      value += item.stats.get(resStatId) ?? 0
      if (maxStatId !== undefined) maxBonus += item.stats.get(maxStatId) ?? 0
    }
    const statName =
      kind === 'phys'
        ? 'damageresist'
        : kind === 'fire'
          ? 'fireresist'
          : kind === 'cold'
            ? 'coldresist'
            : 'lightresist'
    const combat = this.playerCombatContext(player)
    value += Math.trunc(combat.statList.getAccruedStat(statName))
    if (kind === 'phys') {
      return value <= 0 ? Math.max(-100, value) : Math.min(value, 50)
    }
    value -= combat.statList.getModifierBonus('conviction_pierce')
    value += difficultyResistPenalty(this.difficulty)
    const maxStatName = kind === 'fire' ? 'maxfireresist' : kind === 'cold' ? 'maxcoldresist' : 'maxlightresist'
    maxBonus += Math.trunc(combat.statList.getAccruedStat(maxStatName))
    const cap = Math.min(95, 75 + maxBonus)
    return value <= 0 ? Math.max(-100, value) : Math.min(value, cap)
  }

  /** Apply the 1.13c physical + elemental split with player resistances and damage reduce. */
  private applyPlayerElementalDamage(
    player: InternalPlayerRecord,
    parts: {
      readonly phys?: number | undefined
      readonly fire?: number | undefined
      readonly cold?: number | undefined
      readonly light?: number | undefined
    },
  ): void {
    let total = 0
    for (const kind of ['phys', 'fire', 'cold', 'light'] as const) {
      const dmg = parts[kind] ?? 0
      if (dmg <= 0) continue
      total += Math.max(0, Math.round(dmg * (1 - this.playerResistPct(player, kind) / 100)))
    }
    if (total > 0) this.applyDamageToPlayer(player, total)
  }

  /** Broadcast a mercenary/pet HP change and its death removal (UNIT_MONSTER view). */
  private broadcastAllyHp(areaId: number, unitId: number, hp: number): void {
    const merc = this.mercenaries.get(unitId)
    let ownerId = merc?.ownerPlayerId
    let maxHp = merc?.maxHp ?? 0
    if (!merc) {
      for (const [candidateOwnerId, mgr] of this.summonManagers) {
        for (const pet of mgr.getActivePets()) {
          if (this.petUnitIds.get(pet.uid) === unitId) {
            ownerId = candidateOwnerId
            maxHp = pet.maxHp
            break
          }
        }
        if (ownerId !== undefined) break
      }
    }
    if (maxHp > 0) {
      this.broadcastToArea(areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId,
        statId: 7,
        value: Math.max(1, Math.floor(maxHp)),
      })
    }
    this.broadcastToArea(areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId,
      statId: 6,
      value: Math.max(0, Math.floor(hp)),
    })
    if (ownerId !== undefined && maxHp > 0) {
      const lifePct100 =
        hp <= 0 ? 0 : Math.min(100, Math.max(1, Math.round((hp * 100) / maxHp)))
      this.emitToPlayer(ownerId, {
        type: 'Party',
        kind: 'memberState',
        isPlayer: false,
        relation: 0,
        unitId,
        lifePct: lifePct100,
        areaId,
      })
    }
  }

  private resolvePetUnitId(pet: SummonedPetUnit): number {
    const existing =
      this.petUnitIds.get(pet.uid) ??
      (pet as unknown as { unitId?: number }).unitId
    if (existing !== undefined) return existing
    const allocated = stableUnitKey(pet.uid)
    this.petUnitIds.set(pet.uid, allocated)
    ;(pet as unknown as { unitId?: number }).unitId = allocated
    return allocated
  }

  private handlePetDeath(
    pet: SummonedPetUnit,
    areaId: number,
    petUnitId: number,
    ownerIdOverride?: number,
  ): void {
    pet.hp = 0
    pet.alive = false
    for (const [ownerPlayerId, mgr] of this.summonManagers) {
      if (ownerIdOverride !== undefined && ownerPlayerId !== ownerIdOverride) continue
      if (ownerIdOverride === undefined && !mgr.getActivePets().some((p) => p === pet)) continue
      const removed =
        typeof (mgr as { removeSummon?: (id: string | number) => unknown }).removeSummon === 'function'
          ? (mgr as { removeSummon: (id: string | number) => unknown }).removeSummon(pet.uid)
          : typeof (mgr as { removePetByUid?: (uid: string) => unknown }).removePetByUid === 'function'
            ? (mgr as { removePetByUid: (uid: string) => unknown }).removePetByUid(pet.uid)
            : undefined
      if (removed || ownerIdOverride !== undefined) {
        this.petUnitIds.delete(pet.uid)
        const petTypeIdx = PET_TYPE_IDX_BY_NAME_113C[pet.petType] ?? 1
        this.emitToPlayer(ownerPlayerId, {
          type: 'Merc',
          kind: 'assign',
          isSummonAction: true,
          summonAction: 0,
          petType: petTypeIdx,
          mercId: petUnitId,
          ownerId: ownerPlayerId,
          classId: pet.sourceSkillId,
        })
        break
      }
    }
    this.broadcastAllyRemoved(areaId, petUnitId)
  }

  private broadcastAllyRemoved(areaId: number, unitId: number): void {
    this.broadcastToArea(areaId, {
      type: 'UnitRemove',
      unitType: 'monster',
      id: unitId,
      unitId,
      areaId,
    })
  }

  applyDamageToMerc(
    mercUnitIdOrRecord: number | InternalMercenaryRecord,
    damage: number,
    areaIdOverride?: number,
  ): void {
    const merc =
      typeof mercUnitIdOrRecord === 'number'
        ? this.mercenaries.get(mercUnitIdOrRecord)
        : mercUnitIdOrRecord
    if (!merc || !merc.alive) return
    const dmg = Math.max(0, Math.floor(damage))
    merc.hp = Math.max(0, merc.hp - dmg)
    const areaId = areaIdOverride ?? merc.areaId
    this.broadcastAllyHp(areaId, merc.unitId, merc.hp)
    if (merc.hp <= 0) {
      merc.hp = 0
      merc.alive = false
      merc.state = 'dead'
      this.broadcastAllyRemoved(areaId, merc.unitId)
    }
  }

  applyDamageToSummon(
    ownerIdOrPet: number | SummonedPetUnit,
    petOrDamage: SummonedPetUnit | string | number,
    damageOverride?: number,
    areaIdOverride?: number,
  ): void {
    let ownerId: number | undefined
    let pet: SummonedPetUnit | undefined
    let damage = 0
    let areaId = areaIdOverride
    if (typeof ownerIdOrPet === 'number') {
      ownerId = ownerIdOrPet
      pet =
        typeof petOrDamage === 'object' && petOrDamage !== null
          ? petOrDamage
          : this.getPetState(petOrDamage)
      damage = damageOverride ?? 0
    } else {
      pet = ownerIdOrPet
      damage = typeof petOrDamage === 'number' ? petOrDamage : (damageOverride ?? 0)
      if (areaId === undefined && typeof damageOverride === 'number') {
        areaId = damageOverride
      }
      for (const [candidateOwnerId, mgr] of this.summonManagers) {
        if (mgr.getActivePets().some((p) => p === pet || p.uid === pet!.uid)) {
          ownerId = candidateOwnerId
          break
        }
      }
    }
    if (!pet || pet.alive === false) return
    const dmg = Math.max(0, Math.floor(damage))
    pet.hp = Math.max(0, pet.hp - dmg)
    pet.statList?.setHp256(pet.hp * FIXED_ONE)
    const owner = ownerId !== undefined ? this.players.get(ownerId) : undefined
    const resolvedAreaId =
      areaId ??
      (pet as unknown as { areaId?: number }).areaId ??
      owner?.areaId ??
      this.defaultAreaId ??
      1
    const petUnitId = this.resolvePetUnitId(pet)
    this.broadcastAllyHp(resolvedAreaId, petUnitId, pet.hp)
    if (pet.hp <= 0) {
      this.handlePetDeath(pet, resolvedAreaId, petUnitId, ownerId)
    }
  }

  /** Death explosions also hit the mercenary / summons the issue called out. */
  private damageMercsAndPetsInRadius(
    areaId: number,
    x: number,
    y: number,
    radius: number,
    damage: number,
    element: 'phys' | 'fire' | 'cold' | 'light' = 'phys',
  ): void {
    const resistStat =
      element === 'fire'
        ? 'fireresist'
        : element === 'cold'
          ? 'coldresist'
          : element === 'light'
            ? 'lightresist'
            : 'damageresist'
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || merc.areaId !== areaId) continue
      const mercOwner = this.players.get(merc.ownerPlayerId)
      if (mercOwner !== undefined && (mercOwner.dead || mercOwner.areaId !== areaId)) continue
      if (Math.hypot(merc.x - x, merc.y - y) > radius) continue
      const applied = Math.max(
        1,
        Math.floor(damage * (1 - Math.max(-100, Math.min(100, merc.resist)) / 100)),
      )
      this.applyDamageToMerc(merc, applied, areaId)
    }
    for (const [ownerId, mgr] of this.summonManagers) {
      const owner = this.players.get(ownerId)
      if (owner === undefined || owner.dead || owner.areaId !== areaId) continue
      for (const pet of [...mgr.getActivePets()]) {
        if (pet.alive === false || pet.hp <= 0) continue
        if (Math.hypot(pet.x - x, pet.y - y) > radius) continue
        const petResist = Math.max(
          -100,
          Math.min(100, pet.statList.getAccruedStat(resistStat)),
        )
        const applied = Math.max(1, Math.floor(damage * (1 - petResist / 100)))
        this.applyDamageToSummon(ownerId, pet, applied, areaId)
      }
    }
  }

  /** `Skills.txt` `aurarangecalc` of an aura row evaluated at `slvl` (sub-tiles, 0x6FCC0C70 radius). */
  private auraRangeSubtiles(skillId: number, slvl: number): number {
    const skill = this.registry.getSkillById(skillId)
    if (!skill || !skill.auraRangeCalc) return 0
    return evaluateCalc(skill.auraRangeCalc, {
      registry: this.registry,
      activeSkill: skill,
      slvl,
      blvl: slvl,
      getBaseSkillLevel: () => slvl,
      getEffectiveSkillLevel: () => slvl,
    })
  }

  /** Might / Fanaticism aura damage bonus for a monster (party bonus for allies). */
  private monsterAuraDamageBonusPct(monster: InternalMonsterRecord): number {
    let bonusPct = 0
    for (const auraMonster of this.monsters.values()) {
      if (
        auraMonster.dead ||
        auraMonster.isNpc ||
        auraMonster.areaId !== monster.areaId ||
        auraMonster.auraSkillId === undefined
      ) {
        continue
      }
      const lvl = Math.max(1, auraMonster.level)
      const dx = auraMonster.x - monster.x
      const dy = auraMonster.y - monster.y
      if (auraMonster.auraSkillId === 98) {
        const might = calculateMightStats(lvl)
        if (isWithinAuraRange(dx, dy, might.radiusSubtiles)) bonusPct = Math.max(bonusPct, might.damagePercent)
      } else if (auraMonster.auraSkillId === 122) {
        const fan = calculateFanaticismStats(lvl)
        if (isWithinAuraRange(dx, dy, fan.radiusSubtiles)) {
          bonusPct = Math.max(
            bonusPct,
            auraMonster === monster ? fan.casterDamagePercent : fan.partyDamagePercent,
          )
        }
      }
    }
    return bonusPct
  }

  /** Aura Enchanted (`MonUMod` 30): apply the 1.13c aura to nearby units each tick. */
  private applyMonsterAura(monster: InternalMonsterRecord): void {
    const auraId = monster.auraSkillId
    if (auraId === undefined || monster.dead) return
    const lvl = Math.max(1, monster.level)
    // 0x6FCC0C70: radius = the aura row's evaluated `aurarangecalc` (Holy Freeze `ln12` = 6 + (lvl-1),
    // Conviction `ln12` = 20 + 0), hit when sub-tile `dx² + dy² <= r²`.
    const radius = this.auraRangeSubtiles(auraId, lvl)
    const outOfRange = (x: number, y: number): boolean => !isWithinAuraRange(x - monster.x, y - monster.y, radius)

    if (auraId === 114) {
      // Holy Freeze: chill nearby players. `aurafilter = 0x4A283` carries `0x8000` (enemy only,
      // 0x6FD00A60), so the monster's own allies are never chilled.
      if (this.currentFrame % 25 !== 0) return
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        if (outOfRange(p.x, p.y)) continue
        this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, 11, 75)
      }
      return
    }
    if (auraId === 123) {
      // Conviction: state 28 on nearby players/monsters (resist pierce is applied by
      // the persistent combat StateBus when the target's damage is resolved).
      if (this.currentFrame % 25 !== 0) return
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        if (outOfRange(p.x, p.y)) continue
        this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, 28, 75)
        const convSlvl = Math.max(1, Math.floor(lvl / 8))
        const conv = calculateConvictionStats(convSlvl)
        this.playerCombatContext(p).stateBus.applyState({
          stateNameOrId: 'conviction',
          sourceSkillId: 123,
          slvl: convSlvl,
          durationFrames: 75,
          stats: {
            conviction_pierce: conv.resistanceReductionPct,
            defense_pct: -conv.defenseReductionPct,
          },
        })
      }
      // `aurafilter = 0xA583` carries `0x8000` (enemy only): fellow monsters are not convicted.
      return
    }
    if (auraId === 102 || auraId === 118) {
      // Holy Fire / Holy Shock elemental pulse every 50 ticks (1.13c perdelay).
      if (this.currentFrame % 50 !== 0) return
      const pulse =
        auraId === 102
          ? calculateHolyFireStats(lvl)
          : calculateHolyShockStats(lvl)
      const dmg =
        pulse.pulseMin +
        this.rng.rand(Math.max(1, pulse.pulseMax - pulse.pulseMin + 1))
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        if (outOfRange(p.x, p.y)) continue
        this.applyPlayerElementalDamage(p, auraId === 102 ? { fire: dmg } : { light: dmg })
      }
    }
  }

  private onMonsterKilled(
    killer: InternalPlayerRecord | undefined,
    monster: InternalMonsterRecord,
  ): void {
    const isSuicide = isSuicideMinionMonster(monster.hcIdx, monster.defId)
    if (!isSuicide && killer) {
      const px = this.playersX
      const baseXp = Math.max(1, Math.floor((monster.baseXp * (px + 1)) / 2))

      const recipients: InternalPlayerRecord[] = []
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        // 1.13c EXP_DivideExperience: only same-party players within two
        // screens (53.3 sub-tiles) share the kill.
        if (Math.hypot(p.x - monster.x, p.y - monster.y) > 53.3) continue
        if (
          p.unitId === killer.unitId ||
          (killer.partyId !== 0xffff && p.partyId === killer.partyId)
        ) {
          recipients.push(p)
        }
      }
      if (recipients.length === 0) recipients.push(killer)

      const totalXp = partyExpPool113c(baseXp, recipients.length)
      const sumLevels = recipients.reduce((sum, p) => sum + Math.max(1, p.level), 0)
      for (const p of recipients) {
        const shareXp = partyExpShare113c(totalXp, p.level, sumLevels)
        if (shareXp > 0) this.grantExperience(p, shareXp, monster.level)
      }

      this.rollMonsterDeathDrop(killer, monster)
    }

    // 1.13c side/quest bosses complete their quest on death and drop their quest items:
    // - Radament (0x6FCE7660): Book of Skill ('ass')
    // - Hephasto (0x6FCDA810): Hellforge Hammer ('hfh')
    // - Mephisto (0x6FD09C0D): Mephisto's Soulstone ('mss') on first kill
    if (killer) {
      const defId = monster.defId.toLowerCase()
      const suId = (monster.superUniqueId ?? '').toLowerCase()
      const isHephasto =
        defId.startsWith('hephasto') ||
        suId.includes('hephasto')
      if (
        isHephasto &&
        !hasQuestFlag113c(killer.questFlags, 'a4q2', QUEST_FLAG_COMPLETED_113C) &&
        !this.playerOrGroundHasQuestItem(killer, 'hfh')
      ) {
        const hammer = this.createQuestDropItem('hfh', monster.level)
        if (hammer) this.spawnDroppedItems([hammer], monster.areaId, monster.x, monster.y)
      }
      if (
        defId.startsWith('mephisto') &&
        !this.playerOrGroundHasQuestItem(killer, 'mss')
      ) {
        const soulstone = this.createQuestDropItem('mss', monster.level)
        if (soulstone) this.spawnDroppedItems([soulstone], monster.areaId, monster.x, monster.y)
      }
      const quest = QUEST_BOSS_KILL_113C.find(
        ([prefix]) => defId.startsWith(prefix) || (suId !== '' && suId.startsWith(prefix)),
      )
      if (
        quest !== undefined &&
        !hasQuestFlag113c(killer.questFlags, quest[1], QUEST_FLAG_COMPLETED_113C)
      ) {
        if (
          quest[1] === 'a2q1' &&
          !this.playerOrGroundHasQuestItem(killer, 'ass')
        ) {
          const book = this.createQuestDropItem('ass', monster.level)
          if (book) this.spawnDroppedItems([book], monster.areaId, monster.x, monster.y)
        }
        const mask =
          quest[1] === 'a5q1' || quest[1] === 'a5q4'
            ? QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C
            : QUEST_FLAG_COMPLETED_113C
        this.setPlayerQuestFlag(killer, quest[1], mask)
      }
    }

    // Chaos Sanctuary: once the three seal bosses die and all five seals are
    // open, spawn Diablo in the middle of the seal ring.
    if (
      monster.superUniqueId !== undefined &&
      Object.values(SEAL_BOSS_113C).some((boss) => boss.superUniqueId === monster.superUniqueId)
    ) {
      let deaths = this.sealBossDeaths.get(monster.areaId)
      if (deaths === undefined) {
        deaths = new Set()
        this.sealBossDeaths.set(monster.areaId, deaths)
      }
      deaths.add(monster.superUniqueId)
      if (deaths.size >= 3 && !this.diabloSpawnedAreas.has(monster.areaId)) {
        const sealIds = [392, 393, 394, 395, 396]
        const seals = [...this.objects.values()].filter(
          (obj) => obj.areaId === monster.areaId && sealIds.includes(obj.classId) && obj.mode === 2,
        )
        if (seals.length === sealIds.length) {
          this.diabloSpawnedAreas.add(monster.areaId)
          const x = seals.reduce((sum, obj) => sum + obj.x, 0) / seals.length
          const y = seals.reduce((sum, obj) => sum + obj.y, 0) / seals.length
          this.spawnMonster({ defId: 'diablo', x, y, areaId: monster.areaId })
        }
      }
    }

    // Travincal Council: all three council members must die for a3q5 and drop Khalim's Flail ('qf1', 0x6FD07E36).
    if (monster.defId.toLowerCase().startsWith('councilmember')) {
      let deaths = this.councilDeaths.get(monster.areaId)
      if (deaths === undefined) {
        deaths = new Set()
        this.councilDeaths.set(monster.areaId, deaths)
      }
      deaths.add(monster.defId.toLowerCase())
      if (deaths.size >= 3 && killer) {
        if (!this.playerOrGroundHasQuestItem(killer, 'qf1')) {
          const flail = this.createQuestDropItem('qf1', monster.level)
          if (flail) this.spawnDroppedItems([flail], monster.areaId, monster.x, monster.y)
        }
        this.setPlayerQuestFlag(killer, 'a3q5', QUEST_FLAG_COMPLETED_113C)
      }
    }

    // Ancients: killing all three barbarians completes a5q5.
    if (
      monster.superUniqueId !== undefined &&
      ANCIENT_BARBARIANS_113C.some((boss) => boss.superUniqueId === monster.superUniqueId)
    ) {
      let deaths = this.ancientDeaths.get(monster.areaId)
      if (deaths === undefined) {
        deaths = new Set()
        this.ancientDeaths.set(monster.areaId, deaths)
      }
      deaths.add(monster.superUniqueId)
      if (deaths.size >= ANCIENT_BARBARIANS_113C.length && killer) {
        this.setPlayerQuestFlag(killer, 'a5q5', QUEST_FLAG_COMPLETED_113C)
      }
    }

    // Act I Den of Evil: clearing every monster in level 8 completes a1q1.
    if (
      killer &&
      monster.areaId === 8 &&
      !hasQuestFlag113c(killer.questFlags, 'a1q1', QUEST_FLAG_COMPLETED_113C)
    ) {
      const remaining = [...this.monsters.values()].some(
        (m) =>
          !m.dead &&
          !m.isNpc &&
          m.isKillable &&
          m.areaId === 8 &&
          m.unitId !== monster.unitId,
      )
      // Rooms are streamed on demand; only finish the quest after every DRLG
      // room has been populated (otherwise killing the entrance room clears it).
      const population = this.areaPopulations.get(8)
      const allRoomsVisited =
        population === undefined || population.populated.size >= population.rooms.length
      if (!remaining && allRoomsVisited) {
        this.setPlayerQuestFlag(killer, 'a1q1', QUEST_FLAG_COMPLETED_113C)
      }
    }

    // 1.13c pack morale: a Fallen/Fetish death scares same-race minions within the
    // pack radius with the AI's own `aip1` percentage (30/40/50 Normal/NM/Hell).
    if (monsterAiBehavior(monster.ai) === 'flee') {
      const fleeChancePct = Math.max(
        0,
        Math.min(100, Math.floor(monster.aiParams[0] ?? 0)),
      )
      for (const ally of this.monsters.values()) {
        if (
          ally.dead ||
          ally.isNpc ||
          ally.unitId === monster.unitId ||
          ally.areaId !== monster.areaId ||
          ally.monType !== monster.monType ||
          ally.isBoss ||
          ally.isPrimeEvil ||
          ally.rank === 'champion'
        ) {
          continue
        }
        if (
          Math.hypot(ally.x - monster.x, ally.y - monster.y) <= 12 &&
          this.rng.rand(100) < fleeChancePct
        ) {
          ally.fleeTicks = Math.max(ally.fleeTicks, 45)
        }
      }
    }

    const diffKey: 'normal' | 'nightmare' | 'hell' =
      this.difficulty === 2
        ? 'hell'
        : this.difficulty === 1
          ? 'nightmare'
          : 'normal'

    // Suicide minions detonate on death for half their max life in a small radius.
    if (isSuicideMinionMonster(monster.hcIdx, monster.defId)) {
      const dmg = Math.max(1, Math.floor(monster.maxHp / 2))
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        if (Math.hypot(p.x - monster.x, p.y - monster.y) <= 3.5) {
          this.applyPlayerElementalDamage(p, { phys: dmg })
        }
      }
      this.damageMercsAndPetsInRadius(monster.areaId, monster.x, monster.y, 3.5, dmg)
    }

    // F12.5: Fire Enchanted (MonUMod #9 `fire`) corpse explosion (non-minions only).
    // Damage is 50% physical + 50% fire from MonUMod constants, resolved against
    // player resistances and applied to mercenaries / summons in the same radius.
    const isFireEnchanted =
      monster.umodIds.includes(MON_UMOD.FIRE) && monster.rank !== 'minion'
    if (isFireEnchanted) {
      const feDmg = calcFireEnchantedDeathDamage(
        monster.maxHp,
        diffKey,
        this.rng.rand(101) / 100,
      )
      const radius = feDmg.radiusSubTiles
      this.broadcastExplosionMissile(monster, 82)
      // 1.13c corpse-boom resolves a short time after the death animation starts.
      monster.pendingDeathExplosion = {
        frame: this.currentFrame + 5,
        radius,
        phys: feDmg.physDmg,
        fire: feDmg.fireDmg,
        total: Math.max(1, feDmg.totalDmg),
      }
    }

    // Cold Enchanted (MonUMod #18 `cold`) Frost Nova on death (non-minions only).
    // `coldunique` (#194) is the 1.13c MonUMod missile; stepMissiles applies the
    // rolled cold damage and the chill state (11), never Conviction (28).
    const isColdEnchanted =
      monster.umodIds.includes(MON_UMOD.COLD) && monster.rank !== 'minion'
    if (isColdEnchanted) {
      const ceNova = calcColdEnchantedDeathNova(monster.level, diffKey)
      const novaDmg = Math.max(
        ceNova.coldMinDmg,
        ceNova.coldMinDmg +
          this.rng.rand(Math.max(1, ceNova.coldMaxDmg - ceNova.coldMinDmg + 1)),
      )
      // D2Client 0x6fb51020 emits the full 64-entry nova ring; scale the client
      // ring (radius 30) down to coldunique's Range 14.
      for (let i = 0; i < D2CLIENT_NOVA_RING_X.length; i++) {
        const rx = D2CLIENT_NOVA_RING_X[i]!
        const ry = D2CLIENT_NOVA_RING_Y[i]!
        const len = Math.max(1, Math.hypot(rx, ry))
        this.spawnMonsterMissile(
          monster,
          monster.x + (rx / len) * ceNova.rangeTicks,
          monster.y + (ry / len) * ceNova.rangeTicks,
          novaDmg,
          194,
          194,
          { guaranteed: true },
        )
      }
    }

    // Bone Fetish / Undead Stygian Doll physical death explosion
    if (
      isBoneFetishMonster(monster.hcIdx, monster.defId) ||
      monster.umodIds.includes(MON_UMOD.BONEFETISH)
    ) {
      const bfDmg = calcBoneFetishDeathDamage(monster.maxHp, diffKey)
      const rolledBfPhys =
        bfDmg.maxPhys > bfDmg.minPhys
          ? bfDmg.minPhys + this.rng.rand(bfDmg.maxPhys - bfDmg.minPhys + 1)
          : bfDmg.minPhys
      const explosionDmg = Math.max(1, Math.floor(rolledBfPhys))
      const radius = Math.max(4, BONE_FETISH_EXPLOSION_RADIUS)
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        if (Math.hypot(p.x - monster.x, p.y - monster.y) <= radius) {
          this.applyDamageToPlayer(p, explosionDmg)
        }
      }
    }

    // Poison dead cloud on Zombie / Mummy death
    if (
      isPoisonDeadMonster(monster.hcIdx, monster.defId) ||
      monster.umodIds.includes(MON_UMOD.POISONDEAD)
    ) {
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        if (Math.hypot(p.x - monster.x, p.y - monster.y) <= 3.5) {
          this.applyUnitState(
            p.states,
            p.stateTimers,
            'player',
            p.unitId,
            p.areaId,
            2,
            50,
          )
        }
      }
    }

    // Duriel spawns 5 Maggots on death
    if (
      isDurielMonster(monster.hcIdx, monster.defId) ||
      monster.umodIds.includes(MON_UMOD.DURIELDEAD)
    ) {
      for (const offset of DURIEL_MAGGOT_OFFSETS) {
        this.spawnMonster({
          classId: DURIEL_MAGGOT_HCIDX,
          x: Math.round(monster.x + offset.dx),
          y: Math.round(monster.y + offset.dy),
          areaId: monster.areaId,
        })
      }
    }
  }

  private grantExperience(
    player: InternalPlayerRecord,
    xpGain: number,
    monsterLevel: number = player.level,
  ): void {
    // 1.13c EXP_ComputeLevelDiffPenalty: clvl<25 table, clvl>=25 clvl/mlvl,
    // then the table again for a >=6 level advantage.
    const levelAdjusted = computeMonsterExpGrant113c(xpGain, player.level, monsterLevel)
    // Experience.txt `ExpRatio` (row for the player's current level, /1024):
    // 70 -> 976, 80 -> 496, 90 -> 61, 98 -> 6. Below 70 it is 1024 (no penalty).
    const expRatio = PARSED_EXPERIENCE_TABLE.expRatios[player.level] ?? 1024
    const shrineXpPct = player.states.has(137) ? 150 : 100
    // `item_addexperience` (stat 85) is a percentage bonus.
    const itemXpPct = 100 + Math.max(0, Math.trunc(this.sumEquippedItemStat(player, 85)))
    const granted = Math.max(
      1,
      Math.floor((levelAdjusted * expRatio * shrineXpPct * itemXpPct) / (1024 * 100 * 100)),
    )
    // 1.13c: experience never exceeds the level-99 `Experience.txt` threshold.
    player.experience = Math.min(
      experienceForLevel113c(MAX_PLAYER_LEVEL_113C),
      player.experience + granted,
    )
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 13,
      value: player.experience,
    })
    this.emitToPlayer(player.unitId, {
      type: 'Experience',
      value: player.experience,
      isDelta: false,
    })

    while (
      player.level < MAX_PLAYER_LEVEL_113C &&
      player.experience >= experienceForLevel113c(player.level + 1)
    ) {
      player.level++
      player.statPts += 5
      player.newSkills += 1
      const base = CANONICAL_CHARSTATS[player.classCode]
      const lifeAddFixed = Math.max(
        FIXED_ONE,
        Math.round(base.perLevel.life * FIXED_ONE),
      )
      const manaAddFixed = Math.max(
        FIXED_ONE,
        Math.round(base.perLevel.mana * FIXED_ONE),
      )
      const stamAddFixed = Math.max(
        FIXED_ONE,
        Math.round(base.perLevel.stamina * FIXED_ONE),
      )

      player.maxHpFixed += lifeAddFixed
      player.hpFixed = player.maxHpFixed
      player.maxHp = Math.floor(player.maxHpFixed / FIXED_ONE)
      player.hp = player.maxHp

      player.maxManaFixed += manaAddFixed
      player.manaFixed = player.maxManaFixed
      player.maxMana = Math.floor(player.maxManaFixed / FIXED_ONE)
      player.mana = player.maxMana

      player.maxStaminaFixed += stamAddFixed
      player.staminaFixed = player.maxStaminaFixed
      player.staminaExhausted = false
      player.maxStamina = Math.floor(player.maxStaminaFixed / FIXED_ONE)
      player.stamina = player.maxStamina

      for (const [statId, value] of [
        [12, player.level],
        [4, player.statPts],
        [5, player.newSkills],
        [6, player.hpFixed],
        [7, player.maxHpFixed],
        [8, player.manaFixed],
        [9, player.maxManaFixed],
        [10, player.staminaFixed],
        [11, player.maxStaminaFixed],
      ] as const) {
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId,
          value,
        })
        this.emitToPlayer(player.unitId, {
          type: 'StatSet',
          stat: statId,
          value,
        })
      }
      this.syncMercenaryLevelToOwner(player)
    }
  }

  /**
   * 1.13c `D2GAME_MERCS_SetStats_6FC68BA0`: when the owner levels up from monster kills,
   * scale the living mercenary's level and `Hireling.txt` stats (`HP`, `Dmg`, `Defense`,
   * `Resist`) up to `owner.level` and broadcast `statId: 12` (`STAT_LEVEL`) + life bar.
   */
  private syncMercenaryLevelToOwner(owner: InternalPlayerRecord): void {
    for (const merc of this.mercenaries.values()) {
      if (merc.ownerPlayerId !== owner.unitId || !merc.alive || merc.level >= owner.level) {
        continue
      }
      merc.level = owner.level
      const stats = resolveHirelingStatsAtLevel(
        merc.subType,
        merc.act,
        merc.difficulty,
        merc.level,
        true,
      )
      if (stats) {
        merc.maxHp = Math.max(merc.maxHp, stats.hp)
        merc.hp = merc.maxHp
        merc.damage = Math.max(merc.damage, Math.floor((stats.minDmg + stats.maxDmg) / 2))
        merc.defense = Math.max(merc.defense, stats.defense)
        merc.resist = Math.max(merc.resist, stats.resist)
      }
      this.broadcastToArea(merc.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: merc.unitId,
        statId: 12,
        value: merc.level,
      })
      this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
    }
  }

  /** Route a monster projectile hit through `executeSUnitDmg` for mercs/pets too (#1345). */
  private applyMonsterMissileToDefender(
    monster: InternalMonsterRecord,
    missile: Pick<
      InternalMissileRecord,
      'skillId' | 'physDamage' | 'elemDamage' | 'element' | 'elemDurationFrames'
    > & { readonly guaranteedHit?: boolean | undefined },
    defender: {
      readonly id: string
      readonly name: string
      readonly unitType: 'mercenary' | 'minion'
      readonly level: number
      readonly hp: number
      readonly maxHp: number
      readonly defense?: number | undefined
      readonly resist?: number | undefined
      readonly equipment?: readonly ServerItemEntry[] | undefined
      readonly hasShield?: boolean | undefined
      readonly stats?: UnitStatList | undefined
      readonly stateBus?: StateBus | undefined
      readonly x?: number | undefined
      readonly y?: number | undefined
    },
    attackKind: 'melee' | 'missile' = 'missile',
  ): number {
    let hasShield = defender.hasShield ?? false
    const stats =
      defender.stats ??
      (() => {
        const list = new UnitStatList()
        list.setBaseStat('level', Math.max(1, defender.level))
        list.setBaseStat('maxhp', Math.max(1, defender.maxHp) * FIXED_ONE)
        list.setHp256(Math.max(0, defender.hp) * FIXED_ONE)
        let defense = Math.max(0, defender.defense ?? 0)
        const baseRes = Math.max(0, defender.resist ?? 0)
        let fireRes = baseRes
        let lightRes = baseRes
        let coldRes = baseRes
        let poisonRes = baseRes
        let magicRes = baseRes
        let damageRes = 0
        let normalDr = 0
        let magicDr = 0
        let blockChance = 0
        // ItemStatCost 38/40/42/44/46: +max resist, read by D2Game 0x6FCFB45E for the cap.
        let maxMagicRes = 0
        let maxFireRes = 0
        let maxLightRes = 0
        let maxColdRes = 0
        let maxPoisonRes = 0
        for (const item of defender.equipment ?? []) {
          if (item.bodyLoc === 5) hasShield = true
          defense += item.stats.get(31) ?? 0
          blockChance += item.stats.get(20) ?? 0
          normalDr += item.stats.get(34) ?? 0
          magicDr += item.stats.get(35) ?? 0
          damageRes += item.stats.get(36) ?? 0
          magicRes += item.stats.get(37) ?? 0
          maxMagicRes += item.stats.get(38) ?? 0
          fireRes += item.stats.get(39) ?? 0
          maxFireRes += item.stats.get(40) ?? 0
          lightRes += item.stats.get(41) ?? 0
          maxLightRes += item.stats.get(42) ?? 0
          coldRes += item.stats.get(43) ?? 0
          maxColdRes += item.stats.get(44) ?? 0
          poisonRes += item.stats.get(45) ?? 0
          maxPoisonRes += item.stats.get(46) ?? 0
        }
        list.setBaseStat('maxmagicresist', maxMagicRes)
        list.setBaseStat('maxfireresist', maxFireRes)
        list.setBaseStat('maxlightresist', maxLightRes)
        list.setBaseStat('maxcoldresist', maxColdRes)
        list.setBaseStat('maxpoisonresist', maxPoisonRes)
        list.setBaseStat('armorclass', Math.max(0, defense))
        list.setBaseStat('toblock', Math.max(0, Math.min(75, blockChance)))
        list.setBaseStat('fireresist', fireRes)
        list.setBaseStat('lightresist', lightRes)
        list.setBaseStat('coldresist', coldRes)
        list.setBaseStat('poisonresist', poisonRes)
        list.setBaseStat('magicresist', magicRes)
        list.setBaseStat('damageresist', damageRes)
        list.setBaseStat('normal_damage_reduction', normalDr)
        list.setBaseStat('magic_damage_reduction', magicDr)
        return list
      })()
    stats.setHp256(Math.max(0, defender.hp) * FIXED_ONE)
    const ctx: CombatUnitContext = {
      id: defender.id,
      name: defender.name,
      unitType: defender.unitType,
      statList: stats,
      stateBus: defender.stateBus ?? new StateBus(stats, this.registry),
      x: defender.x ?? monster.x,
      y: defender.y ?? monster.y,
      hasShield,
      // Hirelings take the player branch of D2Game 0x6FCFB3C0 (difficulty penalty + cap);
      // minions are plain monsters there.
      ...(defender.unitType === 'mercenary' ? { resistPenalty: difficultyResistPenalty(this.difficulty) } : {}),
    }
    const auraDmgPct = this.monsterAuraDamageBonusPct(monster)
    const dmgOut = executeSUnitDmg(this.buildMonsterAttackerContext(monster), ctx, {
      skillId: missile.skillId,
      attackKind,
      srcDam: 0,
      flatPhysMin256: Math.floor(missile.physDamage * FIXED_ONE * (1 + auraDmgPct / 100)),
      flatPhysMax256: Math.floor(missile.physDamage * FIXED_ONE * (1 + auraDmgPct / 100)),
      ...(missile.element !== 'phys'
        ? {
            elemType: missile.element,
            elemMin256: missile.elemDamage * FIXED_ONE,
            elemMax256: missile.elemDamage * FIXED_ONE,
            elemDurationFrames: missile.elemDurationFrames,
          }
        : {}),
      ...(missile.guaranteedHit === true ? { autoHit: true } : {}),
    }, this.rng)
    if (dmgOut.hit) {
      const finalDmg = Math.floor(dmgOut.totalDamage256 / FIXED_ONE)
      if (finalDmg > 0 && monsterProfile113c(monster.ai).drain === 'life' && !monster.dead) {
        const drainAmount = Math.max(1, Math.floor(finalDmg / 2))
        const nextHp = Math.min(monster.maxHp, monster.hp + drainAmount)
        if (nextHp !== monster.hp) {
          monster.hp = nextHp
          this.broadcastToArea(monster.areaId, {
            type: 'UnitStatUpdate',
            unitType: 'monster',
            unitId: monster.unitId,
            statId: 6,
            value: monster.hp,
          })
        }
      }
    }
    return Math.max(0, Math.floor(stats.getHp256() / FIXED_ONE))
  }

  private missileSegmentBlocked(
    missile: InternalMissileRecord,
    prevX: number,
    prevY: number,
  ): boolean {
    const dx = missile.x - prevX
    const dy = missile.y - prevY
    const distance = Math.hypot(dx, dy)
    const steps = Math.max(1, Math.ceil(distance / 0.5))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const sx = Math.round(prevX + dx * t)
      const sy = Math.round(prevY + dy * t)
      const pointArea = this.areaIdAtWorldPoint(sx, sy) ?? missile.areaId
      if (this.isClosedDoorAt(pointArea, sx, sy)) {
        return true
      }
      if (
        this.terrainWalkableCheck &&
        !this.terrainWalkableCheck(
          pointArea,
          sx,
          sy,
          missile.collideType !== 8,
        )
      ) {
        return true
      }
    }
    return false
  }

  private stepMissiles(): void {
    for (const [mId, missile] of this.missiles.entries()) {
      const prevX = missile.x
      const prevY = missile.y
      missile.x += missile.vx
      missile.y += missile.vy
      missile.remainingFrames--

      const collideEntry = getMissileCollideEntry113c(missile.collideType)

      // 1.13c D2Game.dll 0x6FD2D928 CollideType:
      // - terrainMask 0x00 (CollideType 0, 4, 7): ignores terrain
      // - terrainMask 0x04 (CollideType 1, 2, 3, 5, 6): flies over walk-only obstacles (0x01), stops on missile barriers (0x04)
      // - terrainMask 0x05 (CollideType 8): stops on walk-only obstacles (0x01) and missile barriers (0x04)
      if (
        !missile.guaranteedHit &&
        collideEntry.terrainMask !== 0 &&
        this.missileSegmentBlocked(missile, prevX, prevY)
      ) {
        this.missiles.delete(mId)
        continue
      }

      // CollideType 0, 4, 6 (callbackVa === 0) and 7 (CanDestroy missile sweeper) never collide with units
      if (collideEntry.callbackVa === 0 || collideEntry.collideType === 7) {
        if (missile.remainingFrames <= 0) {
          this.missiles.delete(mId)
        }
        continue
      }

      let hit = false
      const canHit = (unitId: number): boolean => {
        const until = missile.hitCooldowns.get(unitId)
        return until === undefined || this.currentFrame >= until
      }
      const markHit = (unitId: number): void => {
        if (missile.pierce || (missile.vx === 0 && missile.vy === 0)) {
          missile.hitCooldowns.set(
            unitId,
            this.currentFrame + (missile.nextHit ? Math.max(1, missile.nextDelay) : 1_000_000),
          )
        }
      }
      const hitsTargetFootprint = (tx: number, ty: number, targetSize: number): boolean =>
        checkMissileSegmentFootprintOverlap113c(
          prevX,
          prevY,
          missile.x,
          missile.y,
          tx,
          ty,
          missile.size,
          targetSize,
          1,
        )
      if (missile.ownerType === 'monster') {
        const ownerMon = this.monsters.get(missile.ownerId)
        if (ownerMon === undefined) {
          this.missiles.delete(mId)
          continue
        }
        const ownerConverted = this.isMonsterConverted(ownerMon)
        if (!ownerConverted && (collideEntry.unitTypeMask & 0x0080) !== 0) {
          for (const player of this.players.values()) {
            if (player.dead || !this.isAreaSeamAdjacent(missile.areaId, player.areaId)) continue
            if (!hitsTargetFootprint(player.x, player.y, 2)) continue
            if (!canHit(player.unitId)) continue
            this.resolveMonsterAttackOnPlayer(ownerMon, player, {
              minDmg: missile.physDamage,
              maxDmg: missile.physDamage,
              skillMode: 'A1',
              attackKind: 'missile',
              skillId: missile.skillId,
              ...(missile.element !== 'phys'
                ? {
                    elementType: missile.element,
                    elemMin: missile.elemDamage,
                    elemMax: missile.elemDamage,
                    elemDurationFrames: missile.elemDurationFrames,
                  }
                : {}),
              fromMissile: true,
              autoHit: missile.guaranteedHit,
            })
            if (missile.element === 'cold') {
              const diffKey: 'normal' | 'nightmare' | 'hell' =
                this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
              const chillFrames =
                missile.elemDurationFrames > 0
                  ? missile.elemDurationFrames
                  : calcColdEnchantedDeathNova(ownerMon.level, diffKey).chillFrames
              this.applyUnitState(
                player.states,
                player.stateTimers,
                'player',
                player.unitId,
                player.areaId,
                11,
                chillFrames,
              )
            }
            markHit(player.unitId)
            hit = true
            if (!missile.pierce) break
          }
          if (!hit || missile.pierce) {
            for (const merc of this.mercenaries.values()) {
              if (!merc.alive || !this.isAreaSeamAdjacent(missile.areaId, merc.areaId)) continue
              const mercOwner = this.players.get(merc.ownerPlayerId)
              if (mercOwner !== undefined && (mercOwner.dead || !this.isAreaSeamAdjacent(missile.areaId, mercOwner.areaId))) continue
              if (!hitsTargetFootprint(merc.x, merc.y, 2)) continue
              if (!canHit(merc.unitId)) continue
              const prevHp = merc.hp
              const nextHp = this.applyMonsterMissileToDefender(ownerMon, missile, {
                id: `merc_${merc.unitId}`,
                name: merc.name,
                unitType: 'mercenary',
                level: merc.level,
                hp: merc.hp,
                maxHp: merc.maxHp,
                defense: merc.defense,
                resist: merc.resist,
                equipment: merc.equipment,
              })
              if (nextHp < prevHp) {
                this.applyDamageToMerc(merc, prevHp - nextHp, merc.areaId)
              }
              markHit(merc.unitId)
              hit = true
              if (!missile.pierce) break
            }
          }
          if (!hit || missile.pierce) {
            for (const [ownerId, mgr] of this.summonManagers) {
              const owner = this.players.get(ownerId)
              if (owner === undefined || owner.dead || !this.isAreaSeamAdjacent(missile.areaId, owner.areaId)) continue
              let petHit = false
              for (const pet of [...mgr.getActivePets()]) {
                if (pet.alive === false || pet.hp <= 0) continue
                const petAreaId =
                  (pet as unknown as { areaId?: number }).areaId ?? owner.areaId
                if (!this.isAreaSeamAdjacent(missile.areaId, petAreaId)) continue
                const petHcIdx = (pet as unknown as { hcIdx?: number }).hcIdx ?? -1
                const petSize = Math.max(1, Math.min(3, getMonsterPathRecord(petHcIdx)?.sizeX ?? 2))
                if (!hitsTargetFootprint(pet.x, pet.y, petSize)) continue
                if (!canHit(stableUnitKey(pet.uid))) continue
                const prevHp = pet.hp
                const nextHp = this.applyMonsterMissileToDefender(ownerMon, missile, {
                  id: pet.uid,
                  name: pet.name,
                  unitType: 'minion',
                  level: pet.statList.getAccruedStat('level'),
                  hp: pet.hp,
                  maxHp: pet.maxHp,
                  stats: pet.statList,
                  stateBus: pet.stateBus,
                  x: pet.x,
                  y: pet.y,
                })
                if (nextHp < prevHp) {
                  pet.hp = prevHp
                  this.applyDamageToSummon(ownerId, pet, prevHp - nextHp, petAreaId)
                }
                markHit(stableUnitKey(pet.uid))
                hit = true
                petHit = true
                if (!missile.pierce) break
              }
              if (petHit && !missile.pierce) break
            }
          }
        }
        if (
          (!hit || missile.pierce) &&
          (collideEntry.unitTypeMask & 0x0100) !== 0 &&
          (missile.hitMonsters || ownerConverted || ownerMon.states.has(59))
        ) {
          for (const target of this.monsters.values()) {
            if (
              target.unitId === ownerMon.unitId ||
              target.dead ||
              target.isNpc ||
              target.areaId !== missile.areaId ||
              (ownerConverted && this.isMonsterConverted(target))
            ) {
              continue
            }
            const targetSize = Math.max(1, Math.min(3, getMonsterPathRecord(target.hcIdx)?.sizeX ?? 2))
            if (!hitsTargetFootprint(target.x, target.y, targetSize)) continue
            if (!canHit(target.unitId)) continue
            const defenderStats = new UnitStatList()
            defenderStats.setBaseStat('level', target.level)
            defenderStats.setBaseStat('armorclass', target.ac)
            defenderStats.setBaseStat('toblock', target.toBlock)
            defenderStats.setBaseStat('maxhp', target.maxHp * FIXED_ONE)
            defenderStats.setHp256(target.hp * FIXED_ONE)
            defenderStats.setBaseStat('damageresist', target.resistances.phys)
            defenderStats.setBaseStat('magicresist', target.resistances.magic)
            defenderStats.setBaseStat('fireresist', target.resistances.fire)
            defenderStats.setBaseStat('lightresist', target.resistances.light)
            defenderStats.setBaseStat('coldresist', target.resistances.cold)
            defenderStats.setBaseStat('poisonresist', target.resistances.poison)
            const defenderStateBus = new StateBus(defenderStats, this.registry)
            this.mirrorPersistentStates(this.monsterCombat.get(target.unitId), defenderStateBus)
            const defenderCtx: CombatUnitContext = {
              id: `monster_${target.unitId}`,
              name: target.name,
              unitType: 'monster',
              statList: defenderStats,
              stateBus: defenderStateBus,
              x: target.x,
              y: target.y,
              isUndead: target.isUndead,
              isDemon: target.isDemon,
              isBoss: target.isBoss,
              isPrimeEvil: target.isPrimeEvil,
              coldEffect: target.coldEffect,
              drain: target.drain,
            }
            const isSpellMissile =
              missile.guaranteedHit || (missile.physDamage <= 0 && missile.elemDamage > 0)
            const dmgOut = executeSUnitDmg(
              this.buildMonsterAttackerContext(ownerMon),
              defenderCtx,
              {
                skillId: missile.skillId,
                attackKind: isSpellMissile ? 'spell' : 'missile',
                srcDam: 0,
                flatPhysMin256: missile.physDamage * FIXED_ONE,
                flatPhysMax256: missile.physDamage * FIXED_ONE,
                ...(missile.element !== 'phys'
                  ? {
                      elemType: missile.element,
                      elemMin256: missile.elemDamage * FIXED_ONE,
                      elemMax256: missile.elemDamage * FIXED_ONE,
                      elemDurationFrames: missile.elemDurationFrames,
                    }
                  : {}),
              },
              this.rng,
            )
            if (dmgOut.hit) {
              const dealtDamage = Math.floor(dmgOut.totalDamage256 / FIXED_ONE)
              if (dealtDamage > 0) {
                target.hp = Math.max(0, target.hp - dealtDamage)
                this.broadcastToArea(target.areaId, {
                  type: 'UnitStatUpdate',
                  unitType: 'monster',
                  unitId: target.unitId,
                  statId: 6,
                  value: target.hp,
                })
                if (target.hp <= 0) {
                  const credited = this.creditedPlayerForMonsterKill(ownerMon, target)
                  this.applyMonsterDeath(
                    target,
                    credited,
                    missile.element === 'phys' ? 'phys' : missile.element,
                  )
                } else {
                  this.maybeEnterMonsterHitRecovery(target, dealtDamage)
                }
              }
            }
            markHit(target.unitId)
            hit = true
            if (!missile.pierce) break
          }
        }
      } else if ((collideEntry.unitTypeMask & 0x0100) !== 0) {
        const owner = this.players.get(missile.ownerId)
        if (owner) {
          for (const monster of this.monsters.values()) {
            if (
              monster.dead ||
              monster.isNpc ||
              monster.areaId !== missile.areaId ||
              this.isMonsterConverted(monster)
            ) {
              continue
            }
            if (!canHit(monster.unitId)) continue
            const monsterSize = Math.max(1, Math.min(3, getMonsterPathRecord(monster.hcIdx)?.sizeX ?? 2))
            if (hitsTargetFootprint(monster.x, monster.y, monsterSize)) {
              if (
                missile.element === 'pois' &&
                missile.elemDurationFrames > 0 &&
                (missile.poisonBitrate256 ?? 0) > 0
              ) {
                if (missile.physDamage > 0) {
                  this.applyDamageToMonster(
                    owner,
                    monster,
                    missile.physDamage,
                    missile.skillId,
                    'phys',
                  )
                }
                if (!monster.dead) {
                  this.applyMonsterPoisonDot(
                    owner,
                    monster,
                    missile.poisonBitrate256!,
                    missile.elemDurationFrames,
                    missile.skillId,
                  )
                }
              } else {
                this.applyDamageToMonster(
                  owner,
                  monster,
                  missile.damage,
                  missile.skillId,
                )
              }
              markHit(monster.unitId)
              hit = true
              if (!missile.pierce) break
            }
          }
        }
      }

      if ((hit && !missile.pierce) || missile.remainingFrames <= 0) {
        this.missiles.delete(mId)
      }
    }
  }

  /** Pick the 1.13c melee mode (A1/A2/S1) and schedule damage on its action frame. */
  private beginMonsterMeleeAttack(
    monster: InternalMonsterRecord,
    player: InternalPlayerRecord,
  ): void {
    const hasA2 = monster.hasAttack2 && monster.attack2MaxDmg > 0
    const hasS1 = monster.hasSpecial1 && monster.special1MaxDmg > 0
    const rawA2Chance = monster.aiParams[1] ?? 0
    const a2Chance = hasA2
      ? Math.max(0, Math.min(100, Math.floor(rawA2Chance > 0 ? rawA2Chance : 35)))
      : 0
    const s1Chance = hasS1 ? (!hasA2 && monster.maxDmg <= 0 ? 100 : 25) : 0
    const roll = this.rng.rand(100)
    const skillMode: 'A1' | 'A2' | 'S1' =
      roll < s1Chance ? 'S1' : roll < s1Chance + a2Chance ? 'A2' : 'A1'
    // ThornHulk row 27: `aip6` is the number of consecutive A2 swings needed
    // before the `aip4` frenzy chance; `aip5` is the frenzy speed bonus.
    const profile = monsterProfile113c(monster.ai)
    const frenzy = profile.frenzy
    if (frenzy !== undefined) {
      if (skillMode === 'A2') {
        monster.consecutiveA2 += 1
        const required = Math.max(
          1,
          Math.floor(
            monaiParam113c(profile, monster.aiParams, frenzy.consecutiveParam, 3),
          ),
        )
        if (monster.consecutiveA2 >= required) {
          monster.consecutiveA2 = 0
          const chance = Math.max(
            0,
            Math.min(
              100,
              monaiParam113c(profile, monster.aiParams, frenzy.thresholdParam, 0),
            ),
          )
          if (chance > 0 && this.rng.rand(100) < chance) {
            monster.frenzyUntilFrame = this.currentFrame + 100
            monster.frenzySpeedPct = Math.max(
              0,
              monaiParam113c(profile, monster.aiParams, frenzy.speedParam, 0),
            )
          }
        }
      } else {
        monster.consecutiveA2 = 0
      }
    }
    const mode = skillMode === 'A1' ? 4 : skillMode === 'A2' ? 5 : 8
    const minDmg =
      skillMode === 'S1'
        ? monster.special1MinDmg
        : skillMode === 'A2'
          ? monster.attack2MinDmg
          : monster.minDmg
    const maxDmg =
      skillMode === 'S1'
        ? monster.special1MaxDmg
        : skillMode === 'A2'
          ? monster.attack2MaxDmg
          : monster.maxDmg
    monster.mode = mode
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode,
      at: { x: Math.round(player.x), y: Math.round(player.y) },
      lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
    })
    const timing = this.monsterAttackTiming(monster, skillMode)
    monster.cooldown = Math.max(monster.cooldownTicks, timing.totalFrames)
    monster.pendingAttack = {
      playerId: player.unitId,
      frame: this.currentFrame + timing.actionFrame,
      mode,
      skillMode,
      minDmg,
      maxDmg,
    }
  }

  /** AnimData `{code}A1/A2/S1HTH` action frame and full animation duration. */
  private monsterAttackTiming(
    monster: InternalMonsterRecord,
    mode: 'A1' | 'A2' | 'S1',
  ): { readonly actionFrame: number; readonly totalFrames: number } {
    const attackRatePct = Math.max(
      15,
      100 -
        this.monsterSlowPercent(monster) +
        (this.currentFrame < monster.frenzyUntilFrame ? monster.frenzySpeedPct : 0) +
        (monster.umodIds.includes(37) ? 30 : 0) +
        (monster.states.has(49) ? 30 : 0),
    )
    const code = MONSTATS_113C_ROWS[monster.hcIdx]?.code?.trim().toUpperCase()
    if (code !== undefined && code !== '') {
      const record = this.registry.getAnimDataRecord(`${code}${mode}HTH`)
      if (record !== undefined && record.framesPerDirection > 0 && record.hasSpeed) {
        const speed = Math.max(1, Math.floor((record.animationSpeed * attackRatePct) / 100))
        const event = record.events.find((entry) => entry.code !== 0)
        const actionIdx = event !== undefined ? event.frame + 1 : record.framesPerDirection
        return {
          actionFrame: Math.max(1, Math.floor((actionIdx * 256) / speed)),
          totalFrames: Math.max(1, Math.floor((record.framesPerDirection * 256) / speed)),
        }
      }
    }
    const baseAction = mode === 'A1' ? 4 : 5
    const baseTotal = mode === 'A1' ? 8 : 10
    return {
      actionFrame: Math.max(1, Math.floor((baseAction * 100) / attackRatePct)),
      totalFrames: Math.max(1, Math.floor((baseTotal * 100) / attackRatePct)),
    }
  }

  private stepPendingResurrection(monster: InternalMonsterRecord): void {
    const pending = monster.pendingResurrection
    if (pending === undefined || this.currentFrame < pending.frame) return
    if (
      monster.dead ||
      monster.frozenTicks > 0 ||
      monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25) ||
      this.currentFrame < monster.hitRecoveryUntilFrame
    ) {
      monster.pendingResurrection = undefined
      return
    }
    monster.pendingResurrection = undefined
    const corpse = this.monsters.get(pending.corpseUnitId)
    if (
      corpse === undefined ||
      !corpse.dead ||
      corpse.shattered ||
      corpse.areaId !== monster.areaId
    ) {
      return
    }
    this.reviveMonsterCorpse(monster, corpse)
  }

  /** Apply the 1.13c Resurrect action frame: full life, cleared death states. */
  private reviveMonsterCorpse(
    caster: InternalMonsterRecord,
    corpse: InternalMonsterRecord,
  ): void {
    if (corpse.pendingDropItems !== undefined) {
      const pendingItems = corpse.pendingDropItems
      corpse.pendingDropItems = undefined
      this.spawnDroppedItems(pendingItems, corpse.areaId, corpse.x, corpse.y)
    }
    corpse.dead = false
    corpse.hp = corpse.maxHp
    corpse.mode = 1
    corpse.revivedByShaman = true
    for (const stateId of corpse.states) {
      this.broadcastToArea(caster.areaId, {
        type: 'UnitState',
        unitType: 'monster',
        unitId: corpse.unitId,
        state: stateId,
        active: false,
        areaId: caster.areaId,
      })
      this.broadcastToArea(caster.areaId, {
        type: 'StateEnd',
        unit: { unitType: 1, id: corpse.unitId },
        state: stateId,
      })
    }
    corpse.states.clear()
    corpse.stateTimers.clear()
    corpse.path = []
    corpse.pathIndex = 0
    corpse.pathTargetX = Number.NaN
    corpse.pathTargetY = Number.NaN
    this.broadcastToArea(caster.areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId: corpse.unitId,
      statId: 6,
      value: corpse.hp,
    })
    this.broadcastToArea(caster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: corpse.unitId,
      mode: 1,
      lifePct: 128,
    })
  }

  private stepPendingMonsterAttack(monster: InternalMonsterRecord): void {
    const pending = monster.pendingAttack
    if (!pending || this.currentFrame < pending.frame) return
    if (
      monster.dead ||
      monster.frozenTicks > 0 ||
      monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25) ||
      this.currentFrame < monster.hitRecoveryUntilFrame
    ) {
      monster.pendingAttack = undefined
      return
    }
    monster.pendingAttack = undefined
    const player = this.players.get(pending.playerId)
    if (!player || player.dead || !this.isAreaSeamAdjacent(monster.areaId, player.areaId)) return
    if (Math.hypot(player.x - monster.x, player.y - monster.y) > 3.5) return
    this.resolveMonsterAttackOnPlayer(monster, player, pending)
  }

  /** MonStats `El1..3` elemental rider attached to the chosen melee mode. */
  private rollMonsterElementalRider(
    monster: InternalMonsterRecord,
    mode: 'A1' | 'A2' | 'S1',
  ): { readonly element: MissileDamageChannel; readonly damage: number; readonly durationFrames: number } | undefined {
    for (const el of monster.elementalAttacks) {
      if (el.mode !== mode) continue
      const chance = Math.max(0, Math.min(100, el.chancePct ?? 100))
      if (this.rng.rand(100) >= chance) continue
      const element = normalizeMissileElement(el.type)
      if (element === undefined || element === 'phys') continue
      const min = Math.max(0, el.minDamage ?? el.min ?? 0)
      const max = Math.max(min, el.maxDamage ?? el.max ?? min)
      return {
        element,
        damage: this.rollInclusive(min, max),
        durationFrames: Math.max(0, el.durationFrames ?? 0),
      }
    }
    return undefined
  }

  /** Schedule a melee swing against a mercenary / summon on the AnimData action frame. */
  private beginMonsterMeleeAttackOnAlly(
    monster: InternalMonsterRecord,
    target: { readonly kind: 'merc' | 'pet'; readonly id: number | string },
  ): void {
    const timing = this.monsterAttackTiming(monster, 'A1')
    monster.cooldown = Math.max(monster.cooldownTicks, timing.totalFrames)
    monster.pendingAllyAttack = {
      targetKind: target.kind,
      targetId: target.id,
      frame: this.currentFrame + timing.actionFrame,
      mode: 4,
      skillMode: 'A1',
      minDmg: monster.minDmg,
      maxDmg: monster.maxDmg,
    }
  }

  private stepPendingAllyAttack(monster: InternalMonsterRecord): void {
    const pending = monster.pendingAllyAttack
    if (!pending || this.currentFrame < pending.frame) return
    if (
      monster.dead ||
      monster.frozenTicks > 0 ||
      monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25) ||
      this.currentFrame < monster.hitRecoveryUntilFrame
    ) {
      monster.pendingAllyAttack = undefined
      return
    }
    monster.pendingAllyAttack = undefined
    const rider = this.rollMonsterElementalRider(monster, pending.skillMode)
    const swing = {
      skillId: 0,
      physDamage: this.rollInclusive(pending.minDmg, pending.maxDmg),
      elemDamage: rider?.damage ?? 0,
      element: rider?.element ?? ('phys' as MissileDamageChannel),
      elemDurationFrames: rider?.durationFrames ?? 0,
    }
    if (pending.targetKind === 'merc') {
      const merc = this.mercenaries.get(pending.targetId as number)
      if (!merc || !merc.alive || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) return
      const mercOwner = this.players.get(merc.ownerPlayerId)
      if (mercOwner !== undefined && (mercOwner.dead || !this.isAreaSeamAdjacent(monster.areaId, mercOwner.areaId))) return
      if (Math.hypot(merc.x - monster.x, merc.y - monster.y) > 3.5) return
      const prevHp = merc.hp
      const nextHp = this.applyMonsterMissileToDefender(
        monster,
        swing,
        {
          id: `merc_${merc.unitId}`,
          name: merc.name,
          unitType: 'mercenary',
          level: merc.level,
          hp: merc.hp,
          maxHp: merc.maxHp,
          defense: merc.defense,
          resist: merc.resist,
          equipment: merc.equipment,
        },
        'melee',
      )
      if (nextHp < prevHp) {
        this.applyDamageToMerc(merc, prevHp - nextHp, merc.areaId)
      }
      return
    }
    let pet: SummonedPetUnit | undefined
    for (const [ownerId, mgr] of this.summonManagers) {
      const owner = this.players.get(ownerId)
      if (owner === undefined || owner.dead || !this.isAreaSeamAdjacent(monster.areaId, owner.areaId)) continue
      for (const candidate of mgr.getActivePets()) {
        const mappedId =
          this.petUnitIds.get(candidate.uid) ??
          (candidate as unknown as { unitId?: number }).unitId
        if (
          candidate.uid === String(pending.targetId) ||
          mappedId === pending.targetId ||
          Number(candidate.uid) === pending.targetId
        ) {
          pet = candidate
          break
        }
      }
      if (pet !== undefined) break
    }
    if (pet === undefined || pet.alive === false || pet.hp <= 0) return
    if (Math.hypot(pet.x - monster.x, pet.y - monster.y) > 3.5) return
    const prevHp = pet.hp
    const nextHp = this.applyMonsterMissileToDefender(
      monster,
      swing,
      {
        id: pet.uid,
        name: pet.name,
        unitType: 'minion',
        level: pet.statList.getAccruedStat('level'),
        hp: pet.hp,
        maxHp: pet.maxHp,
        stats: pet.statList,
        stateBus: pet.stateBus,
        x: pet.x,
        y: pet.y,
      },
      'melee',
    )
    if (nextHp < prevHp) {
      pet.hp = prevHp
      this.applyDamageToSummon(pet, prevHp - nextHp, monster.areaId)
    }
  }

  private buildMonsterAttackerContext(
    monster: InternalMonsterRecord,
    skillMode: 'A1' | 'A2' | 'S1' = 'A1',
  ): CombatUnitContext {
    const attackerStats = new UnitStatList()
    attackerStats.setBaseStat('level', monster.level)
    const modeToHit =
      skillMode === 'S1'
        ? monster.special1Ar
        : skillMode === 'A2'
          ? monster.attack2Ar
          : monster.ar
    attackerStats.setBaseStat('tohit', modeToHit)
    attackerStats.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
    attackerStats.setHp256(monster.hp * FIXED_ONE)
    attackerStats.setBaseStat('damageresist', monster.resistances.phys)
    attackerStats.setBaseStat('magicresist', monster.resistances.magic)
    attackerStats.setBaseStat('fireresist', monster.resistances.fire)
    attackerStats.setBaseStat('lightresist', monster.resistances.light)
    attackerStats.setBaseStat('coldresist', monster.resistances.cold)
    attackerStats.setBaseStat('poisonresist', monster.resistances.poison)
    const attackerStateBus = new StateBus(attackerStats, this.registry)
    return {
      id: `monster_${monster.unitId}`,
      name: monster.name,
      unitType: 'monster',
      statList: attackerStats,
      stateBus: attackerStateBus,
      x: monster.x,
      y: monster.y,
      isUndead: monster.isUndead,
      isDemon: monster.isDemon,
      isBoss: monster.isBoss,
      isPrimeEvil: monster.isPrimeEvil,
      weaponMinPhys: 0,
      weaponMaxPhys: 0,
    }
  }

  /** 1.13c player armor class including Conviction's `defense_pct` penalty. */
  private computePlayerDefense(player: InternalPlayerRecord): number {
    let defense = Math.floor(player.dexterity / 4)
    for (const item of player.items) {
      if (item.location !== 'equipped') continue
      defense += item.rawItemData?.defense ?? 0
      defense += item.stats.get(31) ?? 0
    }
    const defensePct = this.playerCombatContext(player).statList.getModifierBonus('defense_pct')
    if (defensePct !== 0) {
      defense = Math.max(0, Math.trunc((defense * (100 + defensePct)) / 100))
    }
    return defense
  }

  private resolveMonsterAttackOnPlayer(
    monster: InternalMonsterRecord,
    player: InternalPlayerRecord,
    swing?: {
      readonly minDmg: number
      readonly maxDmg: number
      readonly skillMode: 'A1' | 'A2' | 'S1'
      /** Missile hits use the projectile block/dodge path; melee uses the melee path. */
      readonly attackKind?: 'melee' | 'missile' | undefined
      readonly skillId?: number | undefined
      /** Explicit projectile element (Missiles.txt EType) instead of a MonStats El1..3 rider. */
      readonly elementType?: MissileDamageChannel | undefined
      readonly elemMin?: number | undefined
      readonly elemMax?: number | undefined
      readonly elemDurationFrames?: number | undefined
      /** Projectile hits must not re-roll the monster's melee El1..3 rider. */
      readonly fromMissile?: boolean | undefined
      /** Death-effect novae bypass to-hit/block but still apply resistances. */
      readonly autoHit?: boolean | undefined
    },
  ): void {
    const attackerCtx = this.buildMonsterAttackerContext(monster, swing?.skillMode ?? 'A1')

    const defenderStats = new UnitStatList()
    defenderStats.setBaseStat('level', player.level)
    // 1.13c defense: dexterity/4 + equipped armor/item defense + active armor
    // skills, then Conviction's `defense_pct`.
    let fireResist = 0
    let lightResist = 0
    let coldResist = 0
    let poisonResist = 0
    let magicResist = 0
    let damageResist = 0
    let normalDr = 0
    let magicDr = 0
    let blockChance = 0
    // ItemStatCost 38/40/42/44/46: +max resist, read by D2Game 0x6FCFB45E for the cap.
    let maxMagicResist = 0
    let maxFireResist = 0
    let maxLightResist = 0
    let maxColdResist = 0
    let maxPoisonResist = 0
    for (const item of player.items) {
      if (item.location !== 'equipped') continue
      blockChance += item.stats.get(20) ?? 0
      normalDr += item.stats.get(34) ?? 0
      magicDr += item.stats.get(35) ?? 0
      damageResist += item.stats.get(36) ?? 0
      magicResist += item.stats.get(37) ?? 0
      maxMagicResist += item.stats.get(38) ?? 0
      fireResist += item.stats.get(39) ?? 0
      maxFireResist += item.stats.get(40) ?? 0
      lightResist += item.stats.get(41) ?? 0
      maxLightResist += item.stats.get(42) ?? 0
      coldResist += item.stats.get(43) ?? 0
      maxColdResist += item.stats.get(44) ?? 0
      poisonResist += item.stats.get(45) ?? 0
      maxPoisonResist += item.stats.get(46) ?? 0
    }
    const playerDefense = this.computePlayerDefense(player)
    const playerStats = this.playerCombatContext(player).statList
    blockChance += Math.trunc(playerStats.getAccruedStat('toblock'))
    normalDr += Math.trunc(playerStats.getAccruedStat('normal_damage_reduction'))
    magicDr += Math.trunc(playerStats.getAccruedStat('magic_damage_reduction'))
    damageResist += Math.trunc(playerStats.getAccruedStat('damageresist'))
    magicResist += Math.trunc(playerStats.getAccruedStat('magicresist'))
    fireResist += Math.trunc(playerStats.getAccruedStat('fireresist'))
    lightResist += Math.trunc(playerStats.getAccruedStat('lightresist'))
    coldResist += Math.trunc(playerStats.getAccruedStat('coldresist'))
    poisonResist += Math.trunc(playerStats.getAccruedStat('poisonresist'))
    maxMagicResist += Math.trunc(playerStats.getAccruedStat('maxmagicresist'))
    maxFireResist += Math.trunc(playerStats.getAccruedStat('maxfireresist'))
    maxLightResist += Math.trunc(playerStats.getAccruedStat('maxlightresist'))
    maxColdResist += Math.trunc(playerStats.getAccruedStat('maxcoldresist'))
    maxPoisonResist += Math.trunc(playerStats.getAccruedStat('maxpoisonresist'))
    defenderStats.setBaseStat('armorclass', playerDefense)
    defenderStats.setBaseStat('toblock', Math.max(0, Math.min(75, blockChance)))
    defenderStats.setBaseStat('normal_damage_reduction', normalDr)
    defenderStats.setBaseStat('magic_damage_reduction', magicDr)
    defenderStats.setBaseStat('damageresist', damageResist)
    defenderStats.setBaseStat('magicresist', magicResist)
    defenderStats.setBaseStat('fireresist', fireResist)
    defenderStats.setBaseStat('lightresist', lightResist)
    defenderStats.setBaseStat('coldresist', coldResist)
    defenderStats.setBaseStat('poisonresist', poisonResist)
    defenderStats.setBaseStat('maxmagicresist', maxMagicResist)
    defenderStats.setBaseStat('maxfireresist', maxFireResist)
    defenderStats.setBaseStat('maxlightresist', maxLightResist)
    defenderStats.setBaseStat('maxcoldresist', maxColdResist)
    defenderStats.setBaseStat('maxpoisonresist', maxPoisonResist)
    defenderStats.setBaseStat('maxhp', player.maxHpFixed)
    defenderStats.setHp256(player.hpFixed)
    defenderStats.setBaseStat('maxmana', player.maxManaFixed)
    defenderStats.setMana256(player.manaFixed)
    for (const [skId, lvl] of player.skills.entries()) {
      defenderStats.setBaseSkillLevel(skId, lvl)
    }

    const defenderStateBus = new StateBus(defenderStats, this.registry)
    if (player.states.has(10)) {
      defenderStateBus.applyState({
        stateNameOrId: 'frozenarmor',
        sourceSkillId: 40,
        slvl: Math.max(1, player.skills.get(40) ?? 1),
        durationFrames: player.stateTimers.get(10) ?? 300,
      })
    }
    if (player.states.has(20)) {
      defenderStateBus.applyState({
        stateNameOrId: 'chillingarmor',
        sourceSkillId: 60,
        slvl: Math.max(1, player.skills.get(60) ?? 1),
        durationFrames: player.stateTimers.get(20) ?? 300,
      })
    }
    if (player.states.has(30)) {
      defenderStateBus.applyState({
        stateNameOrId: 'energyshield',
        sourceSkillId: 58,
        slvl: Math.max(1, player.skills.get(58) ?? 1),
        durationFrames: player.stateTimers.get(30) ?? 300,
      })
    }
    if (player.states.has(88)) {
      defenderStateBus.applyState({
        stateNameOrId: 'shiverarmor',
        sourceSkillId: 50,
        slvl: Math.max(1, player.skills.get(50) ?? 1),
        durationFrames: player.stateTimers.get(88) ?? 300,
      })
    }
    if (player.states.has(14)) {
      defenderStateBus.applyState({
        stateNameOrId: 'bonearmor',
        sourceSkillId: 68,
        slvl: Math.max(1, player.skills.get(68) ?? 1),
        durationFrames: player.stateTimers.get(14) ?? 300,
      })
    }
    if (player.states.has(151)) {
      defenderStateBus.applyState({
        stateNameOrId: 'cyclonearmor',
        sourceSkillId: 235,
        slvl: Math.max(1, player.skills.get(235) ?? 1),
        durationFrames: player.stateTimers.get(151) ?? 300,
      })
    }
    if (player.states.has(9)) {
      defenderStateBus.applyState({
        stateNameOrId: 'amplifydamage',
        sourceSkillId: 66,
        slvl: 1,
        durationFrames: player.stateTimers.get(9) ?? 100,
      })
    }
    if (player.states.has(60)) {
      defenderStateBus.applyState({
        stateNameOrId: 'decrepify',
        sourceSkillId: 87,
        slvl: 1,
        durationFrames: player.stateTimers.get(60) ?? 100,
      })
    }
    // Skill buffs / received auras (armor %, resists, Holy Shield block, ...) on the persistent bus.
    this.mirrorPersistentStates(this.playerCombat.get(player.unitId), defenderStateBus)

    const defenderCtx: CombatUnitContext = {
      id: `player_${player.unitId}`,
      name: player.name,
      unitType: 'player',
      statList: defenderStats,
      stateBus: defenderStateBus,
      x: player.x,
      y: player.y,
      hasShield: player.items.some(
        (item) => item.location === 'equipped' && item.bodyLoc === 5,
      ),
      isMoving: this.playerMotion.get(player.unitId)?.moving === true,
      resistPenalty: difficultyResistPenalty(this.difficulty),
    }

    const swingMode = swing?.skillMode ?? 'A1'
    const rider =
      swing?.fromMissile === true && swing.elementType === undefined
        ? undefined
        : monster.elementalAttacks.find(
            (entry) =>
              entry.mode === swingMode &&
              (entry.chancePct >= 100 || this.rng.rand(100) < entry.chancePct),
          )
    const elementalType =
      swing?.elementType ??
      (rider?.type === 'ltng'
        ? 'ltng'
        : rider?.type === 'cold' || rider?.type === 'frze'
          ? 'cold'
          : rider?.type === 'pois'
            ? 'pois'
            : rider?.type === 'mag'
              ? 'mag'
              : rider?.type === 'fire'
                ? 'fire'
                : undefined)
    const auraDmgPct = this.monsterAuraDamageBonusPct(monster)
    const physMin = swing?.fromMissile === true ? (swing.minDmg ?? 0) : (swing?.minDmg ?? monster.minDmg)
    const physMax = swing?.fromMissile === true ? (swing.maxDmg ?? 0) : (swing?.maxDmg ?? monster.maxDmg)
    const elemMin = swing?.fromMissile === true ? (swing.elemMin ?? 0) : (rider?.minDamage ?? rider?.min ?? 0)
    const elemMax = swing?.fromMissile === true ? (swing.elemMax ?? 0) : (rider?.maxDamage ?? rider?.max ?? 0)
    const elemDuration =
      swing?.fromMissile === true
        ? (swing.elemDurationFrames ?? 0)
        : (rider?.durationFrames ?? rider?.duration ?? 0)
    const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
      skillId: swing?.skillId ?? 0,
      attackKind: swing?.attackKind ?? 'melee',
      srcDam: 0,
      flatPhysMin256: Math.floor(physMin * FIXED_ONE * (1 + auraDmgPct / 100)),
      flatPhysMax256: Math.floor(physMax * FIXED_ONE * (1 + auraDmgPct / 100)),
      ...(elementalType !== undefined
        ? {
            elemType: elementalType,
            elemMin256: Math.max(0, elemMin) * FIXED_ONE,
            elemMax256: Math.max(0, elemMax) * FIXED_ONE,
            elemDurationFrames: elemDuration,
          }
        : {}),
      ...(swing?.autoHit === true ? { autoHit: true } : {}),
    }, this.rng)

    if (dmgOut.hit) {
      // Sync Energy Shield mana deduction & potential state collapse back to player
      const newMana256 = defenderStats.getMana256()
      if (newMana256 !== player.manaFixed) {
        player.manaFixed = Math.max(0, newMana256)
        player.mana = Math.floor(player.manaFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 8,
          value: player.manaFixed,
        })
      }
      if (player.states.has(30) && !defenderStateBus.hasState('energyshield')) {
        player.states.delete(30)
        player.stateTimers.delete(30)
        this.broadcastToArea(player.areaId, {
          type: 'UnitState',
          unitType: 'player',
          unitId: player.unitId,
          state: 30,
          active: false,
        })
      }

      // Sync reactive Cold Armor (Frozen Armor / Shiver Armor) states & damage onto attacking monster
      for (const stName of dmgOut.attackerStatesApplied ?? []) {
        if (stName === 'freeze' && monster.resistances.cold < 100 && monster.coldEffect !== 0) {
          this.applyMonsterState(monster.unitId, 1, 30)
        } else if (
          (stName === 'cold' || stName === 'chill') &&
          monster.resistances.cold < 100 &&
          monster.coldEffect !== 0
        ) {
          this.applyMonsterState(monster.unitId, 11, 100)
        }
      }
      const reactiveMonsterDmg = Math.floor(
        ((dmgOut.attackerColdDamage256 ?? 0) + (dmgOut.reflectedPhys256 ?? 0)) /
          FIXED_ONE,
      )
      if (reactiveMonsterDmg > 0 && !monster.dead && monster.isKillable) {
        monster.hp = Math.max(0, monster.hp - reactiveMonsterDmg)
        this.broadcastToArea(monster.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: monster.unitId,
          statId: 6,
          value: monster.hp,
        })
        if (monster.hp <= 0) {
          this.applyMonsterDeath(monster, player, 'phys')
        }
      }

      const finalDmg = Math.floor(dmgOut.totalDamage256 / FIXED_ONE)
      if (finalDmg > 0) {
        // Cursed (MonUMod 7): each hit applies Amplify Damage.
        if (monster.umodIds.includes(MON_UMOD.CURSE)) {
          this.applyUnitState(
            player.states,
            player.stateTimers,
            'player',
            player.unitId,
            player.areaId,
            9,
            100,
          )
          this.playerCombatContext(player).stateBus.applyState({
            stateNameOrId: 'amplifydamage',
            sourceUnitId: `monster_${monster.unitId}`,
            sourceSkillId: 66,
            slvl: Math.max(1, monster.level),
            durationFrames: 100,
            currentFrame: this.currentFrame,
          })
        }
        // Mana Burn (MonUMod 25): drain the MonUMod constant percentage of damage.
        if (monster.umodIds.includes(MON_UMOD.MANahit)) {
          const drain = Math.max(
            1,
            Math.floor((finalDmg * monUmodConstant113c(MON_UMOD.MANahit)) / 100),
          )
          const nextManaFixed = Math.max(0, player.manaFixed - drain * FIXED_ONE)
          if (nextManaFixed !== player.manaFixed) {
            player.manaFixed = nextManaFixed
            player.mana = Math.floor(player.manaFixed / FIXED_ONE)
            this.emitToPlayer(player.unitId, {
              type: 'UnitStatUpdate',
              unitType: 'player',
              unitId: player.unitId,
              statId: 8,
              value: player.manaFixed,
            })
          }
        }
        // Spectral Hit (MonUMod 27): 50% split fire/cold/lightning extra damage.
        if (monster.umodIds.includes(MON_UMOD.SPECTRALHIT)) {
          const elem = Math.max(
            1,
            Math.floor((finalDmg * monUmodConstant113c(MON_UMOD.SPECTRALHIT)) / 300),
          )
          this.applyPlayerElementalDamage(player, { fire: elem, cold: elem, light: elem })
        }
        // Cold Enchanted (MonUMod 18): half attack damage as cold + chill.
        if (monster.umodIds.includes(MON_UMOD.COLD)) {
          const cold = Math.max(1, Math.floor(finalDmg / 2))
          this.applyPlayerElementalDamage(player, { cold })
          this.applyUnitState(
            player.states,
            player.stateTimers,
            'player',
            player.unitId,
            player.areaId,
            11,
            75,
          )
        }
        this.applyDamageToPlayer(player, finalDmg)
        // MonAi innate drain rows (Vampire/BatDemon/BloodLord life, WillOWisp
        // mana, Swarm stamina, Mosquito life). 1.13c returns half the hit.
        const drainKind = monsterProfile113c(monster.ai).drain
        const drainAmount = Math.max(1, Math.floor(finalDmg / 2))
        if (drainKind === 'life' && !monster.dead) {
          const nextHp = Math.min(monster.maxHp, monster.hp + drainAmount)
          if (nextHp !== monster.hp) {
            monster.hp = nextHp
            this.broadcastToArea(monster.areaId, {
              type: 'UnitStatUpdate',
              unitType: 'monster',
              unitId: monster.unitId,
              statId: 6,
              value: monster.hp,
            })
          }
        } else if (drainKind === 'mana') {
          player.manaFixed = Math.max(0, player.manaFixed - drainAmount * FIXED_ONE)
          player.mana = Math.floor(player.manaFixed / FIXED_ONE)
          this.emitToPlayer(player.unitId, {
            type: 'UnitStatUpdate',
            unitType: 'player',
            unitId: player.unitId,
            statId: 8,
            value: player.manaFixed,
          })
        } else if (drainKind === 'stamina') {
          player.staminaFixed = Math.max(
            0,
            player.staminaFixed - drainAmount * FIXED_ONE,
          )
          player.stamina = Math.floor(player.staminaFixed / FIXED_ONE)
          this.emitToPlayer(player.unitId, {
            type: 'UnitStatUpdate',
            unitType: 'player',
            unitId: player.unitId,
            statId: 10,
            value: player.staminaFixed,
          })
        }
      }
    }
  }

  /**
   * 1.13c STAT_VELOCITYPERCENT (stat 67) for a monster: base 100%, Extra Fast
   * (MonUMod 6) +50%, chill/Decrepify/Holy Freeze slow, and active Frenzy bonus.
   */
  private monsterVelocityPercent(monster: InternalMonsterRecord): number {
    const velocityPct =
      100 +
      (monster.umodIds.includes(6) ? 50 : 0) -
      this.monsterSlowPercent(monster) +
      (this.currentFrame < monster.frenzyUntilFrame ? monster.frenzySpeedPct : 0)
    return Math.max(5, velocityPct)
  }

  /**
   * 1.13c movement rate: MonStats `Velocity`/`Run` are yards/s; 1 yard = 1.5 sub-tiles,
   * 25 ticks/s. Extra Fast (MonUMod 6) is +50%; chill/Decrepify/Holy Freeze halve it.
   */
  private monsterStepSpeed(monster: InternalMonsterRecord, running: boolean): number {
    const yards = running ? monster.runSpeed : monster.velocity
    const base = (Math.max(1, yards || 6) * 1.5) / 25
    return base * (this.monsterVelocityPercent(monster) / 100)
  }

  /**
   * Total 1.13c movement-slow percentage for a monster. Cold uses `MonStats.txt`
   * `ColdEffect` (Normal -50, Nightmare -40, Hell -25 for most rows); Decrepify is
   * -50; Holy Freeze's `holywindcold` (state 44) carries the skill-level slow in
   * `velocitypercent` (`30% + 5%/lvl` diminished, cap 60).
   */
  private monsterSlowPercent(monster: InternalMonsterRecord): number {
    let slowPct = 0
    if (monster.states.has(11) || monster.chillTicks > 0) {
      slowPct += Math.min(100, Math.abs(monster.coldEffect))
    }
    const bus = this.monsterCombat.get(monster.unitId)?.stateBus
    const addStateSlow = (stateId: number, fallbackPct: number): void => {
      if (!monster.states.has(stateId) && !bus?.hasState(stateId)) return
      const entry = bus?.getState(stateId)
      slowPct += Math.min(100, Math.abs(entry?.stats.velocitypercent ?? fallbackPct))
    }
    addStateSlow(60, 50)
    // `holywindcold` (44) is the target state; `holywind` (43) is the caster's own aura.
    if (bus?.hasState(44) || monster.states.has(44)) {
      addStateSlow(44, 25)
    } else {
      addStateSlow(43, 25)
    }
    return Math.min(95, slowPct)
  }

  /**
   * 1.13c per-frame poison DoT tick (`D2Game.dll` `0x6FC97410`): accumulates `poisonBitrate256`
   * (`1/256` HP/frame) over `poisonRemainingFrames` (`ELen`), subtracting whole HP points each frame
   * so the total HP lost over `ELen` frames is `(poisonBitrate256 * ELen) >> 8`.
   */
  private stepMonsterPoison(monster: InternalMonsterRecord): void {
    if (monster.dead || monster.isNpc || !monster.isKillable) return
    if (monster.poisonRemainingFrames <= 0 || monster.poisonBitrate256 <= 0) return
    monster.poisonRemainingFrames -= 1
    monster.poisonCarry256 += monster.poisonBitrate256
    const wholeDmg = Math.floor(monster.poisonCarry256 / FIXED_ONE)
    if (wholeDmg > 0) {
      monster.poisonCarry256 -= wholeDmg * FIXED_ONE
      monster.hp = Math.max(0, monster.hp - wholeDmg)
      this.broadcastToArea(monster.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: monster.unitId,
        statId: 6,
        value: monster.hp,
      })
      if (monster.hp <= 0) {
        const attacker =
          this.players.get(monster.poisonAttackerId) ??
          this.players.values().next().value
        monster.poisonRemainingFrames = 0
        monster.poisonBitrate256 = 0
        monster.poisonCarry256 = 0
        if (attacker !== undefined) {
          this.applyMonsterDeath(monster, attacker, 'pois')
        } else {
          monster.dead = true
          monster.mode = 12
        }
        return
      }
    }
    if (monster.poisonRemainingFrames <= 0) {
      monster.poisonBitrate256 = 0
      monster.poisonCarry256 = 0
    }
  }

  /**
   * `MonStats.txt` `DamageRegen`: `maxHp * DamageRegen / 8192` life per frame.
   * The fractional remainder is carried so low regeneration rates still tick.
   */
  private stepMonsterRegen(monster: InternalMonsterRecord): void {
    if (monster.dead || monster.damageRegen <= 0 || monster.hp >= monster.maxHp) return
    // Poison (state 2), Open Wounds (62) and Prevent Monster Heal (52) suppress
    // natural regeneration in 1.13c.
    const stateBus = this.monsterCombat.get(monster.unitId)?.stateBus
    if (
      monster.states.has(2) ||
      monster.states.has(62) ||
      monster.states.has(52) ||
      stateBus?.hasState(2) ||
      stateBus?.hasState(62) ||
      stateBus?.hasState(52)
    ) {
      return
    }
    monster.regenCarry += (monster.maxHp * monster.damageRegen) / 8192
    const whole = Math.floor(monster.regenCarry)
    if (whole <= 0) return
    monster.regenCarry -= whole
    const nextHp = Math.min(monster.maxHp, monster.hp + whole)
    if (nextHp === monster.hp) return
    monster.hp = nextHp
    this.broadcastToArea(monster.areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId: monster.unitId,
      statId: 6,
      value: monster.hp,
    })
  }

  private areaIdAtWorldPoint(x: number, y: number): number | undefined {
    for (const [areaId, record] of this.loadedAreas) {
      for (const room of record.roomRects) {
        if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) {
          return areaId
        }
      }
    }
    return undefined
  }

  /** D2Common path search over the area collision window (`unitSize: 1` for monsters). */
  private findMonsterPath(
    monster: InternalMonsterRecord,
    targetX: number,
    targetY: number,
  ): readonly SubTilePoint[] {
    const check = this.terrainWalkableCheck
    let hasClosedDoor = false
    for (const obj of this.objects.values()) {
      if (obj.mode !== 2 && this.isAreaSeamAdjacent(monster.areaId, obj.areaId)) {
        const rec = getObjectsTxtRecord113c(obj.classId)
        if (rec.isDoor === 1) {
          hasClosedDoor = true
          break
        }
      }
    }
    if (!check && !hasClosedDoor) return [{ x: Math.round(targetX), y: Math.round(targetY) }]
    const margin = 20
    const minX = Math.max(0, Math.floor(Math.min(monster.x, targetX)) - margin)
    const minY = Math.max(0, Math.floor(Math.min(monster.y, targetY)) - margin)
    const maxX = Math.floor(Math.max(monster.x, targetX)) + margin
    const maxY = Math.floor(Math.max(monster.y, targetY)) + margin
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const walkable = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wx = minX + x
        const wy = minY + y
        const pointArea = this.areaIdAtWorldPoint(wx, wy) ?? monster.areaId
        walkable[y * w + x] =
          !this.isClosedDoorAt(pointArea, wx, wy) &&
          (!check || check(pointArea, wx, wy, monster.isFlying))
            ? 1
            : 0
      }
    }
    return findPathWorld(
      { subWidth: w, subHeight: h, walkable, subOriginX: minX, subOriginY: minY },
      monster.x,
      monster.y,
      targetX,
      targetY,
      { unitSize: 1 },
    ).path
  }

  /** Unit-size cell occupancy: monsters, players, mercs and pets block each other. */
  private isMonsterCellOccupied(monster: InternalMonsterRecord, x: number, y: number): boolean {
    const selfRadius = Math.max(0.5, 0.75 + (monster.sizeX - 2) * 0.25)
    type Occupant = {
      readonly key: string
      readonly x: number
      readonly y: number
      readonly radius: number
    }
    const occupants: Occupant[] = []
    for (const other of this.monsters.values()) {
      if (other.unitId === monster.unitId || other.dead || other.isNpc || !this.isAreaSeamAdjacent(monster.areaId, other.areaId)) continue
      occupants.push({
        key: `m:${String(other.unitId)}`,
        x: other.x,
        y: other.y,
        radius: Math.max(0.5, 0.75 + (other.sizeX - 2) * 0.25),
      })
    }
    for (const p of this.players.values()) {
      if (p.dead || !this.isAreaSeamAdjacent(monster.areaId, p.areaId)) continue
      occupants.push({ key: `p:${String(p.unitId)}`, x: p.x, y: p.y, radius: 0.75 })
    }
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) continue
      const mercOwner = this.players.get(merc.ownerPlayerId)
      if (mercOwner !== undefined && (mercOwner.dead || !this.isAreaSeamAdjacent(monster.areaId, mercOwner.areaId))) continue
      occupants.push({ key: `merc:${String(merc.unitId)}`, x: merc.x, y: merc.y, radius: 0.75 })
    }
    for (const [ownerId, mgr] of this.summonManagers) {
      const owner = this.players.get(ownerId)
      if (owner === undefined || owner.dead || !this.isAreaSeamAdjacent(monster.areaId, owner.areaId)) continue
      for (const pet of mgr.getActivePets()) {
        if (pet.alive === false || pet.hp <= 0) continue
        occupants.push({ key: `pet:${String(this.petUnitIds.get(pet.uid) ?? pet.uid)}`, x: pet.x, y: pet.y, radius: 0.75 })
      }
    }

    // Units already overlapping the monster may only move *away* from that same
    // unit; every other occupant still blocks the destination cell.
    const overlapping = new Set<string>()
    for (const other of occupants) {
      const threshold = (selfRadius + other.radius) / 2
      if (Math.hypot(other.x - monster.x, other.y - monster.y) < threshold) {
        overlapping.add(other.key)
      }
    }
    for (const other of occupants) {
      const threshold = (selfRadius + other.radius) / 2
      if (Math.hypot(other.x - x, other.y - y) >= threshold) continue
      if (!overlapping.has(other.key)) return true
      const currentDist = Math.hypot(other.x - monster.x, other.y - monster.y)
      const nextDist = Math.hypot(other.x - x, other.y - y)
      if (nextDist <= currentDist + 1e-6) return true
    }
    return false
  }

  /**
   * Follow (or recompute) the cached path toward `(targetX, targetY)` and broadcast the
   * 1.13c `UnitMove` walk/run step. Returns the remaining distance to the target.
   */
  private moveMonsterToward(
    monster: InternalMonsterRecord,
    targetX: number,
    targetY: number,
    running: boolean,
  ): number {
    monster.pathRunning = running
    if (targetX !== monster.pathTargetX || targetY !== monster.pathTargetY || monster.pathIndex >= monster.path.length) {
      monster.path = this.findMonsterPath(monster, targetX, targetY)
      monster.pathIndex = 0
      monster.pathTargetX = targetX
      monster.pathTargetY = targetY
    }
    const speed = this.monsterStepSpeed(monster, running)
    const fromX = monster.x
    const fromY = monster.y
    let remaining = speed
    while (remaining > 0 && monster.pathIndex < monster.path.length) {
      const wp = monster.path[monster.pathIndex]!
      const dx = wp.x - monster.x
      const dy = wp.y - monster.y
      const dist = Math.hypot(dx, dy)
      if (dist <= 1e-6) {
        monster.pathIndex++
        continue
      }
      if (dist <= remaining) {
        if (
          !this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, wp.x, wp.y, monster.isFlying) ||
          this.isMonsterCellOccupied(monster, wp.x, wp.y)
        ) {
          monster.path = []
          monster.pathIndex = 0
          break
        }
        monster.x = wp.x
        monster.y = wp.y
        remaining -= dist
        monster.pathIndex++
      } else {
        const nx = monster.x + (dx / dist) * remaining
        const ny = monster.y + (dy / dist) * remaining
        if (
          !this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, nx, ny, monster.isFlying) ||
          this.isMonsterCellOccupied(monster, nx, ny)
        ) {
          monster.path = []
          monster.pathIndex = 0
          break
        }
        monster.x = nx
        monster.y = ny
        remaining = 0
      }
    }
    const moved = Math.hypot(monster.x - fromX, monster.y - fromY) > 1e-6
    if (moved) {
      // 1.13c MonMode: 2 = walk, 15 = run (3 is MONMODE_GETHIT, not run).
      monster.mode = running ? MONMODE_RUN : MONMODE_WALK
      const velocityPercent = this.monsterVelocityPercent(monster)
      const current = { x: Math.round(monster.x), y: Math.round(monster.y) }
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMove',
        unitType: 'monster',
        id: monster.unitId,
        unitId: monster.unitId,
        mode: running ? 'run' : 'walk',
        from: { x: Math.round(fromX), y: Math.round(fromY) },
        to: { x: Math.round(targetX), y: Math.round(targetY) },
        x: current.x,
        y: current.y,
        currentX: current.x,
        currentY: current.y,
        targetX: Math.round(targetX),
        targetY: Math.round(targetY),
        moveType: running ? 1 : 0,
        pathType: running ? 1 : 0,
        velocityPercent,
        areaId: monster.areaId,
        // S2C 0x67 `NPCMove` payload for every monster (not only NPCs).
        npc: {
          opcode: 0x67 as const,
          cmd: running ? 0x17 : 0x01,
          s: [
            Math.round(targetX),
            Math.round(targetY),
            1,
            running ? 1 : 0,
            velocityPercent,
            14,
            0,
          ] as const,
          driftCheckAt: current,
        },
      })
    }
    return Math.hypot(targetX - monster.x, targetY - monster.y)
  }

  /**
   * 1.13c room sleep: a monster only runs its AI while a player is in the same
   * area and within the room/adjacent-room activation radius. Far units still
   * process state timers and death drops, but skip pathfinding and attacks.
   */
  private isAreaSeamAdjacent(a: number, b: number): boolean {
    if (a === b) return true
    const forward = this.loadedAreas.get(a)?.adjacentAreaIds ?? []
    if (forward.includes(b)) return true
    const backward = this.loadedAreas.get(b)?.adjacentAreaIds ?? []
    return backward.includes(a)
  }

  private isMonsterInActiveAoi(monster: InternalMonsterRecord): boolean {
    const rooms = this.loadedAreas.get(monster.areaId)?.roomRects ?? []
    const roomAt = (x: number, y: number) =>
      rooms.find((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h)
    const monsterRoom = rooms.length > 0 ? roomAt(monster.x, monster.y) : undefined
    for (const player of this.players.values()) {
      if (player.dead || !this.isAreaSeamAdjacent(monster.areaId, player.areaId)) continue
      const sameArea = player.areaId === monster.areaId
      if (sameArea && monsterRoom !== undefined) {
        const playerRoom = roomAt(player.x, player.y)
        if (playerRoom !== undefined) {
          // 1.13c runs the player's room and its 8 neighbours.
          const gapX = Math.max(
            0,
            Math.max(playerRoom.x - (monsterRoom.x + monsterRoom.w), monsterRoom.x - (playerRoom.x + playerRoom.w)),
          )
          const gapY = Math.max(
            0,
            Math.max(playerRoom.y - (monsterRoom.y + monsterRoom.h), monsterRoom.y - (playerRoom.y + playerRoom.h)),
          )
          if (gapX <= 1 && gapY <= 1) return true
          continue
        }
      }
      // Units outside any room (or a level without room rects) fall back to
      // the previous distance proxy.
      if (
        Math.hypot(player.x - monster.x, player.y - monster.y) <=
        MONSTER_ACTIVATION_RADIUS_SUBTILES
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Nearest hostile (player, mercenary or summoned pet) in the area within the monster's
   * aggro radius. 1.13c monsters target all three, not only players.
   */
  private nearestHostileForMonster(
    monster: InternalMonsterRecord,
    radius: number,
  ): { readonly kind: 'player'; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord } | { readonly kind: 'merc'; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord } | { readonly kind: 'pet'; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit } | null {
    let best: { kind: 'player'; x: number; y: number; player: InternalPlayerRecord } | { kind: 'merc'; x: number; y: number; merc: InternalMercenaryRecord } | { kind: 'pet'; x: number; y: number; pet: SummonedPetUnit } | null = null
    let bestDist = radius
    // 1.13c line-of-sight: strict walkable/door ray across the monster's area and any seam-adjacent area.
    const hasLineOfSight = (x: number, y: number): boolean =>
      this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, x, y, monster.isFlying)
    for (const p of this.players.values()) {
      if (p.dead || !this.isAreaSeamAdjacent(monster.areaId, p.areaId)) continue
      const d = Math.hypot(p.x - monster.x, p.y - monster.y)
      if (d < bestDist && hasLineOfSight(p.x, p.y)) {
        bestDist = d
        best = { kind: 'player', x: p.x, y: p.y, player: p }
      }
    }
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) continue
      const mercOwner = this.players.get(merc.ownerPlayerId)
      if (mercOwner !== undefined && (mercOwner.dead || !this.isAreaSeamAdjacent(monster.areaId, mercOwner.areaId))) continue
      const d = Math.hypot(merc.x - monster.x, merc.y - monster.y)
      if (d < bestDist && hasLineOfSight(merc.x, merc.y)) {
        bestDist = d
        best = { kind: 'merc', x: merc.x, y: merc.y, merc }
      }
    }
    for (const [ownerId, mgr] of this.summonManagers) {
      const owner = this.players.get(ownerId)
      if (owner === undefined || owner.dead || !this.isAreaSeamAdjacent(monster.areaId, owner.areaId)) continue
      for (const pet of mgr.getActivePets()) {
        if (pet.alive === false || pet.hp <= 0) continue
        const d = Math.hypot(pet.x - monster.x, pet.y - monster.y)
        if (d < bestDist && hasLineOfSight(pet.x, pet.y)) {
          bestDist = d
          best = { kind: 'pet', x: pet.x, y: pet.y, pet }
        }
      }
    }
    return best
  }

  /**
   * Cast one of MonStats `Skill1..8` when it is ready and in range. Projectile
   * skills are evaluated through the same `evaluateSkill113c` registry as player
   * casts; their `srvmissile`/`srvmissilea` row and `Missiles.txt` EType decide
   * the launch and damage channel. Non-projectile utility skills (resurrection,
   * curses, summons) keep their dedicated handlers.
   */
  private tryCastMonsterSkill(
    monster: InternalMonsterRecord,
    target: { readonly x: number; readonly y: number },
    distance: number,
    options?: { readonly hitMonsters?: boolean | undefined },
  ): boolean {
    if (monster.skillCooldown > 0 || monster.skills.length === 0) return false
    const profile = monsterProfile113c(monster.ai)
    // Healers such as HighPriest (row 85) must evaluate ZakarumHeal before their
    // projectile slots; otherwise the projectile candidate list always wins.
    if (
      options?.hitMonsters !== true &&
      (profile.healRangeParam !== undefined || profile.whip === true) &&
      this.tryCastMonsterUtilitySkill(monster, target, distance)
    ) {
      return true
    }
    const difficulty = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
    const ordered = [...monster.skills].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    const candidates: {
      readonly entry: MonsterSkillEntry
      readonly skill: SkillRecord
      readonly missileRec: MissileRecord
    }[] = []
    for (const entry of ordered) {
      if (entry.skillId === undefined) continue
      // Resurrection (181/327/158) is executed by the shaman/undead handler with
      // its own corpse/race rules, not as a projectile.
      if (entry.skillId === 181 || entry.skillId === 327 || entry.skillId === 158) continue
      const skill = this.registry.getSkillById(entry.skillId)
      if (skill === undefined) continue
      if (skill.summon !== '' || skill.petType !== '') continue
      if (/heal|vortex|aura|teleport|armor|bestow/i.test(skill.name)) continue
      const missileName =
        skill.srvMissile !== ''
          ? skill.srvMissile
          : skill.srvMissileA !== ''
            ? skill.srvMissileA
            : ''
      if (missileName === '') continue
      const missileRec = this.registry.getMissileByName(missileName)
      if (missileRec === undefined) continue
      candidates.push({ entry, skill, missileRec })
    }
    if (candidates.length === 0) return this.tryCastMonsterUtilitySkill(monster, target, distance)
    // Melee-range monsters alternate between their skill and A1 instead of never
    // swinging; at range the cooldown alone paces the casts.
    if (distance <= 2.5 && this.rng.rand(2) !== 0) return false
    const chosen = candidates[monster.skillCursor % candidates.length]!
    const { entry, skill, missileRec } = chosen
    monster.skillCursor = (monster.skillCursor + 1) % Math.max(1, candidates.length)
    const skillLevel = Math.max(1, entry.level)
    const rangeFrames = Math.max(2, missileRec.range + missileRec.levRange * (skillLevel - 1))
    const missileReach =
      missileRec.vel > 0 ? Math.max(rangeFrames, (missileRec.vel / 16) * rangeFrames) : rangeFrames
    if (distance > Math.min(35, Math.max(4, missileReach))) return false
    const statList = new UnitStatList()
    statList.setBaseStat('level', monster.level)
    statList.setBaseStat('strength', 0)
    statList.setBaseStat('dexterity', 0)
    statList.setBaseStat('vitality', 0)
    statList.setBaseStat('energy', 0)
    statList.setBaseSkillLevel(entry.skillId!, skillLevel)
    const evalResult = evaluateSkill113c({
      registry: this.registry,
      skill,
      slvl: skillLevel,
      blvl: skillLevel,
      statList,
      difficulty,
    })
    let phys = this.rollInclusive(evalResult.minPhysDmg, evalResult.maxPhysDmg)
    let elem = this.rollInclusive(evalResult.minElemDmg, evalResult.maxElemDmg)
    if (phys + elem <= 0 && missileRec.minDamage + missileRec.maxDamage > 0) {
      // Most rows store 8-bit fixed point (1792 = 7), but some flat rows store
      // the literal damage (Mephisto 12..16).
      const divisor =
        missileRec.minDamage >= 256 || missileRec.maxDamage >= 256 ? 256 : 1
      const lo = Math.trunc(missileRec.minDamage / divisor)
      const hi = Math.trunc(missileRec.maxDamage / divisor)
      if (normalizeMissileElement(missileRec.eType) !== undefined) {
        elem = this.rollInclusive(lo, hi)
      } else {
        phys = this.rollInclusive(lo, hi)
      }
    }
    if (phys + elem <= 0) {
      phys = this.rollInclusive(monster.minDmg, monster.maxDmg)
    }
    const element =
      normalizeMissileElement(missileRec.eType) ??
      normalizeMissileElement(skill.eType) ??
      'phys'
    if (element !== 'phys') {
      elem += phys
      phys = 0
    }
    const mode = this.monsterSkillMode(entry.mode)
    monster.mode = mode
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode,
      at: { x: Math.round(target.x), y: Math.round(target.y) },
      lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
    })
    this.spawnMonsterMissile(monster, target.x, target.y, phys + elem, missileRec.id, skill.id, {
      missile: missileRec,
      skillLevel: Math.max(1, entry.level),
      physDamage: phys,
      elemDamage: elem,
      element,
      ...(options?.hitMonsters === true ? { hitMonsters: true } : {}),
    })
    const delay = Number.parseInt(skill.delay, 10)
    monster.skillCooldown =
      Number.isFinite(delay) && delay > 0
        ? delay
        : Math.max(25, monster.cooldownTicks * 2)
    return true
  }

  /**
   * Non-projectile `Skill1..8` (ZakarumHeal, MonTeleport, MonBoneArmor,
   * FetishAura): heal, blink or apply the skill's self state. Summons/turrets
   * keep their dedicated runtime.
   */
  private tryCastMonsterUtilitySkill(
    monster: InternalMonsterRecord,
    target: { readonly x: number; readonly y: number },
    distance: number,
  ): boolean {
    // Heal slots must win over summon/projectile slots (HighPriest has Hydra in
    // slot 1 and ZakarumHeal in slot 2), so evaluate them in a first pass.
    const healEntry = monster.skills.find((entry) => {
      if (entry.skillId === undefined) return false
      const skill = this.registry.getSkillById(entry.skillId)
      return skill !== undefined && /heal/.test(skill.name.toLowerCase())
    })
    if (healEntry?.skillId !== undefined) {
      const healSkill = this.registry.getSkillById(healEntry.skillId)
      if (healSkill !== undefined) {
        const profile = monsterProfile113c(monster.ai)
        const healRange = Math.max(
          0,
          monaiParam113c(profile, monster.aiParams, profile.healRangeParam, 0),
        )
        let healTarget = monster
        if (healRange > 0) {
          let lowestPct = monster.maxHp > 0 ? monster.hp / monster.maxHp : 1
          for (const ally of this.monsters.values()) {
            if (
              ally.dead ||
              ally.isNpc ||
              ally.areaId !== monster.areaId ||
              ally.hp >= ally.maxHp ||
              Math.hypot(ally.x - monster.x, ally.y - monster.y) > healRange
            ) {
              continue
            }
            const pct = ally.maxHp > 0 ? ally.hp / ally.maxHp : 1
            if (pct < lowestPct) {
              lowestPct = pct
              healTarget = ally
            }
          }
        }
        const heal = Math.max(1, Math.floor(healTarget.maxHp * 0.25))
        const nextHp = Math.min(healTarget.maxHp, healTarget.hp + heal)
        if (nextHp > healTarget.hp) {
          healTarget.hp = nextHp
          const healMode = this.monsterSkillMode(healEntry.mode)
          monster.mode = healMode
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: healMode,
            at: { x: Math.round(healTarget.x), y: Math.round(healTarget.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          this.broadcastToArea(healTarget.areaId, {
            type: 'UnitStatUpdate',
            unitType: 'monster',
            unitId: healTarget.unitId,
            statId: 6,
            value: healTarget.hp,
          })
          this.setMonsterSkillCooldown(monster, healSkill.delay)
          return true
        }
      }
    }
    for (const entry of monster.skills) {
      if (entry.skillId === undefined) continue
      if (entry.skillId === 181 || entry.skillId === 327 || entry.skillId === 158) continue
      const skill = this.registry.getSkillById(entry.skillId)
      if (skill === undefined) continue
      const name = skill.name.toLowerCase()
      if (/heal/.test(name)) {
        // HighPriest row 85 aip6 is the heal radius; pick the most wounded ally
        // (including self) inside it. GreaterMummy/FetishShaman rows fall back
        // to healing themselves.
        const profile = monsterProfile113c(monster.ai)
        const healRange = Math.max(
          0,
          monaiParam113c(profile, monster.aiParams, profile.healRangeParam, 0),
        )
        let healTarget = monster
        if (healRange > 0) {
          let lowestPct = monster.maxHp > 0 ? monster.hp / monster.maxHp : 1
          for (const ally of this.monsters.values()) {
            if (
              ally.dead ||
              ally.isNpc ||
              ally.areaId !== monster.areaId ||
              ally.hp >= ally.maxHp ||
              Math.hypot(ally.x - monster.x, ally.y - monster.y) > healRange
            ) {
              continue
            }
            const pct = ally.maxHp > 0 ? ally.hp / ally.maxHp : 1
            if (pct < lowestPct) {
              lowestPct = pct
              healTarget = ally
            }
          }
        }
        const heal = Math.max(1, Math.floor(healTarget.maxHp * 0.25))
        const nextHp = Math.min(healTarget.maxHp, healTarget.hp + heal)
        if (nextHp === healTarget.hp) continue
        healTarget.hp = nextHp
        const healMode = this.monsterSkillMode(entry.mode)
        monster.mode = healMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: healMode,
          at: { x: Math.round(healTarget.x), y: Math.round(healTarget.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.broadcastToArea(healTarget.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: healTarget.unitId,
          statId: 6,
          value: healTarget.hp,
        })
        this.setMonsterSkillCooldown(monster, skill.delay)
        return true
      }
      if (entry.skillId === 290) {
        // Overseer `Cry Help`: rally nearby un-rallied allies onto the current target.
        const nearest = this.players.values()
        let nearestPlayer: InternalPlayerRecord | undefined
        let nearestDist = Infinity
        for (const player of nearest) {
          if (player.dead || player.areaId !== monster.areaId) continue
          const dist = Math.hypot(player.x - monster.x, player.y - monster.y)
          if (dist < nearestDist) {
            nearestDist = dist
            nearestPlayer = player
          }
        }
        if (nearestPlayer === undefined) continue
        let rallied = 0
        for (const ally of this.monsters.values()) {
          if (
            ally.dead ||
            ally.isNpc ||
            ally.unitId === monster.unitId ||
            ally.areaId !== monster.areaId ||
            ally.threatUntilFrame > this.currentFrame ||
            Math.hypot(ally.x - monster.x, ally.y - monster.y) > 20
          ) {
            continue
          }
          ally.threatPlayerId = nearestPlayer.unitId
          ally.threatUntilFrame = this.currentFrame + 150
          rallied++
        }
        if (rallied <= 0) continue
        const cryMode = this.monsterSkillMode(entry.mode)
        monster.mode = cryMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: cryMode,
          at: { x: Math.round(nearestPlayer.x), y: Math.round(nearestPlayer.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.setMonsterSkillCooldown(monster, skill.delay)
        return true
      }
      if (entry.skillId === 295) {
        // Overseer `Overseer Whip` (`D2Game.dll` `0x6fc2d9c0`, `srvdofunc=131`):
        // whips a nearby minion / ally with `bloodlust` (state 140, 250 frames) using mode A2 (5).
        let whipTarget: InternalMonsterRecord | undefined
        let bestWhipDist = 10
        for (const ally of this.monsters.values()) {
          if (
            ally.dead ||
            ally.isNpc ||
            ally.unitId === monster.unitId ||
            ally.areaId !== monster.areaId ||
            ally.states.has(140)
          ) {
            continue
          }
          const d = Math.hypot(ally.x - monster.x, ally.y - monster.y)
          if (d <= bestWhipDist && (whipTarget === undefined || ally.monType === 'minion')) {
            bestWhipDist = d
            whipTarget = ally
          }
        }
        if (whipTarget === undefined) continue
        this.applyMonsterState(whipTarget.unitId, 140, 250)
        monster.mode = 5
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 5,
          at: { x: Math.round(whipTarget.x), y: Math.round(whipTarget.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.setMonsterSkillCooldown(monster, skill.delay)
        return true
      }
      if (/teleport/.test(name)) {
        const tx = monster.x + (target.x - monster.x) * 0.6
        const ty = monster.y + (target.y - monster.y) * 0.6
        if (
          this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) ||
          (this.terrainWalkableCheck &&
            !this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), monster.isFlying)) ||
          this.isMonsterCellOccupied(monster, tx, ty)
        ) {
          continue
        }
        const from = { x: Math.round(monster.x), y: Math.round(monster.y) }
        monster.x = tx
        monster.y = ty
        monster.path = []
        monster.pathIndex = 0
        monster.pathTargetX = Number.NaN
        monster.pathTargetY = Number.NaN
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMove',
          unitType: 'monster',
          id: monster.unitId,
          unitId: monster.unitId,
          mode: 'run',
          from,
          to: { x: Math.round(tx), y: Math.round(ty) },
          x: Math.round(tx),
          y: Math.round(ty),
          currentX: Math.round(tx),
          currentY: Math.round(ty),
          targetX: Math.round(tx),
          targetY: Math.round(ty),
          areaId: monster.areaId,
        })
        this.setMonsterSkillCooldown(monster, skill.delay)
        return true
      }
      if (skill.summon !== '') {
        const summonMode = this.monsterSkillMode(entry.mode)
        monster.mode = summonMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: summonMode,
          at: { x: Math.round(target.x), y: Math.round(target.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        try {
          this.spawnMonster({
            defId: skill.summon,
            x: target.x,
            y: target.y,
            areaId: monster.areaId,
            level: monster.level,
          })
        } catch {
          continue
        }
        this.setMonsterSkillCooldown(monster, skill.delay)
        return true
      }
      const stateName = skill.auraState !== '' ? skill.auraState : skill.state1
      if (stateName !== '') {
        const state = this.registry.getStateByName(stateName)
        if (state === undefined) continue
        this.applyMonsterState(monster.unitId, state.id, 100)
        const stateMode = this.monsterSkillMode(entry.mode)
        monster.mode = stateMode
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: stateMode,
          at: { x: Math.round(monster.x), y: Math.round(monster.y) },
          lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
        })
        this.setMonsterSkillCooldown(monster, skill.delay)
        return true
      }
      if (distance > 20) continue
    }
    return false
  }

  private setMonsterSkillCooldown(monster: InternalMonsterRecord, delay: string): void {
    const parsed = Number.parseInt(delay, 10)
    monster.skillCooldown =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : Math.max(25, monster.cooldownTicks * 2)
  }

  /** Map `MonStats.txt Sk*Mode` onto the 1.13c unit mode ids. */
  private monsterSkillMode(mode?: string): number {
    switch ((mode ?? '').toUpperCase()) {
      case 'A1':
        return 4
      case 'A2':
        return 5
      case 'S1':
        return 8
      case 'S2':
        return 9
      case 'S3':
        return 10
      case 'S4':
        return 11
      case 'C':
        return 4
      case 'SC':
      case 'SQ':
        return 8
      default:
        return 8
    }
  }

  /**
   * `AITHINK_Fn134_BaalThrone` (`D2Game.dll` `0x6FCC8430`, `MonStats.txt` `#543` `baalthrone`):
   * - While any living killable monster exists within `64` (`0x40`) sub-tiles (`sub_6FC68F60`),
   *   rolls `aip1 = 25%` to cast `#87 Decrepify` (`slvl = 5`, mode `10 = S3`) on the nearest player
   *   if not already decrepified (`state 60`).
   * - When no living monster remains within `64` sub-tiles and `currentFrame >= baalThroneTimerFrame`:
   *   - **Sub-step A** (`!(baalThroneFlags & 1)`):
   *     1. Sends `0xA4 MonsterSpecial` for the upcoming wave's `leaderHcIdx`, `minionHcIdx`, and `extraMinionHcIdx`.
   *     2. Casts `#285 Baal Corpse Explode` (`slvl = 1`, mode `10 = S3`), consuming monster corpses within `40` (`0x28`) sub-tiles (`STATE_CORPSE_NODRAW = 104`).
   *     3. Emits `0x2C PlaySound` (`sound = 16`, `MONSTER_TAUNT` -> `4631` `monster_baal_taunt_1`).
   *     4. Sets `baalThroneFlags |= 1` and `baalThroneTimerFrame = currentFrame + 250` (`10.0s`).
   *   - **Sub-step B** (`(baalThroneFlags & 1) !== 0`):
   *     - For waves `0..4`: casts `#286 Baal Monster Spawn` (`slvl = 1`, mode `10 = S3`, missile `#550` `'baal spawn monsters'`) at `(x, y + 13)`, schedules `spawnSuperUnique(61 + wave, x, y + 13)` after `17` frames (`680ms`), increments `baalThroneWave`, sets `baalThroneTimerFrame = currentFrame + 100` (`4.0s`), and sets `baalThroneFlags = (baalThroneFlags | 2) & ~1`.
   *     - When `baalThroneWave >= 5`: transforms in-place into `#559 baalcrabstairs` (`ai = 'BaalToStairs'`), sets `STATE_CHANGECLASS` (`142`) with `STAT_SHORTPARAM1` (`355`) = `559`, and stalls AI for `5` frames.
   */
  private stepBaalThroneAi(monster: InternalMonsterRecord): void {
    const playersInArea = [...this.players.values()].filter(
      (p) => !p.dead && p.areaId === monster.areaId,
    )
    if (this.players.size > 0 && playersInArea.length === 0) return

    let hasLivingWaveMonster = false
    for (const other of this.monsters.values()) {
      if (
        other.unitId === monster.unitId ||
        other.dead ||
        other.isNpc ||
        !other.isKillable ||
        other.areaId !== monster.areaId
      ) {
        continue
      }
      if (Math.hypot(other.x - monster.x, other.y - monster.y) <= 64) {
        hasLivingWaveMonster = true
        break
      }
    }

    if (hasLivingWaveMonster || monster.pendingBaalWaveSpawn !== undefined) {
      let nearestPlayer: InternalPlayerRecord | undefined
      let nearestDist = Infinity
      for (const p of playersInArea) {
        const d = Math.hypot(p.x - monster.x, p.y - monster.y)
        if (d < nearestDist) {
          nearestDist = d
          nearestPlayer = p
        }
      }
      const decrepChance = monster.aiParams[0] || 25
      if (
        nearestPlayer !== undefined &&
        nearestDist <= Math.max(monster.aggroRadius, 35) &&
        !nearestPlayer.states.has(60) &&
        this.rng.rand(100) < decrepChance
      ) {
        monster.mode = 10
        this.applyPlayerState(nearestPlayer.unitId, 60, 160)
        const targetPt = {
          x: Math.round(nearestPlayer.x),
          y: Math.round(nearestPlayer.y),
        }
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 10,
          at: targetPt,
          lifePct: 128,
        })
        this.broadcastToArea(monster.areaId, {
          type: 'SkillCast',
          caster: { unitType: 1, id: monster.unitId },
          skill: 87,
          skillId: 87,
          level: 5,
          target: { unitType: 0, id: nearestPlayer.unitId },
          at: targetPt,
        })
      } else if (monster.mode !== 1) {
        monster.mode = 1
      }
      return
    }

    if (
      monster.baalThroneTimerFrame > 0 &&
      this.currentFrame < monster.baalThroneTimerFrame
    ) {
      return
    }

    const bx = Math.round(monster.x)
    const by = Math.round(monster.y)

    if ((monster.baalThroneFlags & 1) === 0) {
      const waveDef = BAAL_THRONE_WAVES_113C[monster.baalThroneWave]
      if (waveDef !== undefined) {
        this.broadcastToArea(monster.areaId, {
          type: 'MonsterSpecial',
          classId: waveDef.leaderHcIdx,
        })
        if (waveDef.minionHcIdx !== waveDef.leaderHcIdx) {
          this.broadcastToArea(monster.areaId, {
            type: 'MonsterSpecial',
            classId: waveDef.minionHcIdx,
          })
        }
        if (waveDef.extraMinionHcIdx !== undefined) {
          this.broadcastToArea(monster.areaId, {
            type: 'MonsterSpecial',
            classId: waveDef.extraMinionHcIdx,
          })
        }
      }

      for (const corpse of this.monsters.values()) {
        if (
          corpse.unitId === monster.unitId ||
          !corpse.dead ||
          corpse.shattered ||
          corpse.areaId !== monster.areaId ||
          corpse.states.has(104)
        ) {
          continue
        }
        if (Math.hypot(corpse.x - monster.x, corpse.y - monster.y) <= 40) {
          corpse.states.add(104)
          corpse.shattered = true
          this.broadcastToArea(monster.areaId, {
            type: 'StateSet',
            unit: { unitType: 1, id: corpse.unitId },
            state: 104,
            origin: 0xa7,
          })
        }
      }

      monster.mode = 10
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 10,
        at: { x: bx, y: by },
        lifePct: 128,
      })
      this.broadcastToArea(monster.areaId, {
        type: 'SkillCast',
        caster: { unitType: 1, id: monster.unitId },
        skill: 285,
        skillId: 285,
        level: 1,
        target: { x: bx, y: by },
        at: { x: bx, y: by },
      })
      this.broadcastToArea(monster.areaId, {
        type: 'PlaySound',
        unit: { unitType: 1, id: monster.unitId },
        sound: 16,
      })
      monster.baalThroneFlags |= 1
      monster.baalThroneTimerFrame = this.currentFrame + 250
      return
    }

    if (monster.baalThroneWave < 5) {
      const spawnX = bx
      const spawnY = by + 13
      monster.mode = 10
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 10,
        at: { x: spawnX, y: spawnY },
        lifePct: 128,
      })
      this.broadcastToArea(monster.areaId, {
        type: 'SkillCast',
        caster: { unitType: 1, id: monster.unitId },
        skill: 286,
        skillId: 286,
        level: 1,
        target: { x: spawnX, y: spawnY },
        at: { x: spawnX, y: spawnY },
      })
      this.broadcastToArea(monster.areaId, {
        type: 'CreateMissile',
        missileId: this.allocateUnitId(),
        missileClassId: 550,
        at: { x: bx, y: by },
        target: { x: spawnX, y: spawnY },
        x: bx,
        y: by,
        targetX: spawnX,
        targetY: spawnY,
        skillId: 286,
        level: 1,
        owner: { unitType: 1, id: monster.unitId },
        ownerType: 'monster',
        ownerId: monster.unitId,
        areaId: monster.areaId,
      })
      monster.pendingBaalWaveSpawn = {
        frame: this.currentFrame + 17,
        superUniqueIndex: 61 + monster.baalThroneWave,
        x: spawnX,
        y: spawnY,
      }
      monster.baalThroneWave += 1
      monster.baalThroneTimerFrame = this.currentFrame + 100
      monster.baalThroneFlags = (monster.baalThroneFlags | 2) & ~1
      return
    }

    // All 5 waves defeated (`0x6FCC864F..0x6FCC86C5`): transform in-place into #559 `baalcrabstairs`.
    monster.classId = 559
    monster.hcIdx = 559
    monster.defId = 'baalcrabstairs'
    monster.ai = 'BaalToStairs'
    monster.mode = 1
    monster.states.add(142)
    this.broadcastToArea(monster.areaId, {
      type: 'StateSet',
      unit: { unitType: 1, id: monster.unitId },
      state: 142,
      stats: [{ statId: 355, param: 0, value: 559 }],
      origin: 0xa8,
      complete: true,
    })
    monster.nextAiFrame = this.currentFrame + 5
  }

  /**
   * `AITHINK_Fn138_BaalToStairs` (`D2Game.dll` `0x6FCC8350`, `MonStats.txt` `#559` `baalcrabstairs`):
   * Walks toward `Objects.txt` `#563` (`Baals Portal`), activates the portal to Worldstone Chamber (`areaId = 132`),
   * advances `a5q6` (`Eve of Destruction`), emits Baal's final laugh (`PlaySound` `16`), and removes the unit.
   */
  private stepBaalToStairsAi(monster: InternalMonsterRecord): void {
    const portal = [...this.objects.values()].find(
      (obj) => obj.areaId === monster.areaId && obj.classId === 563,
    )
    if (
      portal !== undefined &&
      Math.hypot(portal.x - monster.x, portal.y - monster.y) > 2.5
    ) {
      this.moveMonsterToward(monster, portal.x, portal.y, false)
      return
    }
    if (portal !== undefined) {
      portal.destAreaId = 132
      this.setObjectMode(portal, 2)
    }
    for (const player of this.players.values()) {
      if (player.areaId === monster.areaId) {
        this.setPlayerQuestFlag(player, 'a5q6', QUEST_FLAG_STARTED_113C)
      }
    }
    this.broadcastToArea(monster.areaId, {
      type: 'PlaySound',
      unit: { unitType: 1, id: monster.unitId },
      sound: 16,
    })
    this.monsters.delete(monster.unitId)
    this.broadcastToArea(monster.areaId, {
      type: 'UnitRemove',
      unitType: 'monster',
      id: monster.unitId,
      unitId: monster.unitId,
      areaId: monster.areaId,
    })
  }

  private stepMonsterAi(monster: InternalMonsterRecord): void {
    if (
      monster.pendingBaalWaveSpawn !== undefined &&
      this.currentFrame >= monster.pendingBaalWaveSpawn.frame
    ) {
      const pending = monster.pendingBaalWaveSpawn
      monster.pendingBaalWaveSpawn = undefined
      this.spawnSuperUnique({
        superUniqueIndex: pending.superUniqueIndex,
        x: pending.x,
        y: pending.y,
        areaId: monster.areaId,
      })
    }
    if (monster.cooldown > 0) {
      monster.cooldown--
    }
    if (monster.skillCooldown > 0) {
      monster.skillCooldown--
    }
    if (monster.auraSkillId !== undefined) {
      this.applyMonsterAura(monster)
    }
    // GetHit animation lock: the monster may not start a new action while the
    // GH animation plays (1.13c AnimData `GH`).
    if (this.currentFrame < monster.hitRecoveryUntilFrame) {
      return
    }
    const isConverted = this.isMonsterConverted(monster)
    const aiProfile = monsterProfile113c(monster.ai)
    const aiBehavior = aiProfile.family
    // MonStats `aidel` is the AI think interval (aip1..8 carry behavior-specific values).
    const aiInterval = Math.max(1, Math.round(monster.aiDelay || 15))
    const thinkDue = this.currentFrame >= monster.nextAiFrame
    if (thinkDue) monster.nextAiFrame = this.currentFrame + aiInterval

    // F11.4: Freeze (1 / 29) or Stun (21 / 25) completely halts monster movement & attack
    if (
      monster.states.has(1) ||
      monster.states.has(29) ||
      monster.states.has(21) ||
      monster.states.has(25) ||
      monster.frozenTicks > 0
    ) {
      monster.pendingAttack = undefined
      monster.pendingAllyAttack = undefined
      monster.pendingResurrection = undefined
      // Frozen / stunned units hold the neutral animation frame; broadcast the mode
      // transition once so clients stop the previous attack or walk clip.
      if (monster.mode !== 1) {
        monster.mode = 1
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 1,
          lifePct:
            monster.maxHp > 0
              ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128))
              : 0,
        })
      }
      monster.path = []
      monster.pathIndex = 0
      monster.pathTargetX = Number.NaN
      monster.pathTargetY = Number.NaN
      return
    }

    // Frame-based timers advance every tick, even between AI think frames.
    if (monster.fleeTicks > 0) {
      monster.fleeTicks--
      if (monster.fleeTicks === 0) {
        monster.fleeTargetX = Number.NaN
        monster.fleeTargetY = Number.NaN
      }
    } else if (!monster.states.has(56)) {
      monster.fleeTargetX = Number.NaN
      monster.fleeTargetY = Number.NaN
    }
    if (monster.wanderCooldown > 0) monster.wanderCooldown--

    // 1.13c `dwNextAiFrame`: only re-run the decision state machine every
    // `aidel` frames. Movement along the already-chosen path stays continuous.
    if (!thinkDue) {
      if (
        monster.path.length > 0 &&
        Number.isFinite(monster.pathTargetX) &&
        Number.isFinite(monster.pathTargetY)
      ) {
        this.moveMonsterToward(
          monster,
          monster.pathTargetX,
          monster.pathTargetY,
          monster.pathRunning,
        )
      }
      return
    }

    if (monster.ai === 'BaalThrone') {
      this.stepBaalThroneAi(monster)
      return
    }
    if (monster.ai === 'BaalToStairs') {
      this.stepBaalToStairsAi(monster)
      return
    }

    // Chill/Decrepify/Holy Freeze slow movement by their 1.13c percentages.
    const isSlowed = this.monsterSlowPercent(monster) > 0

    // Terror (56) or pack morale fleeTicks causes non-boss monsters to flee away from player (overridden by Taunt 27)
    const isBossOrUnique =
      monster.isBoss || monster.isPrimeEvil || monster.rank === 'unique'
    const hasTaunt = !isBossOrUnique && monster.states.has(27)
    if (hasTaunt && monster.fleeTicks > 0) {
      monster.fleeTicks = 0
      monster.fleeTargetX = Number.NaN
      monster.fleeTargetY = Number.NaN
    }
    const isTerrified =
      !isBossOrUnique &&
      !hasTaunt &&
      (monster.states.has(56) || monster.fleeTicks > 0)

    if (isTerrified) {
      let nearestPlayer: InternalPlayerRecord | undefined
      let minPlayerDist = Infinity
      for (const p of this.players.values()) {
        if (p.dead || p.areaId !== monster.areaId) continue
        const d = Math.hypot(p.x - monster.x, p.y - monster.y)
        if (d < minPlayerDist) {
          minPlayerDist = d
          nearestPlayer = p
        }
      }
      if (nearestPlayer) {
        const targetValid =
          Number.isFinite(monster.fleeTargetX) &&
          Number.isFinite(monster.fleeTargetY) &&
          Math.hypot(monster.fleeTargetX - monster.x, monster.fleeTargetY - monster.y) > 1
        if (!targetValid) {
          const dx = monster.x - nearestPlayer.x
          const dy = monster.y - nearestPlayer.y
          const dist = Math.hypot(dx, dy) || 1
          // 1.13c fear uses the path finder, not a straight-line shove: pick the
          // first walkable point roughly away from the player so walls are routed around.
          const baseAngle = Math.atan2(dy, dx)
          let fleeX = monster.x + (dx / dist) * 8
          let fleeY = monster.y + (dy / dist) * 8
          for (const offset of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6]) {
            const cx = monster.x + Math.cos(baseAngle + offset) * 8
            const cy = monster.y + Math.sin(baseAngle + offset) * 8
            if (
              !this.isClosedDoorAt(monster.areaId, Math.round(cx), Math.round(cy)) &&
              (!this.terrainWalkableCheck ||
                this.terrainWalkableCheck(
                  monster.areaId,
                  Math.round(cx),
                  Math.round(cy),
                  monster.isFlying,
                ))
            ) {
              fleeX = cx
              fleeY = cy
              break
            }
          }
          monster.fleeTargetX = fleeX
          monster.fleeTargetY = fleeY
        }
        this.moveMonsterToward(
          monster,
          monster.fleeTargetX,
          monster.fleeTargetY,
          true,
        )
      }
      return
    }

    // Conversion (53), Confuse (59), or nearby Attract (57) monster-vs-monster targeting.
    // Converted monsters fight for the caster and ignore players; normal monsters
    // treat converted ones as their new enemies.
    let monsterTarget: InternalMonsterRecord | undefined
    if (isConverted) {
      let bestMDist = 40
      for (const other of this.monsters.values()) {
        if (
          other.unitId === monster.unitId ||
          other.dead ||
          other.isNpc ||
          other.areaId !== monster.areaId ||
          this.isMonsterConverted(other)
        ) {
          continue
        }
        const d = Math.hypot(other.x - monster.x, other.y - monster.y)
        if (d < bestMDist) {
          bestMDist = d
          monsterTarget = other
        }
      }
    } else if (!isBossOrUnique && !hasTaunt && monster.states.has(59)) {
      let bestMDist = Infinity
      for (const other of this.monsters.values()) {
        if (
          other.unitId === monster.unitId ||
          other.dead ||
          other.isNpc ||
          other.areaId !== monster.areaId ||
          this.isMonsterConverted(other)
        ) {
          continue
        }
        const d = Math.hypot(other.x - monster.x, other.y - monster.y)
        if (d < bestMDist) {
          bestMDist = d
          monsterTarget = other
        }
      }
    } else if (!isBossOrUnique && !hasTaunt) {
      // Attract is a curse on the target; nearby monsters engage it within their own
      // MonStats `aidist`-derived aggro radius (not a hardcoded 20).
      let bestAttractDist = Math.max(1, monster.aggroRadius)
      for (const other of this.monsters.values()) {
        if (
          other.unitId === monster.unitId ||
          other.dead ||
          other.isNpc ||
          other.areaId !== monster.areaId
        ) {
          continue
        }
        const converted = this.isMonsterConverted(other)
        const attracted = other.states.has(57)
        if (!converted && !attracted) continue
        const d = Math.hypot(other.x - monster.x, other.y - monster.y)
        if (d < bestAttractDist) {
          bestAttractDist = d
          monsterTarget = other
        }
      }
    }

    const hasDimVision = !isBossOrUnique && monster.states.has(23)

    if (monsterTarget) {
      const mDist = Math.hypot(
        monsterTarget.x - monster.x,
        monsterTarget.y - monster.y,
      )
      // Confused/converted/attracted casters and archers keep their ranged Skill1..8
      // and MissA1/A2/S1/C attacks against the hostile monster instead of walking into melee.
      if (
        !hasDimVision &&
        !hasTaunt &&
        mDist > 2.5 &&
        this.tryCastMonsterSkill(monster, monsterTarget, mDist, { hitMonsters: true })
      ) {
        return
      }
      const preferredShootMode: 'S1' | 'A2' | 'A1' =
        monster.modeMissiles?.S1 !== undefined && monster.maxDmg <= 1
          ? 'S1'
          : monster.modeMissiles?.A2 !== undefined &&
              monster.hasAttack2 &&
              this.rng.rand(2) === 0
            ? 'A2'
            : 'A1'
      const selectedShootMode: 'A1' | 'A2' | 'S1' | 'C' =
        monster.modeMissiles?.[preferredShootMode] !== undefined
          ? preferredShootMode
          : monster.modeMissiles?.S1 !== undefined
            ? 'S1'
            : monster.modeMissiles?.A2 !== undefined
              ? 'A2'
              : monster.modeMissiles?.A1 !== undefined
                ? 'A1'
                : 'C'
      const monsterShootMissile = monster.modeMissiles?.[selectedShootMode]
      if (
        (monster.isRanged || aiBehavior === 'ranged' || aiBehavior === 'kiter') &&
        !hasDimVision &&
        !hasTaunt &&
        monsterShootMissile !== undefined &&
        mDist > 2.5 &&
        mDist <= monsterShootRange(monster) &&
        monster.cooldown <= 0
      ) {
        const missileRec = this.registry.getMissileByName(monsterShootMissile)
        if (missileRec !== undefined) {
          const attackMode = this.monsterSkillMode(selectedShootMode)
          monster.cooldown = monster.cooldownTicks
          monster.mode = attackMode
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: attackMode,
            at: { x: Math.round(monsterTarget.x), y: Math.round(monsterTarget.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          const mslDmg = Math.max(
            2,
            this.rollInclusive(monster.minDmg, monster.maxDmg),
          )
          const element = normalizeMissileElement(missileRec.eType) ?? 'phys'
          this.spawnMonsterMissile(
            monster,
            monsterTarget.x,
            monsterTarget.y,
            mslDmg,
            missileRec.id,
            0,
            {
              missile: missileRec,
              skillLevel: monster.level,
              hitMonsters: true,
              ...(element === 'phys'
                ? { physDamage: mslDmg }
                : { elemDamage: mslDmg, element }),
            },
          )
          return
        }
      }
      if (mDist <= 2.5) {
        if (monster.cooldown <= 0) {
          monster.cooldown = monster.cooldownTicks
          this.attackMonsterTarget(monster, monsterTarget)
        }
      } else {
        this.moveMonsterToward(monster, monsterTarget.x, monsterTarget.y, mDist > 5)
      }
      return
    }

    // Converted monsters never fall through to the player-hostile path.
    if (isConverted) return

    // F11.5: Shaman / Greater Mummy resurrection of non-shattered corpses. The skill is
    // `MonStats.txt Skill1..8` (`Resurrect` 181 / `Resurrect2` 327), the cadence comes from
    // `aip1`, and the search radius comes from the row's `resurrectRangeParam` (`aip4` on
    // FallenShaman, `aip5` on GreaterMummy / FetishShaman).
    if (
      !hasTaunt &&
      monster.resurrectSkillId !== undefined &&
      monster.cooldown <= 0
    ) {
      const configuredRange =
        aiProfile.resurrectRangeParam !== undefined
          ? monaiParam113c(aiProfile, monster.aiParams, aiProfile.resurrectRangeParam, 0)
          : 0
      const resurrectRange = Math.max(
        1,
        Math.floor(configuredRange || monster.aiParams[3] || monster.aiParams[4] || 15),
      )
      for (const corpse of this.monsters.values()) {
        if (
          !corpse.dead ||
          corpse.shattered ||
          corpse.isBoss ||
          corpse.isPrimeEvil ||
          corpse.isNpc ||
          corpse.areaId !== monster.areaId
        ) {
          continue
        }
        // 1.13c race rules (`D2Game.dll` `0x6fc9bd50` / `0x6fc9bb90` / `0x6fc9b8e0`):
        // Fallen/Fetish shamans raise their own MonType; Greater Mummies ("raises undead")
        // raise undead allies (non-Radament unravelers cannot raise other unravelers).
        const isGreaterMummy =
          monster.monType === 'unraveler' || monster.ai === 'GreaterMummy'
        const sameRace =
          !isGreaterMummy && corpse.monType === monster.monType
        const raisesUndead =
          (isGreaterMummy || monster.resurrectSkillId === 158) &&
          corpse.isUndead &&
          (monster.hcIdx === 229 || corpse.monType !== 'unraveler')
        if (!sameRace && !raisesUndead) continue
        if (Math.hypot(corpse.x - monster.x, corpse.y - monster.y) > resurrectRange) {
          continue
        }
        monster.cooldown = Math.max(
          aiInterval,
          Math.floor(monster.aiParams[0] || aiInterval),
        )
        monster.mode = 8
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: 8,
          at: { x: Math.round(corpse.x), y: Math.round(corpse.y) },
          lifePct:
            monster.maxHp > 0
              ? Math.round((monster.hp / monster.maxHp) * 128)
              : 0,
        })
        monster.pendingResurrection = {
          corpseUnitId: corpse.unitId,
          frame: this.currentFrame + 6,
        }
        return
      }
    }

    const effectiveAggro = hasDimVision && !hasTaunt ? 3.5 : monster.aggroRadius

    let nearest = this.nearestHostileForMonster(monster, effectiveAggro)
    // Being attacked pulls the monster's attention even when the attacker is
    // outside its normal `aidist` (1.13c last-attacker threat), without
    // overriding a closer visible hostile (such as a mercenary or summon in melee).
    if (!nearest && this.currentFrame <= monster.threatUntilFrame) {
      const threat = this.players.get(monster.threatPlayerId)
      if (
        threat !== undefined &&
        !threat.dead &&
        this.isAreaSeamAdjacent(monster.areaId, threat.areaId) &&
        Math.hypot(threat.x - monster.x, threat.y - monster.y) <=
          Math.max(effectiveAggro, MONSTER_ACTIVATION_RADIUS_SUBTILES)
      ) {
        nearest = { kind: 'player', x: threat.x, y: threat.y, player: threat }
      }
    }
    if (!nearest) {
      // Return to the DRLG spawn anchor when pulled too far away.
      if (Math.hypot(monster.homeX - monster.x, monster.homeY - monster.y) > 12) {
        this.moveMonsterToward(monster, monster.homeX, monster.homeY, false)
        monster.wanderTargetX = Number.NaN
        monster.wanderTargetY = Number.NaN
        return
      }
      // 1.13c idle AI: stationary rows stay put, others wander a few sub-tiles
      // around their spawn anchor between fights.
      if (aiBehavior === 'stationary') return
      if (
        Number.isFinite(monster.wanderTargetX) &&
        Number.isFinite(monster.wanderTargetY)
      ) {
        const remaining = Math.hypot(
          monster.wanderTargetX - monster.x,
          monster.wanderTargetY - monster.y,
        )
        if (remaining > 0.75) {
          this.moveMonsterToward(
            monster,
            monster.wanderTargetX,
            monster.wanderTargetY,
            false,
          )
          return
        }
        monster.wanderTargetX = Number.NaN
        monster.wanderTargetY = Number.NaN
        monster.wanderCooldown = 60 + this.rng.rand(90)
      }
      if (monster.wanderCooldown <= 0) {
        const angle = (this.rng.rand(360) * Math.PI) / 180
        const radius = 1 + this.rng.rand(4)
        const tx = monster.homeX + Math.cos(angle) * radius
        const ty = monster.homeY + Math.sin(angle) * radius
        if (
          !this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) &&
          (!this.terrainWalkableCheck ||
            this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), monster.isFlying))
        ) {
          monster.wanderTargetX = tx
          monster.wanderTargetY = ty
          monster.wanderCooldown = 45 + this.rng.rand(60)
        } else {
          monster.wanderCooldown = 20 + this.rng.rand(40)
        }
      }
      return
    }
    const woundedPct = monaiParam113c(
      aiProfile,
      monster.aiParams,
      aiProfile.woundedTargetParam,
      -1,
    )
    if (woundedPct >= 0 && nearest.kind === 'player') {
      const nearestHpPct =
        nearest.player.maxHpFixed > 0
          ? (nearest.player.hpFixed / nearest.player.maxHpFixed) * 100
          : 100
      if (nearestHpPct > woundedPct) {
        for (const candidate of this.players.values()) {
          if (candidate.dead || candidate.areaId !== monster.areaId) continue
          const hpPct =
            candidate.maxHpFixed > 0
              ? (candidate.hpFixed / candidate.maxHpFixed) * 100
              : 100
          if (hpPct > woundedPct) continue
          if (Math.hypot(candidate.x - monster.x, candidate.y - monster.y) > effectiveAggro) {
            continue
          }
          nearest = {
            kind: 'player',
            x: candidate.x,
            y: candidate.y,
            player: candidate,
          }
          break
        }
      }
    }
    const bestDist = Math.hypot(nearest.x - monster.x, nearest.y - monster.y)

    // MonAi charge rows (SandRaider row 8, ClawViper 16/142, BloodHawk 5,
    // ReanimatedHorde 114, SiegeBeast 115, Duriel 44): a burst from mid range.
    // The row's descriptor owns min/max distance and which `aip` slot paces it.
    const charge = aiProfile.charge
    if (
      charge !== undefined &&
      bestDist > charge.minDistance &&
      bestDist <= charge.maxDistance &&
      monster.cooldown <= 0 &&
      !isSlowed
    ) {
      const chargeDelay = Math.max(
        1,
        Math.floor(
          charge.fixedDelayFrames ??
            monaiParam113c(aiProfile, monster.aiParams, charge.delayParam, monster.cooldownTicks * 2),
        ),
      )
      monster.cooldown = chargeDelay
      const bursts = Math.max(1, Math.round(charge.speedMultiplier ?? 2))
      for (let i = 0; i < bursts; i += 1) {
        this.moveMonsterToward(monster, nearest.x, nearest.y, true)
      }
      return
    }
    // SandLeaper row 17: leap at the target from outside melee range.
    const leap = aiProfile.leap
    if (
      leap !== undefined &&
      bestDist > leap.minDistance &&
      bestDist <= leap.maxDistance &&
      monster.cooldown <= 0 &&
      !isSlowed
    ) {
      monster.cooldown = Math.max(
        1,
        Math.floor(
          leap.fixedDelayFrames ??
            monaiParam113c(aiProfile, monster.aiParams, leap.delayParam, monster.cooldownTicks * 3),
        ),
      )
      const bursts = Math.max(1, Math.round(leap.speedMultiplier ?? 2))
      for (let i = 0; i < bursts; i += 1) {
        this.moveMonsterToward(monster, nearest.x, nearest.y, true)
      }
      return
    }
    // Archers/vampires/finger mages back away when the player closes in.
    const kiteDistance = Math.max(
      2,
      monaiParam113c(aiProfile, monster.aiParams, aiProfile.kiteDistanceParam, 4),
    )
    if (aiBehavior === 'kiter' && bestDist < kiteDistance) {
      // A retreating caster still gets its Sk*Mode curse/utility cast.
      if (
        !hasDimVision &&
        !hasTaunt &&
        this.tryCastMonsterSkill(monster, nearest, bestDist)
      ) {
        return
      }
      const dx = monster.x - nearest.x
      const dy = monster.y - nearest.y
      const dist = Math.max(0.5, Math.hypot(dx, dy))
      this.moveMonsterToward(
        monster,
        monster.x + (dx / dist) * 4,
        monster.y + (dy / dist) * 4,
        true,
      )
      return
    }

    // MonAi hurt-retreat rows (Arach row 26: aip5 hurt %, aip4 run distance).
    const hurtRetreat = aiProfile.hurtRetreat
    if (hurtRetreat !== undefined) {
      const hurtPct = Math.max(
        0,
        Math.min(100, monaiParam113c(aiProfile, monster.aiParams, hurtRetreat.hurtParam, 0)),
      )
      const runDist = Math.max(
        1,
        monaiParam113c(aiProfile, monster.aiParams, hurtRetreat.distanceParam, 8),
      )
      const hpPct = monster.maxHp > 0 ? (monster.hp / monster.maxHp) * 100 : 100
      if (hurtPct > 0 && hpPct <= hurtPct && bestDist < runDist) {
        const dx = monster.x - nearest.x
        const dy = monster.y - nearest.y
        const dist = Math.max(0.5, Math.hypot(dx, dy))
        this.moveMonsterToward(
          monster,
          monster.x + (dx / dist) * 4,
          monster.y + (dy / dist) * 4,
          true,
        )
        return
      }
    }

    // F11.5: Oblivion Knight 1.13c 5-curse pool (Decrepify 60, Amplify Damage 9, Lower Resist 61, Life Tap 58, Weaken 19 — no Iron Maiden 55 in 1.13c)
    if (
      !hasDimVision &&
      !hasTaunt &&
      aiProfile.curse
    ) {
      const curseIds = [60, 9, 61, 58, 19] as const
      const curseId =
        curseIds[
          ((this.currentFrame >>> 0) + monster.unitId) % curseIds.length
        ]!
      monster.mode = 8
      this.broadcastToArea(monster.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: monster.unitId,
        mode: 8,
        at: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
        lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
      })
      if (nearest.kind === 'player') {
        this.applyUnitState(
          nearest.player.states,
          nearest.player.stateTimers,
          'player',
          nearest.player.unitId,
          nearest.player.areaId,
          curseId,
          100,
        )
      }
    }

    // MonStats `Skill1..8`: cast a data-driven projectile skill (ShamanFire,
    // ZakarumLightning, PrimeLightning, DoomKnightMissile, ...) before the plain
    // `MissA1/A2/S1/C` attack. The action mode comes from the MonStats `Sk*Mode`.
    if (
      !hasDimVision &&
      !hasTaunt &&
      this.tryCastMonsterSkill(monster, nearest, bestDist)
    ) {
      return
    }

    // 1.13c spawner AIs (VileMother/FoulCrowNest/SandMaggotQueen/MosquitoNest)
    // periodically create their child monster while a hostile is in range.
    if (aiProfile.spawn !== undefined && bestDist <= 30 && monster.cooldown <= 0) {
      const spawn = aiProfile.spawn
      const maxChildren = Math.max(
        0,
        Math.floor(monaiParam113c(aiProfile, monster.aiParams, spawn.maxParam, 4)),
      )
      if (monster.spawnedChildren < maxChildren) {
        const batch = Math.min(
          maxChildren - monster.spawnedChildren,
          Math.max(
            1,
            Math.floor(monaiParam113c(aiProfile, monster.aiParams, spawn.batchParam, 1)),
          ),
        )
        const interval = Math.max(
          1,
          Math.floor(monaiParam113c(aiProfile, monster.aiParams, spawn.intervalParam, 125)),
        )
        let spawned = 0
        for (let i = 0; i < batch; i += 1) {
          const angle = (this.rng.rand(360) * Math.PI) / 180
          const tx = monster.x + Math.cos(angle) * (1 + this.rng.rand(2))
          const ty = monster.y + Math.sin(angle) * (1 + this.rng.rand(2))
          if (
            this.terrainWalkableCheck &&
            !this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), false)
          ) {
            continue
          }
          this.spawnMonster({
            defId: spawn.child,
            x: tx,
            y: ty,
            areaId: monster.areaId,
            level: monster.level,
          })
          spawned += 1
        }
        if (spawned > 0) {
          monster.spawnedChildren += spawned
          monster.cooldown = interval
          monster.mode = 8
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: 8,
            at: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          return
        }
      }
    }

    // F12.3: Ranged monster missile firing (suppressed when Dim Vision 23 or Taunt 27 is active)
    if (
      (monster.isRanged || aiBehavior === 'ranged') &&
      !hasDimVision &&
      !hasTaunt &&
      bestDist > 2.5 &&
      bestDist <= monsterShootRange(monster) &&
      (monster.cooldown > 0 || monsterCanFireRanged113c(monster, this.rng.rand(100)))
    ) {
      if (monster.cooldown <= 0) {
        // The AI mode picks the MonStats Missiles.txt column: S1 for pure casters,
        // A2 for rows with a secondary attack, otherwise A1. Only fall back to the
        // next declared column when the selected one is empty.
        const preferredMode =
          monster.modeMissiles?.S1 !== undefined && monster.maxDmg <= 1
            ? 'S1'
            : monster.modeMissiles?.A2 !== undefined &&
                monster.hasAttack2 &&
                this.rng.rand(2) === 0
              ? 'A2'
              : 'A1'
        const selectedMode: 'A1' | 'A2' | 'S1' | 'C' =
          monster.modeMissiles?.[preferredMode] !== undefined
            ? preferredMode
            : monster.modeMissiles?.A1 !== undefined
              ? 'A1'
              : monster.modeMissiles?.A2 !== undefined
                ? 'A2'
                : monster.modeMissiles?.S1 !== undefined
                  ? 'S1'
                  : 'C'
        const missileName = monster.modeMissiles?.[selectedMode]
        const missileRec = missileName
          ? this.registry.getMissileByName(missileName)
          : undefined
        // A `rangedtype` row without a Missiles.txt row falls through to melee
        // instead of silently firing missile id 1 (javelin).
        if (missileRec !== undefined) {
          const attackMode = this.monsterSkillMode(selectedMode)
          monster.cooldown = monster.cooldownTicks
          monster.mode = attackMode
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: attackMode,
            at: { x: Math.round(nearest.x), y: Math.round(nearest.y) },
            lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          // `resolveMonsterAttackOnPlayer` applies `monsterAuraDamageBonusPct` to
          // the projectile packet, so roll the raw MonStats band here.
          const mslDmg = Math.max(
            2,
            monster.minDmg +
              this.rng.rand(Math.max(0, monster.maxDmg - monster.minDmg) + 1),
          )
          const element = normalizeMissileElement(missileRec.eType) ?? 'phys'
          // MonUMod 29 `multishot`: three bolts in a shallow fan.
          const offsets = monster.umodIds.includes(MON_UMOD.MULTISHOT)
            ? [-0.22, 0, 0.22]
            : [0]
          const baseAngle = Math.atan2(nearest.y - monster.y, nearest.x - monster.x)
          const rangeFrames = Math.max(
            2,
            missileRec.range + missileRec.levRange * Math.max(0, monster.level - 1),
          )
          const missileSpan =
            missileRec.vel > 0 ? (missileRec.vel / 16) * rangeFrames : bestDist
          const aimDist = Math.max(bestDist, missileSpan)
          for (const offset of offsets) {
            const tx =
              offset === 0 ? nearest.x : monster.x + Math.cos(baseAngle + offset) * aimDist
            const ty =
              offset === 0 ? nearest.y : monster.y + Math.sin(baseAngle + offset) * aimDist
            this.spawnMonsterMissile(monster, tx, ty, mslDmg, missileRec.id, 0, {
              missile: missileRec,
              skillLevel: monster.level,
              ...(element === 'phys'
                ? { physDamage: mslDmg }
                : { elemDamage: mslDmg, element }),
            })
          }
          return
        }
      } else {
        return
      }
    }

    if (bestDist <= 2.5) {
      if (aiBehavior === 'suicide') {
        monster.hp = 0
        this.applyMonsterDeath(
          monster,
          nearest.kind === 'player' ? nearest.player : undefined,
          'phys',
        )
        return
      }
      if (
        monster.cooldown <= 0 &&
        monster.pendingAttack === undefined &&
        monster.pendingAllyAttack === undefined
      ) {
        monster.cooldown = monster.cooldownTicks
        if (nearest.kind === 'player') {
          this.beginMonsterMeleeAttack(monster, nearest.player)
        } else if (nearest.kind === 'merc') {
          monster.mode = 4
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: 4,
            at: { x: Math.round(nearest.merc.x), y: Math.round(nearest.merc.y) },
            lifePct:
              monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          this.beginMonsterMeleeAttackOnAlly(monster, {
            kind: 'merc',
            id: nearest.merc.unitId,
          })
        } else {
          monster.mode = 4
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: 4,
            at: { x: Math.round(nearest.pet.x), y: Math.round(nearest.pet.y) },
            lifePct:
              monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
          })
          this.beginMonsterMeleeAttackOnAlly(monster, { kind: 'pet', id: nearest.pet.uid })
        }
      }
    } else if (aiBehavior !== 'stationary') {
      const running = bestDist > 5 && !isSlowed
      this.moveMonsterToward(monster, nearest.x, nearest.y, running)
    }
  }

  applyDamageToPlayer(
    playerUnitIdOrRecord: number | InternalPlayerRecord,
    damage: number,
  ): void {
    const player =
      typeof playerUnitIdOrRecord === 'number'
        ? this.players.get(playerUnitIdOrRecord)
        : playerUnitIdOrRecord
    if (!player || player.dead) return

    const dmgInt = Math.max(1, Math.floor(damage))
    player.hpFixed = Math.max(0, player.hpFixed - dmgInt * FIXED_ONE)
    player.hp = Math.max(0, Math.ceil(player.hpFixed / FIXED_ONE))

    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 6,
      value: player.hpFixed,
    })
    this.emitToPlayer(player.unitId, {
      type: 'LifeMana',
      life: player.hp,
      mana: player.mana,
      stamina: player.stamina,
      at: playerWirePosition(player),
      vx: 0,
      vy: 0,
    })

    if (player.hp <= 0) {
      this.killPlayer(player)
    }
  }

  private killPlayer(player: InternalPlayerRecord): void {
    player.dead = true
    player.activeWaypointUnitId = 0
    player.hp = 0
    player.hpFixed = 0
    player.mode = 17
    const corpseId = this.allocateUnitId()
    player.corpseId = corpseId
    player.corpseX = player.x
    player.corpseY = player.y

    const remainingItems: ServerItemEntry[] = []
    for (const item of player.items) {
      if (item.location === 'equipped') {
        player.corpseItems.push(item)
      } else {
        remainingItems.push(item)
      }
    }
    player.items = remainingItems

    if (player.gold > 0) {
      const lost = Math.max(1, Math.floor(player.gold * 0.1))
      player.gold = Math.max(0, player.gold - lost)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 14,
        value: player.gold,
      })
    }

    this.broadcastToArea(player.areaId, {
      type: 'UnitMode',
      unitType: 0,
      id: player.unitId,
      mode: 17,
      at: playerWirePosition(player),
      lifePct: 0,
    })
    this.broadcastToArea(player.areaId, {
      type: 'CorpseAssign',
      assign: 1,
      ownerId: player.unitId,
      corpseId,
    })
  }

  private handleRespawn(player: InternalPlayerRecord): void {
    if (!player.dead) return
    player.dead = false
    player.hpFixed = player.maxHpFixed
    player.hp = player.maxHp
    player.manaFixed = player.maxManaFixed
    player.mana = player.maxMana
    player.staminaFixed = player.maxStaminaFixed
    player.staminaExhausted = false
    player.stamina = player.maxStamina

    const townArea = ACT_TOWN_AREA[player.act] ?? 1
    player.x = 128
    player.y = 128
    player.targetX = 128
    player.targetY = 128
    player.mode = 5
    this.transitionPlayerArea(player, townArea, { kind: 'respawn' })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 6,
      value: player.hpFixed,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 8,
      value: player.manaFixed,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 10,
      value: player.staminaFixed,
    })
    this.emitToPlayer(player.unitId, {
      type: 'LifeMana',
      life: player.hp,
      mana: player.mana,
      stamina: player.stamina,
      at: playerWirePosition(player),
      vx: 0,
      vy: 0,
    })
  }

  private recoverPlayerCorpse(player: InternalPlayerRecord): void {
    if (player.corpseId === undefined) return
    const oldCorpseId = player.corpseId
    player.corpseId = undefined
    for (const item of player.corpseItems) {
      item.location = 'equipped'
      player.items.push(item)
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'equip',
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: 'equipment',
        item: this.serverEntryToItemData(item),
      })
    }
    player.corpseItems = []
    this.broadcastToArea(player.areaId, {
      type: 'CorpseAssign',
      assign: 0,
      ownerId: player.unitId,
      corpseId: oldCorpseId,
    })
  }

  /** Apply a state without a timer (auras, absorb-limited armors): it lasts until cleared. */
  private applyPersistentUnitState(
    states: Set<number>,
    timers: Map<number, number>,
    unitType: 'player' | 'monster',
    unitId: number,
    areaId: number,
    stateId: number,
  ): void {
    this.applyUnitState(states, timers, unitType, unitId, areaId, stateId, 0)
    timers.delete(stateId)
  }

  /** Remove a state immediately and broadcast its end (`UnitState` off + `StateEnd`). */
  private clearUnitState(
    states: Set<number>,
    timers: Map<number, number>,
    unitType: 'player' | 'monster',
    unitId: number,
    areaId: number,
    stateId: number,
  ): void {
    if (!states.delete(stateId)) return
    timers.delete(stateId)
    this.broadcastToArea(areaId, {
      type: 'UnitState',
      unitType,
      unitId,
      state: stateId,
      active: false,
      areaId,
    })
    this.broadcastToArea(areaId, {
      type: 'StateEnd',
      unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
      state: stateId,
    })
  }

  private applyUnitState(
    states: Set<number>,
    timers: Map<number, number>,
    unitType: 'player' | 'monster',
    unitId: number,
    areaId: number,
    stateId: number,
    durationFrames: number,
  ): void {
    const incomingIsCurse = this.registry.getStateById(stateId)?.curse === true
    if (incomingIsCurse) {
      // 1.13c sub_6FCC00B0 (0x6FCC01C1): STATE_ATTRACT (57) blocks any incoming curse=1 state
      if (states.has(57)) {
        return
      }
      // 1.13c STATLIST_CURSE (0x20) single slot: evict any existing curse=1 state (including shrines 128..137)
      for (const prevStateId of [...states]) {
        if (prevStateId !== stateId && this.registry.getStateById(prevStateId)?.curse === true) {
          states.delete(prevStateId)
          timers.delete(prevStateId)
          if (unitType === 'player') {
            this.playerCombat.get(unitId)?.stateBus.removeState(prevStateId)
          } else {
            this.monsterCombat.get(unitId)?.stateBus.removeState(prevStateId)
          }
          this.broadcastToArea(areaId, {
            type: 'UnitState',
            unitType,
            unitId,
            state: prevStateId,
            active: false,
            areaId,
          })
          this.broadcastToArea(areaId, {
            type: 'StateEnd',
            unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
            state: prevStateId,
          })
        }
      }
    }
    states.add(stateId)
    timers.set(stateId, durationFrames)
    if (
      unitType === 'monster' &&
      (stateId === 1 || stateId === 29 || stateId === 21 || stateId === 25)
    ) {
      const m = this.monsters.get(unitId)
      if (m !== undefined) {
        m.pendingAttack = undefined
        m.pendingAllyAttack = undefined
        m.pendingResurrection = undefined
      }
    }
    this.broadcastToArea(areaId, {
      type: 'UnitState',
      unitType,
      unitId,
      state: stateId,
      active: true,
      areaId,
    })
    this.broadcastToArea(areaId, {
      type: 'StateSet',
      unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
      state: stateId,
      complete: true,
    })
  }

  private stepUnitStates(
    states: Set<number>,
    timers: Map<number, number>,
    unitType: 'player' | 'monster',
    unitId: number,
    areaId: number,
  ): void {
    for (const [stateId, rem] of timers.entries()) {
      if (rem <= 1) {
        timers.delete(stateId)
        states.delete(stateId)
        this.broadcastToArea(areaId, {
          type: 'UnitState',
          unitType,
          unitId,
          state: stateId,
          active: false,
          areaId,
        })
        this.broadcastToArea(areaId, {
          type: 'StateEnd',
          unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
          state: stateId,
        })
      } else {
        timers.set(stateId, rem - 1)
      }
    }
  }

  /** 1.13c `D2Common #10594` object interaction reach (unit size + object footprint). */
  private playerInObjectRange(
    player: InternalPlayerRecord,
    obj: InternalObjectRecord,
  ): boolean {
    return isObjectInInteractRange113c(
      player.x,
      player.y,
      PLAYER_SIZE_X_113C,
      obj.x,
      obj.y,
      obj.classId,
    )
  }

  /** 1.13c `D2Common #10407` NPC reach (deferred 0x13 arrival: <= 2). */
  private playerInNpcRange(
    player: InternalPlayerRecord,
    npc: InternalMonsterRecord,
  ): boolean {
    return (
      D2Common_10399_AtSubtiles(
        Math.floor(npc.x),
        Math.floor(npc.y),
        npc.sizeX,
        Math.round(player.x),
        Math.round(player.y),
        PLAYER_SIZE_X_113C,
      ) <= NPC_INTERACT_DISTANCE_SUBTILES
    )
  }

  /** 500 ms warp/portal click cooldown (`[0x6fbc9828]`, 25 ticks/s). */
  private consumeWarpCooldown(player: InternalPlayerRecord): boolean {
    if (
      this.currentFrame - player.lastWarpInteractFrame <
      WARP_INTERACT_COOLDOWN_FRAMES
    ) {
      return false
    }
    player.lastWarpInteractFrame = this.currentFrame
    return true
  }

  /** Shrines.txt `Duration in frames`; resist/experience last 3600, the rest 2400. */
  private static readonly SHRINE_DURATION_FRAMES_113C: Readonly<Record<number, number>> = {
    6: 2400, 7: 2400, 8: 3600, 9: 3600, 10: 3600, 11: 3600,
    12: 2400, 13: 2400, 14: 2400, 15: 3600,
  }
  /** Shrines.txt `ResetTime` (5 minutes at 25 Hz). */
  private static readonly SHRINE_RESET_FRAMES_113C = 5 * 1200 + 1

  /** 1.13c Shrines.txt `Code` 6..15 -> `States.txt` shrine state id. */
  private static readonly SHRINE_CODE_TO_STATE_113C: Readonly<Record<number, number>> = {
    6: 128, // armor
    7: 129, // combat
    8: 131, // resist fire
    9: 132, // resist cold
    10: 130, // resist lightning
    11: 133, // resist poison
    12: 134, // skill
    13: 135, // mana regen
    14: 136, // stamina
    15: 137, // experience
  }

  private emitPlayerVitals(player: InternalPlayerRecord): void {
    this.emitToPlayer(player.unitId, {
      type: 'LifeMana',
      life: player.hp,
      mana: player.mana,
      stamina: player.stamina,
      at: playerWirePosition(player),
      vx: 0,
      vy: 0,
    })
  }

  private setObjectMode(obj: InternalObjectRecord, mode: number): void {
    if (obj.mode === mode) return
    obj.mode = mode
    this.broadcastToArea(obj.areaId, {
      type: 'UnitMode',
      unitType: 2,
      id: obj.unitId,
      mode,
    })
  }

  /** 1.13c Shrines.txt effects (Code 0..22), one use per shrine. */
  private applyShrineEffect(
    player: InternalPlayerRecord,
    code: number,
    shrineUnitId = 0,
  ): void {
    const stateId = GameInstance.SHRINE_CODE_TO_STATE_113C[code]
    if (stateId !== undefined) {
      const duration = GameInstance.SHRINE_DURATION_FRAMES_113C[code] ?? 2400
      this.applyUnitState(
        player.states,
        player.stateTimers,
        'player',
        player.unitId,
        player.areaId,
        stateId,
        duration,
      )
      const stats =
        code === 6
          ? { item_armor_percent: 100 }
          : code === 7
            ? { item_tohit_percent: 200, item_damage_percent: 200 }
            : code === 8
              ? { fireresist: 75 }
              : code === 9
                ? { coldresist: 75 }
                : code === 10
                  ? { lightresist: 75 }
                  : code === 11
                    ? { poisonresist: 75 }
                    : code === 12
                      ? { item_allskills: 2 }
                      : code === 13
                        ? { manaregeneration: 400 }
                        : code === 14
                          ? { item_staminadrainpct: -100 }
                          : code === 15
                            ? { item_addexperience: 50 }
                            : undefined
      if (stats !== undefined) {
        this.playerCombatContext(player).stateBus.applyState({
          stateNameOrId: stateId,
          sourceSkillId: 0,
          slvl: 1,
          durationFrames: duration,
          stats,
        })
      }
      return
    }
    switch (code) {
      case 1: // Refilling Shrine
      case 16: // Enirhs Shrine
        player.hpFixed = player.maxHpFixed
        player.hp = player.maxHp
        player.manaFixed = player.maxManaFixed
        player.mana = player.maxMana
        player.staminaFixed = player.maxStaminaFixed
        player.staminaExhausted = false
        player.stamina = player.maxStamina
        this.emitPlayerVitals(player)
        break
      case 2: // Health Shrine: restores half of max life
        player.hpFixed = Math.min(player.maxHpFixed, player.hpFixed + Math.floor(player.maxHpFixed / 2))
        player.hp = Math.ceil(player.hpFixed / FIXED_ONE)
        this.emitPlayerVitals(player)
        break
      case 3: // Mana Shrine: fully restores mana
        player.manaFixed = player.maxManaFixed
        player.mana = player.maxMana
        this.emitPlayerVitals(player)
        break
      case 4: // Health Exchange: swap current life and mana
      case 5: { // Mana Exchange
        const hp = player.hpFixed
        const mana = player.manaFixed
        player.hpFixed = Math.min(player.maxHpFixed, mana)
        player.manaFixed = Math.min(player.maxManaFixed, hp)
        player.hp = Math.ceil(player.hpFixed / FIXED_ONE)
        player.mana = Math.floor(player.manaFixed / FIXED_ONE)
        this.emitPlayerVitals(player)
        break
      }
      case 17: // Portal Shrine: a public pair, never the player's personal portal
        this.openTownPortal(player, false, -Math.max(1, shrineUnitId), 'Shrine')
        break
      case 18: { // Gem Shrine: upgrade one carried gem one tier
        const gem = player.items.find(
          (item) => item.location === 'inventory' && GEM_INFO[item.code.toLowerCase()] !== undefined,
        )
        const info = gem === undefined ? undefined : GEM_INFO[gem.code.toLowerCase()]
        const next =
          info === undefined
            ? undefined
            : Object.values(GEM_INFO).find(
                (candidate) =>
                  candidate.gemType === info.gemType && candidate.tier === info.tier + 1,
              )
        if (gem !== undefined && next !== undefined) {
          gem.code = next.code
          gem.name = next.nameEn
          gem.rawItemData = {
            ...gem.rawItemData,
            code: next.code,
            rawCode: next.code,
          } as typeof gem.rawItemData
          this.emitToPlayer(player.unitId, {
            type: 'ItemEvent',
            action: 'update',
            itemId: gem.unitId,
            code: gem.code,
            container: 'inventory',
            item: this.serverEntryToItemData(gem),
          })
        } else {
          // 1.13c SHRINES_Gem: no upgradeable gem -> drop one random chipped gem.
          const chipped = ['gcv', 'gcr', 'gcg', 'gcb', 'gcy', 'gcw'][this.rng.rand(6)]!
          const tables = getEmbeddedDropTables()
          const base = tables.getBase(chipped)
          if (base !== undefined) {
            const seed = this.rng.rand(0x7fffffff) >>> 0
            const item = createDroppedItem(base, 'normal', {
              itemTypes: tables.itemTypes,
              ilvl: 1,
              dwInitSeed: seed,
              itemRng: new D2Rng(seed || 1),
            })
            this.spawnDroppedItems([item], player.areaId, player.x, player.y)
          }
        }
        break
      }
      case 19: // Fire Shrine
      case 21: // Exploding Shrine
        this.applyDamageToPlayer(player, Math.max(1, Math.floor(player.maxHp * 0.15)))
        break
      case 20: // Monster Shrine
        this.spawnMonster({
          defId: 'fallen1',
          x: player.x + 2,
          y: player.y,
          areaId: player.areaId,
        })
        break
      case 22: // Poison Shrine
        this.applyUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          2,
          100,
        )
        break
      default:
        break
    }
  }

  private consumeKey(player: InternalPlayerRecord): boolean {
    // 1.13c PLR_UseKey: Assassins pick locks without spending a key.
    if (player.classId === 6) return true
    const key = player.items.find(
      (item) => item.location === 'inventory' && item.code.toLowerCase() === 'key',
    )
    if (!key) return false
    key.quantity -= 1
    if (key.rawItemData !== undefined) key.rawItemData = { ...key.rawItemData, quantity: key.quantity }
    if (key.quantity <= 0) {
      player.items = player.items.filter((item) => item !== key)
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: key.unitId,
        container: 'inventory',
      })
    } else {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'update',
        itemId: key.unitId,
        code: key.code,
        container: 'inventory',
        item: this.serverEntryToItemData(key),
      })
    }
    return true
  }

  /** Objects.txt OperateFn dispatch (D2Game 0x6fd27bb8), including one-shot semantics. */
  private operateObject(player: InternalPlayerRecord, obj: InternalObjectRecord): void {
    // Objects.txt 546 Ancients' Altar: requires clvl 20/40/60 and spawns the
    // three Ancient Barbarians once.
    if (obj.classId === 546) {
      const requiredLevel = (this.difficulty + 1) * 20
      if (obj.useCount === 0 && player.level >= requiredLevel) {
        obj.useCount = 1
        this.setPlayerQuestFlag(player, 'a5q5', QUEST_FLAG_STARTED_113C)
        const offsets = [
          { dx: 2, dy: 0 },
          { dx: -2, dy: 0 },
          { dx: 0, dy: 2 },
        ]
        for (let i = 0; i < ANCIENT_BARBARIANS_113C.length; i++) {
          const spec = ANCIENT_BARBARIANS_113C[i]!
          this.spawnMonster({
            defId: spec.defId,
            superUniqueId: spec.superUniqueId,
            x: obj.x + offsets[i]!.dx,
            y: obj.y + offsets[i]!.dy,
            areaId: obj.areaId,
          })
        }
      }
      return
    }

    // Chaos Sanctuary seals spawn their SuperUnique boss on first use.
    const sealBoss = SEAL_BOSS_113C[obj.classId]
    if (sealBoss !== undefined && obj.useCount === 0) {
      obj.useCount = 1
      const bossId = this.spawnMonster({
        defId: sealBoss.defId,
        superUniqueId: sealBoss.superUniqueId,
        x: obj.x + 2,
        y: obj.y,
        areaId: obj.areaId,
        rank: 'unique',
      })
      this.broadcastToArea(obj.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: bossId,
        mode: 1,
        at: { x: Math.round(obj.x + 2), y: Math.round(obj.y) },
        lifePct: 128,
      })
    }

    // Objects.txt 376 Hellforge (OperateFn 49, D2Game 0x6fcdb8d0): requires
    // the Hellforge Hammer ('hfh ') and three hits, then drops the reward.
    if (obj.classId === 376) {
      if (obj.mode !== 0) return
      const hammer = player.items.find(
        (item) => item.location === 'equipped' && item.code.toLowerCase().trim() === 'hfh',
      )
      if (hammer === undefined) return
      obj.useCount += 1
      if (obj.useCount <= 2) return
      this.setPlayerQuestFlag(player, 'a4q2', QUEST_FLAG_COMPLETED_113C)
      const difficulty =
        this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
      const drop = rollHellforgeDrop(difficulty, this.rng, getEmbeddedDropTables())
      this.spawnDroppedItems(drop.items, obj.areaId, obj.x, obj.y)
      this.setObjectMode(obj, 2)
      return
    }

    // Objects.txt 404 Compelling Orb (D2Game OperateFn 53 @ 0x6fd0a140): requires Khalim's
    // Will ('qf2 ') and two hits before the orb breaks.
    if (obj.classId === 404) {
      if (obj.mode !== 0) return
      const flail = player.items.find(
        (item) => item.location === 'equipped' && item.code.toLowerCase().trim() === 'qf2',
      )
      if (flail === undefined) {
        this.emitToPlayer(player.unitId, { type: 'Chat', kind: 'system', text: "Need Khalim's Will" })
        return
      }
      obj.useCount += 1
      if (obj.useCount < 2) return
      player.items = player.items.filter((item) => item !== flail)
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: flail.unitId,
        code: flail.code,
        container: 'equipment',
      })
      this.setPlayerQuestFlag(player, 'a3q3', QUEST_FLAG_COMPLETED_113C)
      // Kill the invisible MonStats 366 compellingorb monster in MONMODE_DEATH (0) so
      // D2Client MonUMod 22 event 1 (0x6fad0fb0 -> 0x6fb030d0) spawns the client orbmist.
      const orbMonster =
        (obj.linkedMonsterId !== undefined ? this.monsters.get(obj.linkedMonsterId) : undefined) ??
        [...this.monsters.values()].find(
          (m) => m.areaId === obj.areaId && m.classId === 366 && !m.dead,
        )
      if (orbMonster !== undefined && !orbMonster.dead) {
        orbMonster.dead = true
        orbMonster.hp = 0
        orbMonster.mode = 0
        this.broadcastToArea(obj.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: orbMonster.unitId,
          mode: 0,
          at: { x: Math.round(orbMonster.x), y: Math.round(orbMonster.y) },
          lifePct: 0,
        })
      }
      // Enter OBJMODE_OPERATING (1) so client plays the 29-frame smash animation + sound,
      // then settle into OBJMODE_OPENED (2) after 29 frames at FrameDelta 128 (58 ticks).
      this.setObjectMode(obj, 1)
      this.pendingObjectModeTransitions.push({
        frame: this.currentFrame + 58,
        unitId: obj.unitId,
        mode: 2,
      })
      // Server-side orbmist (Missiles.txt 368: Vel = 2 -> 3/32 sub-tiles/tick, Range = 400):
      // when it hits Durance of Hate Stairs (Objects.txt 386), SrvHitFunc 35 (0x6fc5e670)
      // sets stairs to OBJMODE_OPERATING (1) for its 9-frame (FrameDelta 120 -> 19 ticks)
      // opening animation before settling into OBJMODE_OPENED (2).
      for (const stairs of this.objects.values()) {
        if (stairs.areaId !== obj.areaId || stairs.classId !== 386 || stairs.mode !== 0) continue
        const dist = Math.hypot(stairs.x - obj.x, stairs.y - obj.y)
        const mistFrames = Math.max(1, Math.min(400, Math.round(dist / (3 / 32))))
        this.pendingObjectModeTransitions.push(
          {
            frame: this.currentFrame + mistFrames,
            unitId: stairs.unitId,
            mode: 1,
          },
          {
            frame: this.currentFrame + mistFrames + 19,
            unitId: stairs.unitId,
            mode: 2,
          },
        )
      }
      this.emitToPlayer(player.unitId, {
        type: 'QuestState',
        kind: 'special',
        source: 0x89,
        quests: new Uint16Array(player.questFlags),
        specialEventId: 10,
      })
      return
    }
    // Objects.txt 386 Durance of Hate Stairs (D2Game OperateFn 50 @ 0x6fc8f4f0):
    // sealed (mode !== 2) ignores interaction; once opened (mode === 2), warps to destAreaId.
    if (obj.classId === 386) {
      if (obj.mode !== 2) return
      if (obj.destAreaId !== undefined && this.consumeWarpCooldown(player)) {
        this.transitionPlayerArea(player, obj.destAreaId, { kind: 'warp', fromAreaId: obj.areaId })
      }
      return
    }
    const record = getObjectsTxtRecord113c(obj.classId)
    const kind = classifyObjectOperate113c(obj.classId)
    if (kind === 'door') {
      this.setObjectMode(obj, obj.mode === 2 ? 0 : 2)
      return
    }
    if (kind === 'shrine') {
      if (obj.mode !== 0) return
      this.setObjectMode(obj, 1)
      this.applyShrineEffect(player, obj.shrineType, obj.unitId)
      this.setObjectMode(obj, 2)
      obj.shrineResetFrame = this.currentFrame + GameInstance.SHRINE_RESET_FRAMES_113C
      this.emitToPlayer(player.unitId, {
        type: 'Chat',
        kind: 'system',
        text: `${CANONICAL_113C_SHRINES[obj.shrineType]?.name ?? 'Shrine'} activated`,
      })
      return
    }
    // Stash and well are re-usable in 1.13c; only one-shot containers change mode.
    if (kind === 'stash') {
      this.emitToPlayer(player.unitId, { type: 'Trade', action: 0x10 })
      return
    }
    if (kind === 'well') {
      player.hpFixed = player.maxHpFixed
      player.hp = player.maxHp
      player.manaFixed = player.maxManaFixed
      player.mana = player.maxMana
      this.emitPlayerVitals(player)
      return
    }
    if (obj.mode !== 0) return

    if (obj.isLocked && !this.consumeKey(player)) {
      this.emitToPlayer(player.unitId, { type: 'Chat', kind: 'system', text: 'Locked' })
      return
    }
    this.setObjectMode(obj, 1)
    switch (kind) {
      case 'trap':
        this.applyDamageToPlayer(player, Math.max(1, Math.floor(player.maxHp * 0.1)))
        break
      case 'destructible': {
        const dropChance = CONTAINER_OPERATE_DROP_CHANCE_113C[record.operateFn] ?? 100
        this.rollContainerDrop(player, obj, dropChance)
        break
      }
      case 'container': {
        const dropChance = CONTAINER_OPERATE_DROP_CHANCE_113C[record.operateFn] ?? 75
        this.rollContainerDrop(player, obj, dropChance)
        break
      }
      default:
        break
    }
    this.setObjectMode(obj, 2)
    this.advanceQuestObject(player, obj)
  }

  /**
   * 1.13c quest item equivalence classes (`D2Game.dll` @ `0x6fcf2f00` / `0x6fcf2070`):
   * owning an upgraded/combined quest item counts as already possessing the raw
   * quest component so duplicate quest items cannot be picked up or minted.
   */
  private static readonly QUEST_ITEM_EQUIVALENT_CODES_113C: Readonly<
    Record<string, readonly string[]>
  > = {
    bks: ['bks', 'bkd'],
    bkd: ['bkd', 'bks'],
    msf: ['msf', 'hst'],
    vip: ['vip', 'hst'],
    hst: ['hst', 'msf', 'vip'],
    j34: ['j34', 'g34', 'xyz'],
    g34: ['g34', 'j34', 'xyz'],
    xyz: ['xyz', 'j34', 'g34'],
    g33: ['g33', 'd33'],
    d33: ['d33', 'g33'],
    qey: ['qey', 'qf2'],
    qhr: ['qhr', 'qf2'],
    qbr: ['qbr', 'qf2'],
    qf1: ['qf1', 'qf2'],
    qf2: ['qf2', 'qf1', 'qey', 'qhr', 'qbr'],
    tr2: ['tr2'],
    ice: ['ice'],
    box: ['box'],
    tr1: ['tr1'],
    ass: ['ass'],
    hdm: ['hdm'],
    bbb: ['bbb'],
    hfh: ['hfh'],
    mss: ['mss'],
  }

  private getEquivalentQuestItemCodes(code: string): readonly string[] {
    const clean = code.trim().toLowerCase()
    return GameInstance.QUEST_ITEM_EQUIVALENT_CODES_113C[clean] ?? [clean]
  }

  /**
   * 1.13c `ITEMS_CheckQuestItemPickup` (`D2Game.dll` @ `0x6fcf2f00`):
   * all quest items (`ItemsTxt.nQuest != 0`, except `leg` which has `unique = 0`)
   * enforce one-per-player ownership across all containers.
   */
  private isOnePerPlayerQuestItem(code: string): boolean {
    const clean = code.trim().toLowerCase()
    if (clean === 'leg') return false
    return (
      lookupBaseInfo(clean).quest ||
      GameInstance.QUEST_ITEM_EQUIVALENT_CODES_113C[clean] !== undefined
    )
  }

  private playerHasQuestItem(player: InternalPlayerRecord, code: string): boolean {
    const equiv = this.getEquivalentQuestItemCodes(code)
    return player.items.some((item) => equiv.includes(item.code.trim().toLowerCase()))
  }

  private playerOrGroundHasQuestItem(player: InternalPlayerRecord, code: string): boolean {
    if (this.playerHasQuestItem(player, code)) return true
    const equiv = this.getEquivalentQuestItemCodes(code)
    for (const gItem of this.groundItems.values()) {
      if (gItem.areaId === player.areaId && equiv.includes(gItem.code.trim().toLowerCase())) {
        return true
      }
    }
    return false
  }

  /**
   * 1.13c `QUESTS_CreateItem` (`D2Game.dll` @ `0x6fc95df0`, `bDropIfFull = 1`):
   * attempts to place the quest/reward item in the player's inventory; if the
   * inventory has no free grid slot, drops the item on the ground at a free
   * subtile near `dropOrigin` / `player` and plays sound `23` (`cantCarry1`).
   */
  private givePlayerInventoryQuestItem(
    player: InternalPlayerRecord,
    code: string,
    dropOrigin?: { readonly x: number; readonly y: number },
  ): ServerItemEntry {
    const info = lookupBaseInfo(code)
    const free = this.findFreeGridSlot(player, 'inventory', info.width, info.height, 10, 4)
    const entry: ServerItemEntry = {
      unitId: this.allocateUnitId(),
      code: info.code,
      name: info.name,
      quality: 2,
      level: 1,
      location: free !== undefined ? 'inventory' : 'ground',
      x: free !== undefined ? free.x : 0,
      y: free !== undefined ? free.y : 0,
      width: info.width,
      height: info.height,
      areaId: player.areaId,
      ownerId: free !== undefined ? player.unitId : 0,
      bodyLoc: 0,
      storePage: free !== undefined ? 1 : 0,
      cost: info.cost,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: info.maxDurability,
      maxDurability: info.maxDurability,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    }
    if (free !== undefined) {
      player.items.push(entry)
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'add',
        itemId: entry.unitId,
        code: entry.code,
        x: entry.x,
        y: entry.y,
        container: 'inventory',
        item: this.serverEntryToItemData(entry),
      })
      return entry
    }

    const pos = this.findDropPosition(
      player.areaId,
      dropOrigin?.x ?? player.x,
      dropOrigin?.y ?? player.y,
      new Set(),
    )
    entry.x = pos.x
    entry.y = pos.y
    this.groundItems.set(entry.unitId, entry)
    this.broadcastToArea(player.areaId, {
      type: 'ItemEvent',
      action: 'drop',
      itemId: entry.unitId,
      code: entry.code,
      x: entry.x,
      y: entry.y,
      container: 'ground',
      item: { ...this.serverEntryToItemData(entry), action: 0x02 },
    })
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 23,
    })
    return entry
  }

  private removePlayerQuestItem(player: InternalPlayerRecord, item: ServerItemEntry): void {
    player.items = player.items.filter((candidate) => candidate !== item)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
    })
  }

  /** Quest objects set STARTED; the canonical single-use objects also complete. */
  private advanceQuestObject(
    player: InternalPlayerRecord,
    obj: InternalObjectRecord,
  ): void {
    // 1.13c gpObjectOperateFnTable quest item drops (30, 108, 149, 193, 244, 246, 252, 354, 355, 356, 405, 406, 407).
    const questItemCode = QUEST_OBJECT_DROP_ITEM_CODE_113C[obj.classId]
    if (questItemCode !== undefined && !this.playerOrGroundHasQuestItem(player, questItemCode)) {
      const item = this.createQuestDropItem(questItemCode)
      if (item) {
        this.spawnDroppedItems([item], obj.areaId, obj.x, obj.y)
      }
    }
    if (obj.classId === 473) {
      // Rescue on Mount Arreat: three cages (five barbarians each).
      obj.useCount = 1
      const cages = [...this.objects.values()].filter(
        (candidate) => candidate.areaId === obj.areaId && candidate.classId === 473 && candidate.useCount > 0,
      )
      if (cages.length >= 3) {
        this.setPlayerQuestFlag(player, 'a5q2', QUEST_FLAG_REWARD_PENDING_113C)
      }
    }
    if (obj.classId >= 17 && obj.classId <= 21) {
      obj.useCount = 1
      const opened = [...this.objects.values()].filter(
        (candidate) =>
          candidate.areaId === obj.areaId &&
          candidate.classId >= 17 &&
          candidate.classId <= 21 &&
          candidate.useCount > 0,
      )
      if (opened.length >= 5 && !this.cairnPortalAreas.has(obj.areaId)) {
        this.cairnPortalAreas.add(obj.areaId)
        this.spawnObject({
          classId: 60,
          x: opened[0]!.x,
          y: opened[0]!.y,
          areaId: obj.areaId,
          mode: 1,
          destAreaId: 38,
        })
      }
    }
    if (obj.classId === 26) {
      this.setPlayerQuestFlag(player, 'a1q3', QUEST_FLAG_COMPLETED_113C)
    }

    // A2Q6: the Horadric Staff in the orifice deletes hst/vip/msf and spawns
    // Duriel's Lair (Objects.txt 100) at (x-13, y+3) after 18 ticks.
    if (obj.classId === 152) {
      const parts = player.items.filter((item) =>
        ['hst', 'vip', 'msf'].includes(item.code.toLowerCase()),
      )
      if (parts.length === 0) return
      for (const part of parts) {
        this.removePlayerQuestItem(player, part)
      }
      this.setPlayerQuestFlag(player, 'a2q2', QUEST_FLAG_COMPLETED_113C)
      this.pendingObjectSpawns.push({
        frame: this.currentFrame + 18,
        classId: 100,
        x: obj.x - 13,
        y: obj.y + 3,
        areaId: obj.areaId,
        destAreaId: 73,
      })
      this.emitToPlayer(player.unitId, {
        type: 'QuestState',
        kind: 'special',
        source: 0x89,
        quests: new Uint16Array(player.questFlags),
        specialEventId: 3,
      })
    }
    const questId = QUEST_OBJECT_TO_QUEST_113C[obj.classId]
    if (questId === undefined) return
    // A5Q3: thawing Anya requires Malah's potion ('ice').
    if (obj.classId === 558) {
      if (
        hasQuestFlag113c(
          player.questFlags,
          'a5q3',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
        )
      ) {
        return
      }
      const potion = player.items.find(
        (item) => item.code.toLowerCase().trim() === 'ice',
      )
      if (potion === undefined) return
      this.removePlayerQuestItem(player, potion)
      this.setPlayerQuestFlag(
        player,
        'a5q3',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
      return
    }
    this.setPlayerQuestFlag(player, questId, QUEST_FLAG_STARTED_113C)
    const sealIds = [392, 393, 394, 395, 396]
    if (sealIds.includes(obj.classId)) {
      const opened = [...this.objects.values()].filter(
        (candidate) =>
          candidate.areaId === obj.areaId &&
          sealIds.includes(candidate.classId) &&
          candidate.mode === 2,
      )
      if (opened.length === sealIds.length) {
        this.setPlayerQuestFlag(player, 'a4q3', QUEST_FLAG_PRIMARY_GOAL_DONE_113C)
      }
      return
    }
    if (obj.classId === 252) {
      return
    }

    // Reward-pending quest objects consumed by their NPC.
    const pendingQuest =
      obj.classId === 108
        ? 'a1q5'
        : obj.classId === 193
          ? 'a3q4'
          : undefined
    if (pendingQuest !== undefined) {
      this.setPlayerQuestFlag(player, pendingQuest, QUEST_FLAG_REWARD_PENDING_113C)
      return
    }
    // 1.13c objects whose operation itself completes the objective.
    if ([149, 357, 376, 546].includes(obj.classId)) {
      this.setPlayerQuestFlag(player, questId, QUEST_FLAG_COMPLETED_113C)
    }
  }

  private emitQuestLog(player: InternalPlayerRecord): void {
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'log',
      source: 0x29,
      quests: new Uint16Array(player.questFlags),
      flags: Array.from(player.questFlags),
    })
  }

  /** S2C 0x5E GameQuestAvailability: 37-byte per-quest availability bitmap. */
  private emitQuestAvailability(player: InternalPlayerRecord): void {
    const availabilityBytes = new Uint8Array(37)
    for (let i = 0; i < availabilityBytes.length; i++) {
      availabilityBytes[i] = (player.questFlags[i] ?? 0) === 0 ? 0 : 1
    }
    const quests = new Uint16Array(18)
    for (let i = 0; i < quests.length; i++) {
      quests[i] = ((availabilityBytes[i * 2] ?? 0) << 8) | (availabilityBytes[i * 2 + 1] ?? 0)
    }
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'availability',
      source: 0x5e,
      quests,
      availabilityBytes,
    })
  }

  /**
   * 1.13c permanent character / item rewards granted when a quest transitions
   * to `QFLAG_REWARDGRANTED` (`0x0001`).
   */
  private grantQuestCompletionReward113c(
    player: InternalPlayerRecord,
    questId: string,
  ): void {
    if (questId === 'a1q1' || questId === 'a2q1') {
      player.newSkills += 1
      if (questId === 'a1q1') {
        // D2Game.dll 0x6fc82340 (called from A1Q1 reward 0x6fc82a80): sets Quest 41 (0x29) bits 13 (0x2000) and 1 (0x0002).
        player.questFlags[41] = (player.questFlags[41] ?? 0) | 0x2002
      }
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 5,
        value: player.newSkills,
      })
    } else if (questId === 'a4q1') {
      player.newSkills += 2
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 5,
        value: player.newSkills,
      })
    } else if (questId === 'a3q4') {
      player.statPts += 5
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 4,
        value: player.statPts,
      })
    } else if (questId === 'a3q1') {
      player.maxHpFixed += 20 * FIXED_ONE
      player.hpFixed += 20 * FIXED_ONE
      player.maxHp = Math.floor(player.maxHpFixed / FIXED_ONE)
      player.hp = Math.floor(player.hpFixed / FIXED_ONE)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 7,
        value: player.maxHpFixed,
      })
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 6,
        value: player.hpFixed,
      })
    } else if (questId === 'a5q2') {
      for (const runeCode of ['r08', 'r09', 'r07']) {
        this.givePlayerInventoryQuestItem(player, runeCode)
      }
    } else if (questId === 'a5q3') {
      const combat = this.playerCombatContext(player)
      for (const [statId, statName] of [
        [39, 'fireresist'],
        [41, 'lightresist'],
        [43, 'coldresist'],
        [45, 'poisonresist'],
      ] as const) {
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId,
          value: Math.trunc(combat.statList.getAccruedStat(statName)),
        })
      }
    }
  }

  private setPlayerQuestFlag(
    player: InternalPlayerRecord,
    questId: string,
    mask: number,
  ): boolean {
    const questIndex = questWordIndex113c(questId)
    const wasCompleted =
      questIndex !== undefined &&
      ((player.questFlags[questIndex] ?? 0) & QUEST_FLAG_COMPLETED_113C) !== 0
    if (!setQuestFlag113c(player.questFlags, questId, mask)) return false
    const nowCompleted =
      questIndex !== undefined &&
      ((player.questFlags[questIndex] ?? 0) & QUEST_FLAG_COMPLETED_113C) !== 0
    if (!wasCompleted && nowCompleted) {
      this.grantQuestCompletionReward113c(player, questId)
    }
    this.emitQuestLog(player)
    // S2C 0x28 QuestInfo: the per-quest update channel.
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      quests: new Uint16Array(player.questFlags),
      flags: Array.from(player.questFlags),
    })
    // S2C 0x5D QuestStatus for the quest that just changed.
    if (questIndex !== undefined) {
      this.emitToPlayer(player.unitId, {
        type: 'QuestState',
        kind: 'status',
        source: 0x5d,
        quests: new Uint16Array([questIndex]),
        questStatus: {
          questId: questIndex,
          alertFlags: 0,
          filterStatus: (player.questFlags[questIndex] ?? 0) & QUEST_FLAG_STARTED_113C ? 2 : 1,
          extra: 0,
        },
      })
    }
    this.emitQuestAvailability(player)
    return true
  }

  private playerCanEnterArea(player: InternalPlayerRecord, areaId: number): boolean {
    const gate = QUEST_AREA_GATES_113C[areaId]
    if (gate === undefined) return true
    return hasQuestFlag113c(player.questFlags, gate.quest, gate.mask)
  }

  /**
   * 1.13c interaction sight: the player must have a clear walkability ray to the
   * object/NPC/corpse. Without a terrain callback (synthetic tests) the ray is
   * treated as open unless blocked by a closed door object. Adjacent / wall-embedded
   * targets (staircase warps, wall torches, chests or items touching a wall) are
   * reachable within interaction range without requiring the target's own wall sub-tile
   * to be walkable (#1373).
   */
  private hasInteractionLineOfSight(
    areaId: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    targetObjectUnitId?: number,
  ): boolean {
    if (this.isMonsterStepWalkable(areaId, fromX, fromY, toX, toY, false, targetObjectUnitId)) {
      return true
    }
    const check = this.terrainWalkableCheck
    if (!check) return false
    // Wall-embedded targets (staircase warps, wall torches, chests whose anchor sub-tile
    // sits inside the wall footprint) have a non-walkable `(toX, toY)` even when the player
    // is standing right against the wall face (#1373). Allow interaction only when the target
    // sub-tile itself is unwalkable and the ray to the adjacent floor face toward the player
    // is completely clear.
    const targetWalkable =
      check(areaId, toX, toY, false) &&
      check(areaId, Math.round(toX), Math.round(toY), false)
    if (targetWalkable) return false
    const dist = Math.hypot(toX - fromX, toY - fromY)
    if (dist <= 1.5) return true
    const maxEmbedDepth = Math.min(dist, 3.5)
    for (let d = 0.25; d <= maxEmbedDepth; d += 0.25) {
      const px = toX + ((fromX - toX) / dist) * d
      const py = toY + ((fromY - toY) / dist) * d
      const rx = Math.round(px)
      const ry = Math.round(py)
      if (this.isClosedDoorAt(areaId, rx, ry, targetObjectUnitId)) return false
      if (check(areaId, px, py, false) && check(areaId, rx, ry, false)) {
        return this.isMonsterStepWalkable(areaId, fromX, fromY, px, py, false, targetObjectUnitId)
      }
    }
    return false
  }

  /** 1.13c PLAYER_ProcessInteract: approach a queued target, then operate it. */
  private stepPendingInteractions(): void {
    for (const player of this.players.values()) {
      const pending = player.pendingInteraction
      if (pending === undefined || player.dead) continue
      let tx: number
      let ty: number
      let inRangeAndSight = false
      let targetObjectUnitId: number | undefined
      if (pending.kind === 'object') {
        const obj = this.objects.get(pending.id)
        if (obj === undefined || obj.areaId !== player.areaId) {
          player.pendingInteraction = undefined
          player.pendingInteractionSteps = 0
          continue
        }
        tx = obj.x
        ty = obj.y
        targetObjectUnitId = obj.unitId
        inRangeAndSight =
          this.playerInObjectRange(player, obj) &&
          this.hasInteractionLineOfSight(player.areaId, player.x, player.y, obj.x, obj.y, obj.unitId)
      } else if (pending.kind === 'warp') {
        const tile = this.warpTiles.get(pending.id)
        if (tile === undefined || tile.areaId !== player.areaId) {
          player.pendingInteraction = undefined
          player.pendingInteractionSteps = 0
          continue
        }
        tx = tile.x
        ty = tile.y
        inRangeAndSight =
          D2Common_10399_AtSubtiles(
            tile.x,
            tile.y,
            0,
            Math.round(player.x),
            Math.round(player.y),
            PLAYER_SIZE_X_113C,
          ) <= WARP_INTERACT_DISTANCE_SUBTILES &&
          this.hasInteractionLineOfSight(player.areaId, player.x, player.y, tile.x, tile.y)
      } else if (pending.kind === 'waypoint') {
        const wp = this.objects.get(pending.id)
        if (wp === undefined || !wp.isWaypoint || wp.areaId !== player.areaId) {
          player.pendingInteraction = undefined
          player.pendingInteractionSteps = 0
          continue
        }
        tx = wp.x
        ty = wp.y
        targetObjectUnitId = wp.unitId
        inRangeAndSight =
          Math.hypot(wp.x - player.x, wp.y - player.y) <= WAYPOINT_INTERACT_DISTANCE_SUBTILES &&
          this.hasInteractionLineOfSight(player.areaId, player.x, player.y, wp.x, wp.y, wp.unitId)
      } else if (pending.kind === 'corpse') {
        if (player.corpseId === undefined || player.corpseId !== pending.id) {
          player.pendingInteraction = undefined
          player.pendingInteractionSteps = 0
          continue
        }
        tx = player.corpseX
        ty = player.corpseY
        inRangeAndSight =
          Math.hypot(player.x - player.corpseX, player.y - player.corpseY) <= 3 &&
          this.hasInteractionLineOfSight(player.areaId, player.x, player.y, player.corpseX, player.corpseY)
      } else {
        const npc = this.monsters.get(pending.id)
        if (npc === undefined || !npc.isNpc || npc.areaId !== player.areaId) {
          player.pendingInteraction = undefined
          player.pendingInteractionSteps = 0
          player.pendingNpcGamble = undefined
          continue
        }
        tx = npc.x
        ty = npc.y
        inRangeAndSight =
          this.playerInNpcRange(player, npc) &&
          this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y)
      }
      if (inRangeAndSight) {
        const gamble = player.pendingNpcGamble
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = undefined
        if (pending.kind === 'object') this.handleInteract(player, pending.id)
        else if (pending.kind === 'warp') this.handleWarpTileInteract(player, pending.id)
        else if (pending.kind === 'waypoint') {
          const wp = this.objects.get(pending.id)
          if (wp !== undefined && pending.destAreaId !== undefined) {
            this.openWaypointMenu(player, wp)
            this.transitionPlayerArea(player, pending.destAreaId, { kind: 'waypoint' })
          }
        } else if (pending.kind === 'corpse') {
          this.recoverPlayerCorpse(player)
        } else if (gamble !== undefined) {
          this.handleNpcAction(player, pending.id, gamble)
        } else {
          this.handleNpcInteract(player, pending.id)
        }
        continue
      }
      const steps = (player.pendingInteractionSteps ?? 0) + 1
      player.pendingInteractionSteps = steps
      if (this.loadedAreas.has(player.areaId) && steps >= 3) {
        const stand = findStandableNear(
          (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
          tx,
          ty,
          3,
        )
        if (
          stand !== null &&
          this.hasInteractionLineOfSight(
            player.areaId,
            stand.x,
            stand.y,
            tx,
            ty,
            targetObjectUnitId,
          )
        ) {
          this.movePlayer(player.unitId, stand.x, stand.y)
          continue
        }
      }
      const dist = Math.hypot(tx - player.x, ty - player.y)
      if (dist <= 0.01) continue
      const stopRange = 1.5
      const step = Math.min(0.6, Math.max(0.15, dist - stopRange))
      const nx = player.x + ((tx - player.x) / dist) * step
      const ny = player.y + ((ty - player.y) / dist) * step
      if (
        !this.isClosedDoorAt(player.areaId, Math.round(nx), Math.round(ny), targetObjectUnitId) &&
        (!this.terrainWalkableCheck ||
          this.terrainWalkableCheck(player.areaId, nx, ny, false))
      ) {
        this.movePlayer(player.unitId, nx, ny)
      }
    }
  }

  private handleInteract(player: InternalPlayerRecord, targetId: number): void {
    if (player.corpseId === targetId) {
      // 1.13c corpse recovery: the same 3-sub-tile reach used by the walk-over pickup.
      if (
        Math.hypot(player.x - player.corpseX, player.y - player.corpseY) <= 3 &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, player.corpseX, player.corpseY)
      ) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        this.recoverPlayerCorpse(player)
        return
      }
      if (player.pendingInteraction === undefined) {
        player.pendingInteraction = { kind: 'corpse', id: targetId }
        player.pendingInteractionSteps = 0
      }
      return
    }

    const obj = this.objects.get(targetId)
    if (
      obj &&
      obj.areaId === player.areaId &&
      this.playerInObjectRange(player, obj) &&
      this.hasInteractionLineOfSight(player.areaId, player.x, player.y, obj.x, obj.y, obj.unitId)
    ) {
      player.pendingInteraction = undefined
      player.pendingInteractionSteps = 0
      if (obj.destAreaId !== undefined) {
        // D2Game OperateFn 50 (0x6fc8f4f0): Durance of Hate Stairs (Objects.txt 386)
        // cannot be entered until the Compelling Orb mist has opened them (mode === 2).
        if (obj.classId === 386 && obj.mode !== 2) return
        // Warp / portal interactions share the 1.13c 500 ms click cooldown.
        if (!this.consumeWarpCooldown(player)) return
        // Town Portal (Objects.txt 59, owned): land next to the paired mouth, not the town
        // entry. Other linked objects are level links that use the destination's warp back.
        let arrival: AreaArrival = { kind: 'warp', fromAreaId: obj.areaId }
        if (obj.portalOwnerId !== undefined) {
          const paired = [...this.objects.values()].find(
            other =>
              other.unitId !== obj.unitId &&
              other.areaId === obj.destAreaId &&
              other.portalOwnerId === obj.portalOwnerId,
          )
          arrival = paired
            ? { kind: 'townPortal', x: paired.x, y: paired.y }
            : { kind: 'townPortal' }
        }
        const wasTownMouth = TOWN_AREAS.has(obj.areaId)
        const moved = this.transitionPlayerArea(player, obj.destAreaId, arrival)
        if (moved && wasTownMouth) this.closeTownPortal(player)
        return
      }
      if (obj.isWaypoint) {
        this.openWaypointMenu(player, obj)
        return
      }
      this.operateObject(player, obj)
      return
    }
    if (obj && obj.areaId === player.areaId && player.pendingInteraction === undefined) {
      player.pendingInteraction = { kind: 'object', id: targetId }
      player.pendingInteractionSteps = 0
    }

    const npc = this.monsters.get(targetId)
    if (npc && npc.isNpc && npc.areaId === player.areaId) {
      this.handleNpcInteract(player, targetId)
    }
  }

  /**
   * Waypoint operate (D2Game waypoint OperateFn -> S2C `0x63 WaypointMenu`, D2Client 0x6fb5f8b0):
   * activate the waypoint of the player's current level, then send the waypoint object's unit id
   * plus the player's unlocked waypoint bit indices (0..38, `WAYPOINT_AREA_IDS`) so the client
   * opens the waypoint panel and can answer with `0x49 WaypointGo { waypoint, level }`.
   */
  private openWaypointMenu(player: InternalPlayerRecord, obj: InternalObjectRecord): void {
    // Only the 39 canonical waypoint levels own a waypoint bit; any other level id has none to set.
    if (WAYPOINT_AREA_IDS.includes(player.areaId)) {
      player.waypoints.add(player.areaId)
    }
    // 1.13c remembers the operated waypoint object; `0x49 WaypointGo` is only
    // accepted while the player is still standing next to it.
    player.activeWaypointUnitId = obj.unitId
    if (obj.mode === 0) {
      obj.mode = 2
      this.broadcastToArea(obj.areaId, {
        type: 'UnitMode',
        unitType: 2,
        id: obj.unitId,
        mode: 2,
      })
    }
    const open: number[] = []
    for (let bitIndex = 0; bitIndex < WAYPOINT_AREA_IDS.length; bitIndex++) {
      if (player.waypoints.has(WAYPOINT_AREA_IDS[bitIndex]!)) {
        open.push(bitIndex)
      }
    }
    this.emitToPlayer(player.unitId, {
      type: 'WaypointMenu',
      unitId: obj.unitId,
      open,
    })
  }

  /**
   * 1.13c C2S 0x49 validity: the player must still be at the operated waypoint, the
   * destination must be one of the 39 waypoint levels, already activated, and its act
   * must have been reached (quest progression proxy).
   */
  private canUseWaypoint(player: InternalPlayerRecord, destAreaId: number): boolean {
    if (!WAYPOINT_AREA_IDS.includes(destAreaId)) return false
    if (!player.waypoints.has(destAreaId)) return false
    if (areaToAct(destAreaId) > player.unlockedAct) return false
    if (player.activeWaypointUnitId === 0) return false
    const obj = this.objects.get(player.activeWaypointUnitId)
    if (!obj || !obj.isWaypoint || obj.areaId !== player.areaId) return false
    return (
      Math.hypot(obj.x - player.x, obj.y - player.y) <=
        WAYPOINT_INTERACT_DISTANCE_SUBTILES &&
      this.hasInteractionLineOfSight(player.areaId, player.x, player.y, obj.x, obj.y, obj.unitId)
    )
  }

  /**
   * C2S 0x13 InteractUnit(5, warpId) on a level warp (`UNIT_TILE`): D2Game takes the warp to its
   * destination level and lands the player at the warp there that leads back.
   */
  private handleWarpTileInteract(player: InternalPlayerRecord, warpUnitId: number): void {
    const tile = this.warpTiles.get(warpUnitId)
    if (!tile || tile.areaId !== player.areaId) return
    if (
      D2Common_10399_AtSubtiles(
        tile.x,
        tile.y,
        0,
        Math.round(player.x),
        Math.round(player.y),
        PLAYER_SIZE_X_113C,
      ) > WARP_INTERACT_DISTANCE_SUBTILES
    ) {
      // 1.13c PLAYER_ProcessInteract: queue the warp and walk into range.
      if (player.pendingInteraction === undefined) {
        player.pendingInteraction = { kind: 'warp', id: warpUnitId }
        player.pendingInteractionSteps = 0
      }
      return
    }
    player.pendingInteraction = undefined
    player.pendingInteractionSteps = 0
    if (!this.hasInteractionLineOfSight(player.areaId, player.x, player.y, tile.x, tile.y)) return
    if (!this.consumeWarpCooldown(player)) return
    this.transitionPlayerArea(player, tile.destAreaId, { kind: 'warp', fromAreaId: tile.areaId })
  }

  /** Level warps (`UNIT_TILE`) of a loaded area. */
  listWarpTiles(areaId: number): readonly {
    readonly unitId: number
    readonly lvlWarpId: number
    readonly x: number
    readonly y: number
    readonly destAreaId: number
  }[] {
    const out: { unitId: number; lvlWarpId: number; x: number; y: number; destAreaId: number }[] = []
    for (const t of this.warpTiles.values()) {
      if (t.areaId !== areaId) continue
      out.push({ unitId: t.unitId, lvlWarpId: t.lvlWarpId, x: t.x, y: t.y, destAreaId: t.destAreaId })
    }
    return out
  }

  /**
   * 1.13c `PLR_ConsumeScrollOrTome`: a Town Portal cast consumes one `tsc`
   * scroll, or one charge from a `tbk` tome. Returns false when the player has
   * neither, so the portal is not opened.
   */
  private consumeTownPortalScrollOrTome(player: InternalPlayerRecord): boolean {
    const carried = (item: ServerItemEntry): boolean =>
      item.location === 'inventory' || item.location === 'belt'
    const scroll = player.items.find(
      (item) => carried(item) && item.code.trim().toLowerCase() === 'tsc',
    )
    if (scroll !== undefined) {
      player.items = player.items.filter((item) => item !== scroll)
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: scroll.unitId,
        code: scroll.code,
        x: scroll.x,
        y: scroll.y,
        container: scroll.location === 'belt' ? 'belt' : 'inventory',
        item: this.serverEntryToItemData(scroll),
      })
      return true
    }
    const tome = player.items.find(
      (item) =>
        carried(item) &&
        item.code.trim().toLowerCase() === 'tbk' &&
        (item.quantity ?? 0) > 0,
    )
    if (tome === undefined) return false
    tome.quantity = Math.max(0, (tome.quantity ?? 0) - 1)
    if (tome.rawItemData !== undefined) {
      tome.rawItemData = { ...tome.rawItemData, quantity: tome.quantity }
    }
    if (tome.quantity <= 0) {
      player.items = player.items.filter((item) => item !== tome)
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: tome.unitId,
        code: tome.code,
        x: tome.x,
        y: tome.y,
        container: tome.location === 'belt' ? 'belt' : 'inventory',
        item: this.serverEntryToItemData(tome),
      })
    } else {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'update',
        itemId: tome.unitId,
        code: tome.code,
        x: tome.x,
        y: tome.y,
        container: tome.location === 'belt' ? 'belt' : 'inventory',
        item: this.serverEntryToItemData(tome),
      })
    }
    return true
  }

  private openTownPortal(
    player: InternalPlayerRecord,
    consumeScroll = true,
    ownerKey: number = player.unitId,
    ownerName: string = player.name,
  ): number {
    // Reject Town Portal cast while in Town (F5.B3)
    if (TOWN_AREAS.has(player.areaId)) {
      return 0
    }
    if (consumeScroll && !this.consumeTownPortalScrollOrTome(player)) return 0

    // Replace any existing portal owned by this player (F5.B4)
    for (const [objId, obj] of this.objects.entries()) {
      if (obj.portalOwnerId === ownerKey) {
        this.objects.delete(objId)
        this.broadcastToArea(obj.areaId, {
          type: 'UnitRemove',
          unitType: 2,
          id: objId,
          unitId: objId,
        })
      }
    }

    const townArea = ACT_TOWN_AREA[player.act] ?? 1
    const fromArea = player.areaId
    // 1.13c creates both mouths: the caster's position in the wilderness and the fixed
    // town portal tile (D2GAME_CreateLinkPortal_6FD13B20 -> AddTownPortal).
    this.ensureAreaLoaded(townArea)
    const townPos = resolveTownPortalSubTile(townArea)
    const portalId = this.spawnObject({
      classId: 59,
      x: Math.round(player.x) + 1,
      y: Math.round(player.y) + 1,
      areaId: fromArea,
      mode: 2,
      destAreaId: townArea,
    })
    const townPortalId = this.spawnObject({
      classId: 59,
      x: townPos.x,
      y: townPos.y,
      areaId: townArea,
      mode: 2,
      destAreaId: fromArea,
    })
    const fromObj = this.objects.get(portalId)
    if (fromObj) fromObj.portalOwnerId = ownerKey
    const townObj = this.objects.get(townPortalId)
    if (townObj) townObj.portalOwnerId = ownerKey

    const eventOwnerId = ownerKey > 0 ? ownerKey : 0
    this.broadcastToArea(fromArea, {
      type: 'Portal',
      portalId,
      ownerId: eventOwnerId,
      ownerName,
      areaId: fromArea,
      destAreaId: townArea,
      localId: portalId,
      remoteId: townPortalId,
      flags: 1,
    })
    this.broadcastToArea(townArea, {
      type: 'Portal',
      portalId: townPortalId,
      ownerId: eventOwnerId,
      ownerName,
      areaId: townArea,
      destAreaId: fromArea,
      localId: townPortalId,
      remoteId: portalId,
      flags: 1,
    })
    return portalId
  }

  /** Remove both linked mouths of `player`'s town portal (town entry closes it in 1.13c). */
  private closeTownPortal(player: InternalPlayerRecord): void {
    for (const [objId, obj] of [...this.objects.entries()]) {
      if (obj.portalOwnerId !== player.unitId) continue
      this.objects.delete(objId)
      this.broadcastToArea(obj.areaId, {
        type: 'UnitRemove',
        unitType: 2,
        id: objId,
        unitId: objId,
      })
    }
  }

  /**
   * Seamless outdoor seam (#1335): when the player's world position leaves the active area's
   * room rectangles and enters a loaded neighbour's room, switch `player.areaId` in place.
   * No LoadAct/warp: the coordinate is continuous, like 1.13c `DRLG_LinkLevels` rooms.
   */
  private maybeSwitchPlayerAreaSeamless(player: InternalPlayerRecord): void {
    const current = this.loadedAreas.get(player.areaId)
    if (!current || current.roomRects.length === 0) return
    const x = Math.floor(player.x)
    const y = Math.floor(player.y)
    const inside = (r: { x: number; y: number; w: number; h: number }): boolean =>
      x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
    if (current.roomRects.some(inside)) return
    for (const id of current.adjacentAreaIds) {
      const area = this.loadedAreas.get(id)
      if (!area || !area.roomRects.some(inside)) continue
      if (!area.isWalkable(id, x, y)) continue
      this.switchPlayerAreaSeamless(player, id)
      return
    }
  }

  private switchPlayerAreaSeamless(player: InternalPlayerRecord, destAreaId: number): void {
    const prevArea = player.areaId
    if (prevArea === destAreaId) return
    const dest = this.loadedAreas.get(destAreaId)
    if (!dest) return
    this.hidePlayerAreaRooms(player, prevArea)
    player.areaId = destAreaId
    this.clearVendorPools(player, prevArea)
    player.act = areaToAct(destAreaId)
    player.unlockedAct = Math.max(player.unlockedAct, player.act)
    player.activeWaypointUnitId = 0

    const motion = this.getPlayerMotion(player)
    // 1.13c PLAYER_UpdateRoom keeps `pPath` and the current walk/run action
    // across a same-act outdoor seam; only the collision domain changes.
    motion.mover.setCollisionChecker(
      this.terrainWalkableCheck ? (sx, sy) => this.isPlayerSubTileBlocked(destAreaId, sx, sy) : null,
    )

    for (const other of this.players.values()) {
      if (other.unitId === player.unitId) continue
      if (other.areaId === prevArea) {
        this.emitToPlayer(other.unitId, {
          type: 'UnitRemove',
          unitType: 0,
          id: player.unitId,
          unitId: player.unitId,
        })
      }
    }

    this.revealAreaRoomsNearPlayer(player)
    this.emitAreaSnapshotToPlayer(player)
  }

  /**
   * Move `player` into `destAreaId` (D2Game `LEVEL_WarpUnit`). Same-act transitions
   * send RoomHide/RoomReveal + UnitReassign only; an act change sends UnloadAct →
   * LoadAct first. Build/landing failures roll back and notify the client instead of
   * throwing into the 25 Hz frame loop.
   */
  private transitionPlayerArea(
    player: InternalPlayerRecord,
    destAreaId: number,
    arrival: AreaArrival,
  ): boolean {
    const prevArea = player.areaId
    const prevAct = areaToAct(prevArea)
    const destAct = areaToAct(destAreaId)
    if (!this.playerCanEnterArea(player, destAreaId)) {
      this.notifyAreaTransitionFailure(player, destAreaId)
      return false
    }
    let landing: { readonly x: number; readonly y: number } | null = null
    if (this.areaBootstrapResolver) {
      let area: LoadedAreaRecord | null = null
      try {
        area = this.loadArea(destAreaId)
      } catch {
        area = null
      }
      if (!area) {
        this.notifyAreaTransitionFailure(player, destAreaId)
        return false
      }
      landing = this.resolveArrivalPosition(area, arrival)
      if (!landing) {
        this.notifyAreaTransitionFailure(player, destAreaId)
        return false
      }
    }

    if (prevArea !== destAreaId) {
      this.hidePlayerAreaRooms(player, prevArea)
    }
    if (destAct !== prevAct) {
      this.emitToPlayer(player.unitId, { type: 'UnloadAct' })
    }
    player.areaId = destAreaId
    this.clearVendorPools(player, prevArea)
    player.act = destAct
    player.unlockedAct = Math.max(player.unlockedAct, destAct)
    player.activeWaypointUnitId = 0
    if (landing) {
      player.x = landing.x
      player.y = landing.y
      player.targetX = landing.x
      player.targetY = landing.y
    }

    if (prevArea !== destAreaId) {
      for (const other of this.players.values()) {
        if (other.unitId === player.unitId) continue
        if (other.areaId === prevArea) {
          this.emitToPlayer(other.unitId, {
            type: 'UnitRemove',
            unitType: 0,
            id: player.unitId,
            unitId: player.unitId,
          })
        }
      }
    }

    if (destAct !== prevAct) {
      this.emitToPlayer(player.unitId, {
        type: 'LoadAct',
        act: player.act,
        mapSeed: this.currentMapSeed,
        areaId: destAreaId,
      })
    }
    this.revealAreaRoomsNearPlayer(player)
    this.emitToPlayer(player.unitId, {
      type: 'UnitReassign',
      unitType: 0,
      id: player.unitId,
      unitId: player.unitId,
      at: playerWirePosition(player),
      x: player.x,
      y: player.y,
      snap: true,
      areaId: player.areaId,
    })
    this.emitAreaSnapshotToPlayer(player)
    return true
  }

  /** Non-fatal transition failure: keep the player in place and tell the client. */
  private notifyAreaTransitionFailure(
    player: InternalPlayerRecord,
    destAreaId: number,
  ): void {
    this.emitToPlayer(player.unitId, {
      type: 'Chat',
      kind: 'system',
      text: `Unable to enter area ${destAreaId}`,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitReassign',
      unitType: 0,
      id: player.unitId,
      unitId: player.unitId,
      at: playerWirePosition(player),
      x: player.x,
      y: player.y,
      snap: true,
      areaId: player.areaId,
    })
  }

  private handleItemPickup(
    player: InternalPlayerRecord,
    itemId: number,
    toCursor: boolean,
  ): void {
    const gItem = this.groundItems.get(itemId)
    if (!gItem || gItem.areaId !== player.areaId) return

    if (gItem.code === 'gld') {
      this.groundItems.delete(itemId)
      this.broadcastToArea(player.areaId, {
        type: 'UnitRemove',
        unitType: 4,
        id: itemId,
        unitId: itemId,
      })
      player.gold += gItem.quantity
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 14,
        value: player.gold,
      })
      return
    }

    // 1.13c D2Game.dll @ 0x6fcf7020 -> 0x6fcf2f00 (`ITEMS_CheckQuestItemPickup`):
    // reject duplicate quest item pickup BEFORE removing the item from the ground,
    // and emit S2C 0x2C sound 19 (`impossible1`).
    if (this.isOnePerPlayerQuestItem(gItem.code) && this.playerHasQuestItem(player, gItem.code)) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }

    // 1.13c D2Game.dll @ 0x6fcf71c2: when picking up to cursor (`toCursor = 1`),
    // if the player's cursor already holds an item, reject before removing from ground.
    if (toCursor && player.items.some((i) => i.location === 'cursor')) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }

    const isKey = !toCursor && gItem.code.trim().toLowerCase() === 'key'
    let stackableKeyCap = 0
    if (isKey) {
      for (const existing of player.items) {
        if (
          existing.location === 'inventory' &&
          existing.code.trim().toLowerCase() === 'key' &&
          (existing.quantity || 1) < 12
        ) {
          stackableKeyCap += 12 - Math.max(1, existing.quantity || 1)
        }
      }
    }
    const initialQty = Math.max(1, gItem.quantity || 1)
    const needsInventorySlot = !toCursor && (!isKey || initialQty > stackableKeyCap)
    const slot = needsInventorySlot
      ? this.findFreeGridSlot(player, 'inventory', gItem.width, gItem.height, 10, 4)
      : undefined

    // 1.13c D2Game.dll @ 0x6fcf711f..0x6fcf7145: when picking up to inventory (`toCursor = 0`)
    // and there is no room in the inventory grid (and keys cannot fully stack),
    // play sound 23 (`cantCarry1`) and leave the item on the ground.
    if (!toCursor && needsInventorySlot && !slot && (!isKey || stackableKeyCap <= 0)) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 23,
      })
      return
    }

    this.groundItems.delete(itemId)
    this.broadcastToArea(player.areaId, {
      type: 'UnitRemove',
      unitType: 4,
      id: itemId,
      unitId: itemId,
    })

    gItem.ownerId = player.unitId
    if (isKey) {
      let remQty = initialQty
      for (const existing of player.items) {
        if (
          existing.location === 'inventory' &&
          existing.code.trim().toLowerCase() === 'key' &&
          (existing.quantity || 1) < 12
        ) {
          const curQty = Math.max(1, existing.quantity || 1)
          const addQty = Math.min(12 - curQty, remQty)
          existing.quantity = curQty + addQty
          if (existing.rawItemData !== undefined) {
            existing.rawItemData = { ...existing.rawItemData, quantity: existing.quantity }
          }
          remQty -= addQty
          this.emitToPlayer(player.unitId, {
            type: 'ItemEvent',
            action: 'update',
            itemId: existing.unitId,
            code: existing.code,
            x: existing.x,
            y: existing.y,
            container: 'inventory',
            item: this.serverEntryToItemData(existing),
          })
          if (remQty <= 0) {
            return
          }
        }
      }
      gItem.quantity = remQty
      if (!slot) {
        // Partial key stack filled existing key stacks; drop remaining keys back onto ground.
        gItem.ownerId = 0
        gItem.location = 'ground'
        this.groundItems.set(gItem.unitId, gItem)
        this.broadcastToArea(player.areaId, {
          type: 'ItemEvent',
          action: 'drop',
          itemId: gItem.unitId,
          code: gItem.code,
          x: gItem.x,
          y: gItem.y,
          container: 'ground',
          item: { ...this.serverEntryToItemData(gItem), action: 0x02 },
        })
        this.emitToPlayer(player.unitId, {
          type: 'PlaySound',
          unit: { unitType: 0, id: player.unitId },
          sound: 23,
        })
        return
      }
    }

    if (toCursor) {
      gItem.location = 'cursor'
      gItem.x = 0
      gItem.y = 0
    } else {
      gItem.location = 'inventory'
      gItem.x = slot!.x
      gItem.y = slot!.y
      gItem.storePage = 1
    }
    player.items.push(gItem)

    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'pickup',
      itemId: gItem.unitId,
      code: gItem.code,
      x: gItem.x,
      y: gItem.y,
      container: gItem.location,
      item: this.serverEntryToItemData(gItem),
    })
  }

  private findPlayerItemIndex(player: InternalPlayerRecord, itemId: number): number {
    const exact = player.items.findIndex((i) => i.unitId === itemId)
    if (exact !== -1) return exact
    if (itemId === 1 && player.items.length === 1) return 0
    return -1
  }

  private handleItemDrop(player: InternalPlayerRecord, itemId: number): void {
    const idx = this.findPlayerItemIndex(player, itemId)
    if (idx === -1) return
    const [item] = player.items.splice(idx, 1)
    if (!item) return

    const pos = this.findDropPosition(player.areaId, player.x, player.y, new Set())
    item.location = 'ground'
    item.ownerId = 0
    item.areaId = player.areaId
    item.x = pos.x
    item.y = pos.y
    this.groundItems.set(item.unitId, item)

    const itemData = this.serverEntryToItemData(item)
    this.broadcastToArea(player.areaId, {
      type: 'ItemEvent',
      action: 'drop',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: 'ground',
      item: {
        ...itemData,
        action: 0x02,
      },
    })
  }

  private handleItemMove(
    player: InternalPlayerRecord,
    itemId: number,
    x: number,
    y: number,
    container: 'inventory' | 'stash' | 'cube' | 'belt',
  ): void {
    const idx = this.findPlayerItemIndex(player, itemId)
    const item = idx !== -1 ? player.items[idx] : undefined
    if (!item) return

    const gridW = container === 'stash' ? 6 : container === 'cube' ? 3 : 10
    const gridH = container === 'stash' ? 8 : container === 'cube' ? 4 : 4
    if (x < 0 || y < 0 || x + item.width > gridW || y + item.height > gridH) {
      return
    }

    const overlaps: ServerItemEntry[] = []
    for (const other of player.items) {
      if (other.unitId === item.unitId || other.location !== container) continue
      const overlapX = x < other.x + other.width && x + item.width > other.x
      const overlapY = y < other.y + other.height && y + item.height > other.y
      if (overlapX && overlapY) overlaps.push(other)
    }
    if (overlaps.length > 0) {
      if (
        overlaps.length === 1 &&
        item.code.trim().toLowerCase() === 'key' &&
        overlaps[0]!.code.trim().toLowerCase() === 'key'
      ) {
        const target = overlaps[0]!
        const curQty = Math.max(1, target.quantity || 1)
        const srcQty = Math.max(1, item.quantity || 1)
        if (curQty < 12) {
          const addQty = Math.min(12 - curQty, srcQty)
          target.quantity = curQty + addQty
          if (target.rawItemData !== undefined) {
            target.rawItemData = { ...target.rawItemData, quantity: target.quantity }
          }
          if (srcQty > addQty) {
            item.quantity = srcQty - addQty
            if (item.rawItemData !== undefined) {
              item.rawItemData = { ...item.rawItemData, quantity: item.quantity }
            }
            this.emitToPlayer(player.unitId, {
              type: 'ItemEvent',
              action: 'update',
              itemId: item.unitId,
              code: item.code,
              x: item.x,
              y: item.y,
              container: toItemContainer(item.location),
              item: this.serverEntryToItemData(item),
            })
          } else {
            player.items.splice(idx, 1)
          }
          this.emitToPlayer(player.unitId, {
            type: 'ItemEvent',
            action: 'update',
            itemId: target.unitId,
            code: target.code,
            x: target.x,
            y: target.y,
            container,
            item: this.serverEntryToItemData(target),
          })
          return
        }
      }
      return
    }

    item.location = container
    item.x = x
    item.y = y
    item.storePage = container === 'stash' ? 4 : container === 'cube' ? 3 : 1
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'move',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: item.location,
      item: this.serverEntryToItemData(item),
    })
  }

  private handleItemEquip(
    player: InternalPlayerRecord,
    itemId: number,
    slot: number,
    removeOppositeHand = false,
  ): void {
    const idx = this.findPlayerItemIndex(player, itemId)
    const item = idx !== -1 ? player.items[idx] : undefined
    if (!item) return

    const oppositeSlot =
      removeOppositeHand
        ? slot === 4
          ? 5
          : slot === 5
            ? 4
            : slot === 11
              ? 12
              : slot === 12
                ? 11
                : 0
        : 0

    for (const other of player.items) {
      if (
        other.unitId !== item.unitId &&
        other.location === 'equipped' &&
        (other.bodyLoc === slot || (oppositeSlot > 0 && other.bodyLoc === oppositeSlot))
      ) {
        const free = this.findFreeGridSlot(
          player,
          'inventory',
          other.width,
          other.height,
          10,
          4,
        )
        other.location = 'inventory'
        other.bodyLoc = 0
        other.x = free?.x ?? 0
        other.y = free?.y ?? 0
        other.storePage = 1
        this.emitToPlayer(player.unitId, {
          type: 'ItemEvent',
          action: 'unequip',
          itemId: other.unitId,
          code: other.code,
          x: other.x,
          y: other.y,
          container: 'inventory',
          item: this.serverEntryToItemData(other),
        })
      }
    }

    item.location = 'equipped'
    item.bodyLoc = slot
    item.storePage = 0
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'equip',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: 'equipment',
      item: this.serverEntryToItemData(item),
    })
  }

  private handleItemUnequip(player: InternalPlayerRecord, slot: number): void {
    const item = player.items.find(
      (i) => i.location === 'equipped' && i.bodyLoc === slot,
    )
    if (!item) return
    const free = this.findFreeGridSlot(
      player,
      'inventory',
      item.width,
      item.height,
      10,
      4,
    )
    item.location = 'inventory'
    item.bodyLoc = 0
    item.x = free?.x ?? 0
    item.y = free?.y ?? 0
    item.storePage = 1
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'unequip',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: 'inventory',
      item: this.serverEntryToItemData(item),
    })
  }

  private handleBeltPut(
    player: InternalPlayerRecord,
    itemId: number,
    slot: number,
  ): void {
    const idx = this.findPlayerItemIndex(player, itemId)
    const item = idx !== -1 ? player.items[idx] : undefined
    if (!item) return
    item.location = 'belt'
    item.x = Math.max(0, Math.min(15, slot))
    item.y = 0
    item.storePage = 0
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'beltPut',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: 0,
      container: 'belt',
      item: this.serverEntryToItemData(item),
    })
  }

  private handleBeltUse(player: InternalPlayerRecord, itemId: number): void {
    const idx = this.findPlayerItemIndex(player, itemId)
    if (idx === -1) return
    const [item] = player.items.splice(idx, 1)
    if (!item) return

    const itemCode = item.code.toLowerCase().trim()
    // 1.13c consumable quest items: Book of Skill ('ass'), Potion of Life ('xyz'),
    // and Scroll of Resistance ('tr2').
    if (itemCode === 'ass' || itemCode === 'xyz' || itemCode === 'tr2') {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: toItemContainer(item.location),
      })
      const questId = itemCode === 'ass' ? 'a2q1' : itemCode === 'xyz' ? 'a3q1' : 'a5q3'
      if (!this.setPlayerQuestFlag(player, questId, QUEST_FLAG_COMPLETED_113C)) {
        this.grantQuestCompletionReward113c(player, questId)
      }
      return
    }

    if (item.code.startsWith('hp') || item.code.startsWith('rv')) {
      player.hpFixed = Math.min(
        player.maxHpFixed,
        player.hpFixed + 30 * FIXED_ONE,
      )
      player.hp = Math.floor(player.hpFixed / FIXED_ONE)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 6,
        value: player.hpFixed,
      })
    }
    if (item.code.startsWith('mp') || item.code.startsWith('rv')) {
      player.manaFixed = Math.min(
        player.maxManaFixed,
        player.manaFixed + 30 * FIXED_ONE,
      )
      player.mana = Math.floor(player.manaFixed / FIXED_ONE)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 8,
        value: player.manaFixed,
      })
    }
    this.emitToPlayer(player.unitId, {
      type: 'LifeMana',
      life: player.hp,
      mana: player.mana,
      stamina: player.stamina,
      at: playerWirePosition(player),
      vx: 0,
      vy: 0,
    })
  }

  private findFreeGridSlot(
    player: InternalPlayerRecord,
    container: 'inventory' | 'stash' | 'cube',
    w: number,
    h: number,
    gridW: number,
    gridH: number,
  ): { x: number; y: number } | undefined {
    for (let y = 0; y <= gridH - h; y++) {
      for (let x = 0; x <= gridW - w; x++) {
        let collision = false
        for (const other of player.items) {
          if (other.location !== container) continue
          const ox = x < other.x + other.width && x + w > other.x
          const oy = y < other.y + other.height && y + h > other.y
          if (ox && oy) {
            collision = true
            break
          }
        }
        if (!collision) return { x, y }
      }
    }
    return undefined
  }

  private handleItemToCursor(player: InternalPlayerRecord, itemId: number): void {
    const item = player.items.find(
      (candidate) =>
        candidate.unitId === itemId &&
        (candidate.location === 'inventory' || candidate.location === 'stash' || candidate.location === 'cube'),
    )
    if (!item || player.items.some((candidate) => candidate.location === 'cursor')) return
    item.location = 'cursor'
    item.x = 0
    item.y = 0
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x05,
      itemId: item.unitId,
      code: item.code,
      x: 0,
      y: 0,
      container: 'cursor',
      item: this.serverEntryToItemData(item),
    })
  }

  private handleCursorArtisanService(
    player: InternalPlayerRecord,
    npcId: number,
    itemId: number,
  ): boolean {
    const item = player.items.find(
      (candidate) => candidate.unitId === itemId && candidate.location === 'cursor',
    )
    const npc = item && this.resolveServiceNpc(player, npcId)
    if (!item || !npc || !getTownNpcDescriptorByHcIdx(npc.hcIdx)?.questRewardActions?.[0]) {
      return false
    }
    const slot = this.findFreeGridSlot(player, 'inventory', item.width, item.height, 10, 4)
    item.location = 'inventory'
    item.x = slot?.x ?? 0
    item.y = slot?.y ?? 0
    item.storePage = 1
    const rewarded = this.handleArtisanService(player, npcId, itemId)
    if (!rewarded) {
      item.location = 'cursor'
      item.x = 0
      item.y = 0
    }
    if (!rewarded || !slot) this.handleItemDrop(player, itemId)
    this.emitToPlayer(player.unitId, {
      type: 'OpenUi',
      unitType: 1,
      unitId: npcId,
      uiId: rewarded ? 6 : 7,
    })
    return true
  }

  /** Charsi imbue / Larzuk sockets / Anya personalize (quest reward actions). */
  private handleArtisanService(
    player: InternalPlayerRecord,
    npcId: number,
    itemId: number,
  ): boolean {
    const npc = this.resolveServiceNpc(player, npcId)
    if (!npc) return false
    const action = getTownNpcDescriptorByHcIdx(npc.hcIdx)?.questRewardActions?.[0]
    if (!action) return false
    const item = player.items.find(
      (candidate) =>
        candidate.unitId === itemId &&
        (candidate.location === 'inventory' ||
          candidate.location === 'equipped' ||
          candidate.location === 'cursor'),
    )
    if (!item) return false
    const resultContainer =
      item.location === 'equipped'
        ? 'equipment'
        : item.location === 'cursor'
          ? 'cursor'
          : 'inventory'
    // 1.13c quest rewards are one-shot: require and consume the completed/pending
    // quest flag for Charsi (a1q5), Larzuk (a5q1) and Anya (a5q4).
    const questId =
      action === 'imbue' ? 'a1q5' : action === 'add_sockets' ? 'a5q1' : 'a5q4'
    const questIndexForReward = questWordIndex113c(questId)
    const questBits =
      questIndexForReward === undefined ? 0 : (player.questFlags[questIndexForReward] ?? 0)
    const hasPendingReward =
      (questBits & QUEST_FLAG_REWARD_PENDING_113C) !== 0 ||
      ((questBits & QUEST_FLAG_COMPLETED_113C) !== 0 &&
        (questBits & QUEST_FLAG_COMPLETED_NOW_113C) === 0)
    if (!hasPendingReward) {
      return false
    }
    if (action === 'imbue') {
      if (
        !isEligibleForCharsiImbue113c(
          {
            code: item.code,
            identified: item.identified,
            quality: item.quality,
            sockets: item.totalSockets,
            socketed: item.socketed,
            socketedItems: item.socketedItems,
            ethereal: item.ethereal,
          },
          getEmbeddedDropTables(),
        )
      ) {
        return false
      }
      const imbued = finalizeDroppedItem113c(imbueItem113c(
        {
          code: item.code,
          identified: item.identified,
          quality: item.quality,
          sockets: item.totalSockets,
          socketed: item.socketed,
          socketedItems: item.socketedItems,
          ethereal: item.ethereal,
          ...(item.rawItemData?.personalized === true
            ? {
                personalized: true,
                personalizedName: item.rawItemData.personalizedName ?? player.name,
              }
            : {}),
        } as never,
        player.level,
        {
          dropTables: getEmbeddedDropTables(),
          rng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
        },
      ) as never)
      const index = player.items.findIndex((candidate) => candidate.unitId === item.unitId)
      const replacement = this.createServerEntryFromItem(imbued as never, {
        location: item.location,
        x: item.x,
        y: item.y,
        areaId: item.areaId,
        ownerId: item.ownerId,
        storePage: item.storePage,
        gamble: false,
      })
      replacement.unitId = item.unitId
      replacement.bodyLoc = item.bodyLoc
      replacement.quality = 'rare' as never
      if (replacement.rawItemData !== undefined) {
        replacement.rawItemData = {
          ...replacement.rawItemData,
          id: item.unitId,
          itemId: item.unitId,
        }
      }
      if (index !== -1) player.items[index] = replacement
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action,
        itemId: replacement.unitId,
        code: replacement.code,
        x: replacement.x,
        y: replacement.y,
        container: resultContainer,
        item: this.serverEntryToItemData(replacement),
      })
    } else if (action === 'add_sockets') {
      if (item.socketed || item.totalSockets > 0 || item.rawItemData?.socketed === true) return false
      // 1.13c ITEMS_GetMaxSockets: min(base.gemsockets, ItemTypes tier cap,
      // grid area). Non-socketable bases (rings, boots, potions, stackables) reject
      // without consuming the Larzuk reward.
      const tables = getEmbeddedDropTables()
      const base = tables.getBase(item.code) as
        | (Record<string, unknown> & {
            type?: string
            gemsockets?: number
            invWidth?: number
            invHeight?: number
            stackable?: boolean
          })
        | undefined
      if (base?.stackable === true) return false
      const typeDef = base?.type !== undefined ? tables.itemTypes.byCode.get(String(base.type)) : undefined
      const typeCap =
        typeDef === undefined
          ? Number(base?.gemsockets ?? 0)
          : item.level >= 40
            ? typeDef.maxSock40
            : item.level >= 25
              ? typeDef.maxSock25
              : typeDef.maxSock1
      const gridArea =
        Math.max(1, Number(base?.invWidth ?? item.width)) *
        Math.max(1, Number(base?.invHeight ?? item.height))
      const maxSockets = Math.min(
        Number(base?.gemsockets ?? 0),
        Number(typeCap ?? 0),
        gridArea,
      )
      if (maxSockets <= 0) return false
      const qualityCode = this.normalizeItemQualityCode113c(
        item.rawItemData?.quality ?? item.quality,
      )
      let sockets: number
      if (qualityCode <= 3) {
        sockets = maxSockets
      } else if (qualityCode === 4) {
        sockets = Math.min(maxSockets, this.rng.rand(2) === 0 ? 1 : 2)
      } else {
        sockets = Math.min(maxSockets, 1)
      }
      item.socketed = true
      item.totalSockets = sockets
      if (item.rawItemData !== undefined) {
        const nextFlags = Number(item.rawItemData.flags ?? 0) | 0x800
        const nextRawFlags =
          Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0) | 0x800
        item.rawItemData = {
          ...item.rawItemData,
          socketed: true,
          totalSockets: sockets,
          flags: nextFlags,
          rawFlags: nextRawFlags,
        }
      }
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action,
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: resultContainer,
        item: this.serverEntryToItemData(item),
      })
    } else {
      if (
        item.rawItemData?.personalized === true ||
        item.name.startsWith(`${player.name}'s `)
      ) {
        return false
      }
      // 1.13c Anya: only non-stackable, non-quest Armor.txt / Weapons.txt bases
      // (plus Wirt's Leg) can be personalized.
      const tables = getEmbeddedDropTables()
      const base = tables.getBase(item.code) as
        | (Record<string, unknown> & {
            kind?: string
            stackable?: boolean
            quest?: number
          })
        | undefined
      if (base === undefined || (base.kind !== 'armor' && base.kind !== 'weapon')) return false
      const trimmedCode = item.code.trim().toLowerCase()
      if (base.stackable === true || (Number(base.quest ?? 0) > 0 && trimmedCode !== 'leg')) {
        return false
      }
      item.name = `${player.name}'s ${item.name}`
      if (item.rawItemData !== undefined) {
        const nextFlags = Number(item.rawItemData.flags ?? 0) | 0x01000000
        const nextRawFlags =
          Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0) | 0x01000000
        item.rawItemData = {
          ...item.rawItemData,
          personalized: true,
          personalizedName: player.name,
          flags: nextFlags,
          rawFlags: nextRawFlags,
        }
      } else {
        item.rawItemData = {
          personalized: true,
          personalizedName: player.name,
          flags: 0x01000000,
          rawFlags: 0x01000000,
        } as never
      }
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action,
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: resultContainer,
        item: this.serverEntryToItemData(item),
      })
    }
    if (item.location === 'cursor') {
      const uiId = action === 'imbue' ? 0x06 : action === 'add_sockets' ? 0x0e : 0x0f
      this.emitToPlayer(player.unitId, {
        type: 'OpenUi',
        uiId,
        unitType: 1,
        unitId: npc.unitId,
        extra: 0,
      })
    }
    const questIndex = questWordIndex113c(questId)
    if (questIndex !== undefined) {
      player.questFlags[questIndex] =
        ((player.questFlags[questIndex] ?? 0) &
          ~(QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_113C)) |
        QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_COMPLETED_NOW_113C
      this.emitQuestLog(player)
    }
    return true
  }

  private normalizeItemQualityCode113c(rawQuality: unknown): number {
    if (typeof rawQuality === 'number' && Number.isFinite(rawQuality) && rawQuality >= 1 && rawQuality <= 9) {
      return Math.trunc(rawQuality)
    }
    if (typeof rawQuality === 'string') {
      switch (rawQuality.trim().toLowerCase()) {
        case 'low':
        case 'inferior':
        case 'crude':
        case 'damaged':
          return 1
        case 'normal':
          return 2
        case 'superior':
          return 3
        case 'magic':
          return 4
        case 'set':
          return 5
        case 'rare':
          return 6
        case 'unique':
          return 7
        case 'crafted':
          return 8
        case 'tempered':
          return 9
      }
    }
    return 2
  }

  private resolveServiceNpc(
    player: InternalPlayerRecord,
    npcId: number,
  ): InternalMonsterRecord | undefined {
    const npc = this.monsters.get(npcId)
    if (npc) {
      if (!npc.isNpc || npc.areaId !== player.areaId) return undefined
      if (player.activeNpcId !== undefined && player.activeNpcId !== npcId) return undefined
      if (!this.playerInNpcRange(player, npc)) return undefined
    } else if (player.activeNpcId !== undefined) {
      return undefined
    }
    return npc
  }

  /** Resolve an NPC and require the descriptor capability advertised by Npc.txt. */
  private serviceNpcWithCapability(
    player: InternalPlayerRecord,
    npcId: number,
    capability: 'canRepair' | 'canIdentify' | 'canHeal' | 'canHire' | 'canResurrectMerc',
  ): InternalMonsterRecord | undefined {
    const npc = this.resolveServiceNpc(player, npcId)
    if (npc === undefined) return undefined
    const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
    return descriptor?.[capability] === true ? npc : undefined
  }

  private spendGold(player: InternalPlayerRecord, cost: number): boolean {
    if (cost <= 0) return true
    if (player.gold + player.goldBank < cost) return false
    let spentFromBank = false
    if (player.gold >= cost) {
      player.gold -= cost
    } else {
      const rem = cost - player.gold
      player.gold = 0
      player.goldBank = Math.max(0, player.goldBank - rem)
      spentFromBank = rem > 0
    }
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 14,
      value: player.gold,
    })
    if (spentFromBank) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 15,
        value: player.goldBank,
      })
    }
    return true
  }

  /**
   * 1.13c `D2COMMON_10795_ITEMS_GetMaxStack` (`0x6fd760f0`) & `isRefillableThrowing` (`0x6fd74f00`):
   * resolves max stack for a repairable throwing weapon (`ItemTypes.txt` `Repair && Throwable` + `stackable`).
   */
  private resolveRefillableThrowingMaxStack113c(
    item: ServerItemEntry,
    tables: TransactionCostTables,
  ): number {
    if (item.ethereal || item.rawItemData?.ethereal === true) return 0
    const code = item.code.trim()
    const itemRec = tables.items.get(code) ?? tables.items.get(code.toLowerCase())
    const itemTypeRec = itemRec ? tables.itemTypes.get(itemRec.type) : undefined
    const isRefillable = Boolean(
      itemRec && itemTypeRec && itemTypeRec.repair && itemTypeRec.throwable && itemRec.stackable,
    )
    const rawItem = item.rawItemData as Record<string, unknown> | undefined
    const rawBase = rawItem?.base as { maxStack?: number } | undefined
    const fallbackMax = Number(rawBase?.maxStack ?? rawItem?.maxStack ?? 0)
    if (!isRefillable) return 0
    const extraStack =
      (item.stats.get(254) ?? 0) ||
      (item.rawItemData?.stats.find((s) => s.statId === 254)?.value ?? 0)
    const canonicalMax = itemRec ? Math.min(511, itemRec.maxStack + extraStack) : 0
    return Math.max(canonicalMax, fallbackMax)
  }

  /** Whether `item` has depleted durability, refillable throwing stack, or `statId 204` charges (`0x6FCDE010`). */
  private doesEntryNeedRepair113c(item: ServerItemEntry, tables: TransactionCostTables): boolean {
    if (item.ethereal || item.rawItemData?.ethereal === true) return false
    const quality = this.normalizeItemQualityCode113c(item.rawItemData?.quality ?? item.quality)
    if (quality >= 4 && (!item.identified || item.rawItemData?.identified === false)) return false
    const isIndestructible =
      (item.stats.get(152) ?? 0) > 0 ||
      Boolean(item.rawItemData?.stats.some((s) => s.statId === 152 && s.value > 0)) ||
      Boolean(item.rawItemData?.runewordStats?.some((s) => s.statId === 152 && s.value > 0))
    if (!isIndestructible && item.maxDurability > 0 && item.durability < item.maxDurability) {
      return true
    }
    const maxStack = this.resolveRefillableThrowingMaxStack113c(item, tables)
    if (maxStack > 0 && item.quantity < maxStack) return true
    if (item.rawItemData?.stats.some((s) => s.statId === 204 && (s.value & 0xff) < ((s.value >> 8) & 0xff))) {
      return true
    }
    if (
      item.rawItemData?.runewordStats?.some(
        (s) => s.statId === 204 && (s.value & 0xff) < ((s.value >> 8) & 0xff),
      )
    ) {
      return true
    }
    const stat204 = item.stats.get(204)
    if (stat204 !== undefined && (stat204 & 0xff) < ((stat204 >> 8) & 0xff)) return true
    const charged = (item.rawItemData as Record<string, unknown> | undefined)?.chargedSkills
    if (Array.isArray(charged)) {
      for (const entry of charged as { charges?: number; maxCharges?: number }[]) {
        if (entry.maxCharges !== undefined && (entry.charges ?? 0) < entry.maxCharges) return true
      }
    }
    return false
  }

  /**
   * 1.13c `D2Game.dll` `NPC_RepairItem` (`0x6FCDE010`): restores durability, refillable throwing stack
   * (`STAT_QUANTITY = 70`), and charged skill charges (`STAT_ITEM_CHARGED_SKILL = 204`), skipping ethereal
   * and indestructible items, and keeps `item.rawItemData` in sync.
   */
  private repairSingleItemEntry(item: ServerItemEntry, tables: TransactionCostTables): boolean {
    if (item.ethereal || item.rawItemData?.ethereal === true) return false
    const quality = this.normalizeItemQualityCode113c(item.rawItemData?.quality ?? item.quality)
    if (quality >= 4 && (!item.identified || item.rawItemData?.identified === false)) return false
    const isIndestructible =
      (item.stats.get(152) ?? 0) > 0 ||
      Boolean(item.rawItemData?.stats.some((s) => s.statId === 152 && s.value > 0)) ||
      Boolean(item.rawItemData?.runewordStats?.some((s) => s.statId === 152 && s.value > 0))
    let changed = false
    if (!isIndestructible && item.maxDurability > 0 && item.durability < item.maxDurability) {
      item.durability = item.maxDurability
      if (item.stats.has(72)) item.stats.set(72, item.maxDurability)
      if (item.rawItemData !== undefined) {
        item.rawItemData = {
          ...item.rawItemData,
          durability: item.maxDurability,
          curDurability: item.maxDurability,
          broken: false,
          stats: item.rawItemData.stats.map((s) =>
            s.statId === 72 ? { ...s, value: item.maxDurability } : s,
          ),
        }
      }
      changed = true
    }
    const maxStack = this.resolveRefillableThrowingMaxStack113c(item, tables)
    if (maxStack > 0 && item.quantity < maxStack) {
      item.quantity = maxStack
      if (item.stats.has(70)) item.stats.set(70, maxStack)
      if (item.rawItemData !== undefined) {
        item.rawItemData = {
          ...item.rawItemData,
          quantity: maxStack,
          stats: item.rawItemData.stats.map((s) =>
            s.statId === 70 ? { ...s, value: maxStack } : s,
          ),
        }
      }
      changed = true
    }
    if (item.rawItemData !== undefined) {
      let statsChanged = false
      const nextStats = item.rawItemData.stats.map((s) => {
        if (s.statId !== 204) return s
        const curCharges = s.value & 0xff
        const maxCharges = (s.value >> 8) & 0xff
        if (maxCharges <= 0 || curCharges >= maxCharges) return s
        statsChanged = true
        const refilled = (s.value & ~0xff) | maxCharges
        item.stats.set(204, refilled)
        return { ...s, value: refilled }
      })
      let rwChanged = false
      const nextRwStats = (item.rawItemData.runewordStats ?? []).map((s) => {
        if (s.statId !== 204) return s
        const curCharges = s.value & 0xff
        const maxCharges = (s.value >> 8) & 0xff
        if (maxCharges <= 0 || curCharges >= maxCharges) return s
        rwChanged = true
        const refilled = (s.value & ~0xff) | maxCharges
        item.stats.set(204, refilled)
        return { ...s, value: refilled }
      })
      if (statsChanged || rwChanged) {
        item.rawItemData = {
          ...item.rawItemData,
          stats: statsChanged ? nextStats : item.rawItemData.stats,
          ...(rwChanged ? { runewordStats: nextRwStats } : {}),
        }
        changed = true
      }
    }
    const stat204 = item.stats.get(204)
    if (stat204 !== undefined) {
      const curCharges = stat204 & 0xff
      const maxCharges = (stat204 >> 8) & 0xff
      if (maxCharges > 0 && curCharges < maxCharges) {
        item.stats.set(204, (stat204 & ~0xff) | maxCharges)
        changed = true
      }
    }
    const rawItem = item.rawItemData as Record<string, unknown> | undefined
    const charged = rawItem?.chargedSkills
    if (Array.isArray(charged)) {
      for (const entry of charged as { charges?: number; maxCharges?: number }[]) {
        if (entry.maxCharges !== undefined && (entry.charges ?? 0) < entry.maxCharges) {
          entry.charges = entry.maxCharges
          changed = true
        }
      }
    }
    return changed
  }

  /** NpcRepairItem / NpcRepairAll (#10071 repair pricing). */
  private handleNpcRepair(
    player: InternalPlayerRecord,
    npcId: number,
    itemId?: number,
  ): void {
    const npc = this.serviceNpcWithCapability(player, npcId, 'canRepair')
    if (npc === undefined) return
    const targets =
      itemId !== undefined
        ? player.items.filter((item) => item.unitId === itemId)
        : player.items.filter((item) => item.location === 'equipped')
    // Repair-all uses D2Common #10071 (`computeRepairAllCost113c`), which also
    // covers refillable throwing stacks and charged items. Single-item repair
    // keeps the per-item #10107 type-3 path.
    const ctx = this.transactionCostContext(player, npc.hcIdx)
    let total = 0
    if (itemId === undefined) {
      const slots: (TransactionCostInput | null)[] = new Array(13).fill(null)
      for (const item of targets) {
        if (item.bodyLoc > 0 && item.bodyLoc < 13) {
          slots[item.bodyLoc] = this.transactionInputFromEntry(item)
        } else {
          slots.push(this.transactionInputFromEntry(item))
        }
      }
      total = computeRepairAllCost113c(slots, ctx)
    } else {
      for (const item of targets) {
        if (!this.doesEntryNeedRepair113c(item, ctx.tables)) continue
        total += this.serverItemPrice113c(player, npc.hcIdx, item, 3)
      }
    }
    if (total <= 0 || !this.spendGold(player, total)) return
    for (const item of targets) {
      if (!this.repairSingleItemEntry(item, ctx.tables)) continue
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'repair',
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: toItemContainer(item.location),
        item: this.serverEntryToItemData(item),
      })
    }
  }

  private identifyItem(player: InternalPlayerRecord, item: ServerItemEntry): void {
    if (item.identified) return
    item.identified = true
    if (item.rawItemData !== undefined) {
      const nextFlags = Number(item.rawItemData.flags ?? 0) | 0x10
      const nextRawFlags =
        Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0) | 0x10
      item.rawItemData = {
        ...item.rawItemData,
        identified: true,
        flags: nextFlags,
        rawFlags: nextRawFlags,
      }
    }
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'identify',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: item.location === 'equipped' ? 'equipment' : 'inventory',
      item: this.serverEntryToItemData(item),
    })
  }

  /** NpcIdentifyAll (Deckard Cain): identify every unidentified carried item. */
  private handleNpcIdentifyAll(player: InternalPlayerRecord, npcId: number): void {
    const npc = this.serviceNpcWithCapability(player, npcId, 'canIdentify')
    if (npc === undefined) return
    for (const item of player.items) {
      if (item.location === 'inventory' || item.location === 'equipped') {
        this.identifyItem(player, item)
      }
    }
  }

  private handleNpcIdentifyItem(
    player: InternalPlayerRecord,
    npcId: number,
    itemId: number,
  ): void {
    const npc = this.resolveServiceNpc(player, npcId)
    if (npc === undefined) return
    const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
    if (descriptor?.canIdentify !== true && descriptor?.canGamble !== true) return
    const item = player.items.find((candidate) => candidate.unitId === itemId)
    if (item) this.identifyItem(player, item)
  }

  /** 0x4F + 0x4E: send the hire list for a mercenary vendor's act. */
  private handleNpcHireList(player: InternalPlayerRecord, npcId: number): void {
    const npc = this.serviceNpcWithCapability(player, npcId, 'canHire')
    if (npc === undefined) return
    const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
    const act = (descriptor?.actIndex ?? 0) + 1
    const difficulty = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
    this.emitToPlayer(player.unitId, { type: 'Merc', kind: 'hireList' })
    for (const record of HIRELING_RECORDS) {
      if (record.act !== act) continue
      if (record.difficulty !== undefined && record.difficulty !== difficulty + 1) continue
      this.emitToPlayer(player.unitId, {
        type: 'Merc',
        kind: 'hireList',
        nameId: record.id,
        value: record.subTypeId,
      })
    }
  }

  /** HireMerc/MercHire: deduct Hireling.txt hireCost and assign the mercenary. */
  private handleNpcHire(
    player: InternalPlayerRecord,
    npcId: number,
    mercId: number,
  ): void {
    const npc = this.resolveServiceNpc(player, npcId)
    const descriptor = npc ? getTownNpcDescriptorByHcIdx(npc.hcIdx) : undefined
    if (npc === undefined || !descriptor?.canHire) return
    const act = ((descriptor?.actIndex ?? 0) + 1) as 1 | 2 | 3 | 5
    const difficulty = (this.difficulty + 1) as 1 | 2 | 3
    const record = HIRELING_RECORDS.find(
      (entry) =>
        (entry.id === mercId || entry.subTypeId === mercId) &&
        entry.act === act &&
        (entry.difficulty === undefined || entry.difficulty === difficulty),
    )
    if (record === undefined) return
    const cost = record.hireCost ?? 100
    if (!this.spendGold(player, cost)) return
    this.hireMercenary(player.unitId, {
      act,
      subType: record.subTypeId,
      level: player.level,
      difficulty,
    })
  }

  /** Resurrect the player's dead mercenary at the NPC. */
  private handleMercResurrect(player: InternalPlayerRecord, npcId: number): void {
    const npc = this.resolveServiceNpc(player, npcId)
    if (npc === undefined) return
    const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
    // 1.13c: mercenary captains (canHire) and Tyrael (canResurrectMerc) revive mercs.
    if (descriptor?.canHire !== true && descriptor?.canResurrectMerc !== true) return
    const merc = [...this.mercenaries.values()].find(
      (entry) => entry.ownerPlayerId === player.unitId,
    )
    if (!merc || merc.alive) return
    const cost = Math.max(1, merc.level * 100)
    this.emitToPlayer(player.unitId, {
      type: 'Merc',
      kind: 'stat',
      nameId: merc.subType,
      value: cost,
    })
    if (!this.spendGold(player, cost)) return
    merc.alive = true
    merc.state = 'follow'
    merc.hp = merc.maxHp
    merc.areaId = player.areaId
    merc.x = player.x + 1
    merc.y = player.y + 1
    this.broadcastToArea(merc.areaId, {
      type: 'UnitAssign',
      unitType: 'monster',
      unitId: merc.unitId,
      classId: merc.classId,
      name: merc.name,
      x: merc.x,
      y: merc.y,
      areaId: merc.areaId,
      unit: {
        unitType: 1,
        id: merc.unitId,
        classId: merc.classId,
        name: merc.name,
        x: merc.x,
        y: merc.y,
        mode: 1,
        lifePct: 128,
      },
    })
    this.broadcastToArea(merc.areaId, {
      type: 'Merc',
      kind: 'assign',
      mercId: merc.unitId,
      ownerId: player.unitId,
      classId: merc.classId,
    })
    this.broadcastToArea(merc.areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId: merc.unitId,
      statId: 12,
      value: Math.max(1, Math.floor(merc.level)),
    })
    this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
    this.syncMercenaryOwnerAura(player, merc.activeAura)
  }

  private handleNpcInteract(
    player: InternalPlayerRecord,
    npcId: number,
    healRequested = false,
  ): void {
    const npc = this.monsters.get(npcId)
    // Static quest NPCs may not have a runtime record in synthetic tests; when one
    // exists, enforce the 1.13c #10407 arrival reach.
    if (
      npc &&
      (!npc.isNpc ||
        npc.areaId !== player.areaId ||
        !this.playerInNpcRange(player, npc) ||
        !this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y))
    ) {
      if (npc && npc.isNpc && npc.areaId === player.areaId && player.pendingInteraction === undefined) {
        player.pendingInteraction = { kind: 'npc', id: npcId }
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = undefined
      }
      return
    }
    player.pendingInteraction = undefined
    player.pendingInteractionSteps = 0
    player.pendingNpcGamble = undefined
    player.activeNpcId = npcId
    // A1Q3: Akara translates the Scroll of Inifuss ('bks') into the Key to the Cairn Stones ('bkd').
    if (npc?.hcIdx === 148) {
      const scroll = player.items.find(
        (item) => item.code.toLowerCase().trim() === 'bks',
      )
      if (scroll !== undefined) {
        this.removePlayerQuestItem(player, scroll)
        this.givePlayerInventoryQuestItem(player, 'bkd', npc)
        this.setPlayerQuestFlag(player, 'a1q3', QUEST_FLAG_STARTED_113C)
      }
    }
    // A3Q1: Alkor exchanges the Jade Figurine for the Golden Bird (+20 Max Life).
    if (npc?.hcIdx === 254) {
      const figurine = player.items.find(
        (item) => item.code.toLowerCase().trim() === 'j34',
      )
      if (figurine !== undefined) {
        this.removePlayerQuestItem(player, figurine)
        this.setPlayerQuestFlag(player, 'a3q1', QUEST_FLAG_COMPLETED_113C)
      }
    }
    // Quest turn-ins handled by the canonical NPC.
    if (npc?.hcIdx === 255) {
      // Ormus accepts the Gidbinn dagger.
      const dagger = player.items.find(
        (item) => item.code.toLowerCase().trim() === 'g33',
      )
      if (dagger !== undefined) {
        this.removePlayerQuestItem(player, dagger)
        this.setPlayerQuestFlag(player, 'a3q2', QUEST_FLAG_COMPLETED_113C)
      }
    } else if (npc?.hcIdx === 513) {
      const idx = questWordIndex113c('a5q3')
      const bits = idx === undefined ? 0 : (player.questFlags[idx] ?? 0)
      if (
        (bits & QUEST_FLAG_REWARD_PENDING_113C) !== 0 &&
        (bits & QUEST_FLAG_COMPLETED_113C) === 0
      ) {
        if (idx !== undefined) {
          player.questFlags[idx] = bits & ~QUEST_FLAG_REWARD_PENDING_113C
        }
        if (!this.playerOrGroundHasQuestItem(player, 'tr2')) {
          this.givePlayerInventoryQuestItem(player, 'tr2', npc)
        }
        this.setPlayerQuestFlag(
          player,
          'a5q3',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
      } else if (
        (bits &
          (QUEST_FLAG_COMPLETED_113C |
            QUEST_FLAG_REWARD_PENDING_113C |
            QUEST_FLAG_PRIMARY_GOAL_DONE_113C)) ===
          0 &&
        !this.playerOrGroundHasQuestItem(player, 'ice')
      ) {
        // Malah gives the thawing potion once (inventory or ground drop if full).
        this.givePlayerInventoryQuestItem(player, 'ice', npc)
        this.setPlayerQuestFlag(
          player,
          'a5q3',
          QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
        )
      }
    } else if (npc?.hcIdx === 254 || npc?.hcIdx === 515 || npc?.hcIdx === 146) {
      const turnInQuests =
        npc.hcIdx === 254 ? ['a3q1', 'a3q4'] : npc.hcIdx === 515 ? ['a5q2'] : ['a3q4']
      for (const turnInQuest of turnInQuests) {
        const idx = questWordIndex113c(turnInQuest)
        const bits = idx === undefined ? 0 : (player.questFlags[idx] ?? 0)
        if (
          (bits & QUEST_FLAG_REWARD_PENDING_113C) !== 0 &&
          (bits & QUEST_FLAG_COMPLETED_113C) === 0
        ) {
          if (idx !== undefined) {
            player.questFlags[idx] = bits & ~QUEST_FLAG_REWARD_PENDING_113C
          }
          this.setPlayerQuestFlag(
            player,
            turnInQuest,
            QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
          )
        }
      }
    }
    const canHeal =
      getTownNpcDescriptorByHcIdx(npc !== undefined ? npc.hcIdx : npcId)?.canHeal === true
    void healRequested
    if (canHeal) {
      player.hpFixed = player.maxHpFixed
      player.hp = player.maxHp
      player.manaFixed = player.maxManaFixed
      player.mana = player.maxMana
      player.staminaFixed = player.maxStaminaFixed
      player.stamina = player.maxStamina
      // 1.13c healers clear negative states only; buffs/auras/forms persist.
      for (const stateId of [
        1, 2, 9, 11, 17, 19, 21, 23, 24, 25, 27, 28, 29, 43, 44, 52, 53, 55, 56, 57, 58, 59, 60,
        61, 62, 84, 85, 87, 89, 112, 113, 114, 115, 156,
      ]) {
        this.clearUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          stateId,
        )
      }
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 6,
        value: player.hpFixed,
      })
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 8,
        value: player.manaFixed,
      })
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 10,
        value: player.staminaFixed,
      })
      this.emitPlayerVitals(player)
      for (const merc of this.mercenaries.values()) {
        if (merc.ownerPlayerId === player.unitId && merc.alive) {
          merc.hp = merc.maxHp
          this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
        }
      }
      const mgr = this.summonManagers.get(player.unitId)
      if (mgr) {
        for (const pet of mgr.getActivePets()) {
          if (pet.alive !== false && pet.maxHp > 0) {
            pet.hp = pet.maxHp
            const petUnitId = this.petUnitIds.get(pet.uid)
            if (petUnitId !== undefined) {
              this.broadcastAllyHp(player.areaId, petUnitId, pet.hp)
            }
          }
        }
      }
    }
    this.emitNpcTravelOptions(player, npc)
  }

  /** Quest flag required by a forward NPC travel action from the player's current act. */
  private npcTravelQuestGate(currentAct: number, action: string): string | undefined {
    if (action === 'travel_west') return undefined
    // Act 4 has 3 quests in 1.13c (`a4q1`, `a4q2`, `a4q3`); Terror's End (Diablo) is `a4q3` (word 26).
    if (action === 'travel_harrogath') return currentAct === 3 ? 'a4q3' : undefined
    if (action === 'travel_east') {
      if (currentAct === 0) return 'a1q6'
      if (currentAct === 1) return 'a2q6'
      if (currentAct === 2) return 'a3q6'
    }
    return undefined
  }

  private npcTravelDestinationAct(currentAct: number, action: string): number | undefined {
    if (action === 'travel_west') return currentAct > 0 ? currentAct - 1 : undefined
    if (action === 'travel_east' || action === 'travel_harrogath') {
      return currentAct + 1 < ACT_TOWN_AREAS.length ? currentAct + 1 : undefined
    }
    return undefined
  }

  /** S2C 0x61 CanGoToAct for travel NPCs (Warriv/Meshif/Tyrael), gated by act progression. */
  private emitNpcTravelOptions(
    player: InternalPlayerRecord,
    npc: InternalMonsterRecord | undefined,
  ): void {
    if (!npc) return
    const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
    if (!descriptor?.travelActions?.length) return
    const currentAct = areaToAct(player.areaId)
    if (descriptor.actIndex !== currentAct) return
    for (const action of descriptor.travelActions) {
      const destAct = this.npcTravelDestinationAct(currentAct, action)
      if (destAct === undefined) continue
      const questId = this.npcTravelQuestGate(currentAct, action)
      if (questId !== undefined && !hasQuestFlag113c(player.questFlags, questId, QUEST_FLAG_COMPLETED_113C)) {
        continue
      }
      this.emitToPlayer(player.unitId, { type: 'CanGoToAct', act: destAct })
    }
  }

  /** Warriv / Meshif / Tyrael travel complement -> next act town, gated by act progression. */
  private handleNpcTravel(
    player: InternalPlayerRecord,
    npcId: number,
    destAreaId: number,
  ): void {
    const npc = this.monsters.get(npcId)
    if (npc && (!npc.isNpc || npc.areaId !== player.areaId || !this.playerInNpcRange(player, npc))) {
      return
    }
    const descriptor = npc ? getTownNpcDescriptorByHcIdx(npc.hcIdx) : undefined
    if (npc && !descriptor?.travelActions?.length) {
      return
    }
    const currentAct = areaToAct(player.areaId)
    if (descriptor && descriptor.actIndex !== currentAct) return
    const destAct = areaToAct(destAreaId)
    // Travel NPCs only reach the destination act's main town, never a wild/dungeon area.
    if (ACT_TOWN_AREAS[destAct] !== destAreaId) return
    if (npc && !this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y)) {
      return
    }
    const action = descriptor?.travelActions?.find(
      (candidate) => this.npcTravelDestinationAct(currentAct, candidate) === destAct,
    )
    if (action === undefined) return
    const questId = this.npcTravelQuestGate(currentAct, action)
    if (questId !== undefined && !hasQuestFlag113c(player.questFlags, questId, QUEST_FLAG_COMPLETED_113C)) {
      return
    }
    this.emitToPlayer(player.unitId, { type: 'CanGoToAct', act: destAct })
    if (!this.transitionPlayerArea(player, destAreaId, { kind: 'townPortal' })) {
      return
    }
    player.activeNpcId = undefined
  }

  /**
   * 1.13c store refresh (`D2Game.dll` `0x6FCB0320` `NPC_CheckTownEmptyAndRefresh` &
   * `0x6FCAF620` `NPC_DestroyPlayerGambleInventory`): leaving an area always clears the
   * leaving player's per-player gamble pools, and clears the town's shared NPC store
   * inventories (`pNpcRecord->pInventory` / `vendor.bItemsGenerated`) only when no
   * players remain in that town area.
   */
  private clearVendorPools(player: InternalPlayerRecord, prevAreaId?: number): void {
    for (const [npcId, pool] of player.vendorPools.entries()) {
      if (player.vendorPoolModes.get(npcId) === 'gamble') {
        for (const item of pool) this.gambleSourceItems.delete(item.unitId)
      }
    }
    for (const byMode of player.vendorPoolsByMode.values()) {
      for (const item of byMode.gamble ?? []) {
        this.gambleSourceItems.delete(item.unitId)
      }
    }
    player.vendorPools.clear()
    player.vendorPoolModes.clear()
    player.vendorPoolsByMode.clear()
    player.activeVendorMode = null

    if (prevAreaId !== undefined && TOWN_AREAS.has(prevAreaId)) {
      let townStillOccupied = false
      for (const other of this.players.values()) {
        if (other.areaId === prevAreaId) {
          townStillOccupied = true
          break
        }
      }
      if (!townStillOccupied) {
        for (const npc of this.monsters.values()) {
          if (npc.isNpc && npc.areaId === prevAreaId) {
            npc.vendorPool = []
            npc.vendorStoreGenerated = false
          }
        }
      }
    }
  }

  private handleNpcAction(player: InternalPlayerRecord, npcId: number, gamble: boolean): void {
    const npc = this.monsters.get(npcId)
    if (
      npc &&
      (!npc.isNpc ||
        npc.areaId !== player.areaId ||
        !this.playerInNpcRange(player, npc) ||
        !this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y))
    ) {
      if (npc && npc.isNpc && npc.areaId === player.areaId && player.pendingInteraction === undefined) {
        player.pendingInteraction = { kind: 'npc', id: npcId }
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = gamble
      }
      return
    }
    player.pendingInteraction = undefined
    player.pendingInteractionSteps = 0
    player.pendingNpcGamble = undefined
    player.activeNpcId = npcId
    if (!npc) return
    const mode: 'trade' | 'gamble' = gamble ? 'gamble' : 'trade'
    let byMode = player.vendorPoolsByMode.get(npcId)
    if (byMode === undefined) {
      byMode = {}
      player.vendorPoolsByMode.set(npcId, byMode)
    }
    let pool: ServerItemEntry[]
    if (mode === 'gamble') {
      // 1.13c D2Game `0x6FCDE2A0` (`NPC_FillGamble`): gamble stock is per-player
      // (`pNpcRecord->pGambleList`) and regenerated every time the gamble window opens.
      if (byMode.gamble !== undefined) {
        for (const item of byMode.gamble) {
          this.gambleSourceItems.delete(item.unitId)
        }
      }
      pool = this.createVendorStorePool(npc, player, true)
      byMode.gamble = pool
      player.vendorPools.set(npcId, pool)
      player.vendorPoolModes.set(npcId, 'gamble')
    } else {
      // 1.13c D2Game `0x6FCDF730` (`NPC_InitStoreOrGamble`): normal vendor stock lives
      // on `pNpcRecord->pInventory` (`vendor.bItemsGenerated`) and is shared across
      // players in town until the last player leaves that town area (`0x6FCB0320`).
      if (!npc.vendorStoreGenerated) {
        npc.vendorPool = this.createVendorStorePool(npc, player, false)
        npc.vendorStoreGenerated = true
      }
      pool = npc.vendorPool
      byMode.trade = pool
      player.vendorPools.set(npcId, pool)
      player.vendorPoolModes.set(npcId, 'trade')
    }
    player.activeVendorMode = mode
    if (mode === 'trade' || !npc.vendorStoreGenerated) {
      npc.vendorPool = pool
    }

    for (const vItem of pool) {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'vendorPool',
        itemId: vItem.unitId,
        code: vItem.code,
        x: vItem.x,
        y: vItem.y,
        container: 'shop',
        item: this.serverEntryToItemData(vItem),
      })
    }
  }

  /** Remove a bought non-permanent store entry from the shop and notify viewing clients. */
  private removeVendorPoolEntry(
    player: InternalPlayerRecord,
    npc: InternalMonsterRecord,
    npcId: number,
    itemId: number,
  ): void {
    const owned = player.vendorPools.get(npcId)
    if (owned) {
      const idx = owned.findIndex((entry) => entry.unitId === itemId)
      if (idx !== -1) owned.splice(idx, 1)
    }
    if (npc.vendorPool !== owned) {
      const npcIdx = npc.vendorPool.findIndex((entry) => entry.unitId === itemId)
      if (npcIdx !== -1) npc.vendorPool.splice(npcIdx, 1)
    }
    this.emitToPlayer(player.unitId, {
      type: 'UnitRemove',
      unitType: 4,
      id: itemId,
      unitId: itemId,
    })
    if (player.activeVendorMode === 'trade') {
      for (const other of this.players.values()) {
        if (
          other.unitId !== player.unitId &&
          other.areaId === npc.areaId &&
          other.activeNpcId === npcId &&
          other.activeVendorMode === 'trade'
        ) {
          this.emitToPlayer(other.unitId, {
            type: 'UnitRemove',
            unitType: 4,
            id: itemId,
            unitId: itemId,
          })
        }
      }
    }
  }

  private handleNpcBuy(
    player: InternalPlayerRecord,
    npcId: number,
    itemId: number,
    isGamble: boolean,
    explicitCost?: number,
  ): void {
    const npc = this.monsters.get(npcId)
    if (!npc || !npc.isNpc || npc.areaId !== player.areaId) return
    const pool = player.vendorPools.get(npcId) ?? npc.vendorPool
    const vItem = pool.find((i) => i.unitId === itemId)
    // Synthetic test fixtures (`giveVendorPool`) populate `npc.vendorPool` directly
    // with `rawItemData === undefined` without opening a trade window via `NpcAction`.
    const isSyntheticVendorFixture =
      !isGamble &&
      vItem !== undefined &&
      vItem.rawItemData === undefined &&
      !player.vendorPools.has(npcId) &&
      player.activeNpcId === undefined &&
      player.activeVendorMode === null
    if (!isSyntheticVendorFixture) {
      // 1.13c trade context: the requested NPC must be the one currently open,
      // within reach, and the window type must match the request. A closed window
      // (activeNpcId / activeVendorMode cleared) rejects the transaction.
      if (player.activeNpcId !== npcId) return
      if (!this.playerInNpcRange(player, npc)) return
      if (player.activeVendorMode === null) return
      if ((player.activeVendorMode === 'gamble') !== isGamble) return
    }
    // Gamble previews live in `gambleSourceItems`, not the normal store pool.
    const gambleSource = isGamble ? this.gambleSourceItems.get(itemId) : undefined
    // #1337/#1354: no fallback item — a stale/unknown item id or another player's gamble item rejects the transaction.
    if (isGamble ? !gambleSource || (pool.length > 0 && !vItem) : !vItem) return
    const code = vItem?.code ?? gambleSource?.base.id ?? 'cap'
    const info = lookupBaseInfo(code)
    void explicitCost
    // Server-owned price; the client's 0x32 `cost` field is informational only.
    const cost = vItem
      ? vItem.buyback === true || vItem.rawItemData === undefined
        ? vItem.cost
        : this.serverItemPrice113c(player, npc.hcIdx, vItem, isGamble ? 2 : 0)
      : info.cost

    // 1.13c placement: potions/tomes are independent items; scrolls merge into
    // an unfilled tome; keys/arrows/bolts merge up to their MaxStack.
    const lowerCode = code.trim().toLowerCase()
    const beltCatalogEntry = BELT_POTION_CATALOG[lowerCode]
    const isBeltable = beltCatalogEntry !== undefined
    const isScroll = lowerCode === 'tsc' || lowerCode === 'isc'
    const tomeCode = lowerCode === 'tsc' ? 'tbk' : lowerCode === 'isc' ? 'ibk' : undefined
    const mergeMax =
      lowerCode === 'key'
        ? 12
        : lowerCode === 'aqv'
          ? 350
          : lowerCode === 'cqv'
            ? 250
            : lowerCode === 'abv'
              ? 500
              : isScroll
                ? 20
                : 0
    let stackTarget: ServerItemEntry | undefined
    if (isScroll && tomeCode !== undefined) {
      stackTarget = player.items.find(
        (item) =>
          item.location === 'inventory' &&
          item.code.trim().toLowerCase() === tomeCode &&
          (item.quantity || 1) < 20,
      )
    } else if (mergeMax > 0) {
      stackTarget = player.items.find(
        (item) =>
          item.location === 'inventory' &&
          item.code.trim().toLowerCase() === lowerCode &&
          (item.quantity || 1) < mergeMax,
      )
    }
    let beltSlot: { x: number; y: number } | undefined
    if (stackTarget === undefined && isBeltable) {
      beltSlot = this.findAvailableBeltSlot(player, lowerCode)
    }
    const free =
      stackTarget === undefined && beltSlot === undefined
        ? this.findFreeGridSlot(
            player,
            'inventory',
            vItem?.width ?? info.width,
            vItem?.height ?? info.height,
            10,
            4,
          )
        : (beltSlot ?? { x: 0, y: 0 })
    if (!stackTarget && !beltSlot && !free) {
      this.emitToPlayer(player.unitId, {
        type: 'NpcTransaction',
        result: 0x01,
        flag: 0,
        itemId,
        gold: player.gold,
      })
      return
    }
    const cell = free ?? beltSlot!

    const totalGold = player.gold + player.goldBank
    if (totalGold < cost) {
      this.emitToPlayer(player.unitId, {
        type: 'NpcTransaction',
        result: 0x0c,
        flag: 0,
        itemId,
        gold: player.gold,
      })
      return
    }

    let spentFromBank = false
    if (player.gold >= cost) {
      player.gold -= cost
    } else {
      const rem = cost - player.gold
      player.gold = 0
      player.goldBank = Math.max(0, player.goldBank - rem)
      spentFromBank = rem > 0
    }

    const emitGoldUpdates = (): void => {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 14,
        value: player.gold,
      })
      if (spentFromBank) {
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 15,
          value: player.goldBank,
        })
      }
    }

    if (stackTarget !== undefined) {
      stackTarget.quantity = (stackTarget.quantity || 1) + 1
      if (stackTarget.rawItemData !== undefined) {
        stackTarget.rawItemData = {
          ...stackTarget.rawItemData,
          quantity: stackTarget.quantity,
        }
      }
      if (vItem && !vItem.permStore && !isGamble) {
        this.removeVendorPoolEntry(player, npc, npcId, itemId)
      }
      emitGoldUpdates()
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'update',
        itemId: stackTarget.unitId,
        code: stackTarget.code,
        x: stackTarget.x,
        y: stackTarget.y,
        container: 'inventory',
        item: this.serverEntryToItemData(stackTarget),
      })
      return
    }

    let quality = vItem?.quality ?? 2
    const stats = new Map<number, number>()
    if (isGamble) {
      const roll = this.rng.rand(100)
      quality = roll < 10 ? 6 : 4
      stats.set(0, 2 + this.rng.rand(5))
    }

    const purchased: ServerItemEntry =
      gambleSource
        ? // 1.13c gamble purchase: the mystery base is revealed as a Magic/Rare/Set/Unique item.
          this.createServerEntryFromItem(
            finalizeDroppedItem113c(
              resolveGambledItem({
                mysteryItem: gambleSource,
                cLvl: player.level,
                tables: getEmbeddedDropTables(),
                rng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
              }),
            ),
            {
              location: beltSlot ? 'belt' : 'inventory',
              x: cell.x,
              y: cell.y,
              areaId: player.areaId,
              ownerId: player.unitId,
              storePage: beltSlot ? 0 : 1,
              gamble: true,
            },
          )
        : vItem?.rawItemData && !isGamble
          ? // Store purchase: the bought item is the rolled store item itself.
            this.cloneVendorEntryForPlayer(vItem, player, cell, beltSlot ? 'belt' : 'inventory')
          : {
              unitId: this.allocateUnitId(),
              code,
              name: info.name,
              quality,
              level: player.level,
              location: beltSlot ? 'belt' : 'inventory',
              x: cell.x,
              y: cell.y,
              width: info.width,
              height: info.height,
              areaId: player.areaId,
              ownerId: player.unitId,
              bodyLoc: 0,
              storePage: beltSlot ? 0 : 1,
              cost: info.cost,
              gamble: isGamble,
              identified: true,
              ethereal: false,
              socketed: false,
              totalSockets: 0,
              durability: info.maxDurability,
              maxDurability: info.maxDurability,
              quantity: 1,
              stats,
              socketedItems: [],
            }
    player.items.push(purchased)

    if (isGamble) {
      this.gambleSourceItems.delete(itemId)
      this.removeVendorPoolEntry(player, npc, npcId, itemId)
    } else if (vItem && !vItem.permStore) {
      this.removeVendorPoolEntry(player, npc, npcId, itemId)
    }

    emitGoldUpdates()
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: isGamble ? 'gamble' : 'buy',
      itemId: purchased.unitId,
      code: purchased.code,
      x: purchased.x,
      y: purchased.y,
      container: beltSlot ? 'belt' : 'inventory',
      item: this.serverEntryToItemData(purchased),
    })
  }

  /**
   * 1.13c two-pass belt auto-placement (`INVENTORY_GetFreeBeltSlot` / `BELTS_GetMaxRows`):
   * Pass 1 fills the lowest empty upper row (`1..beltRows-1`) above a compatible base slot (`y = 0`);
   * Pass 2 fills the first empty base slot (`y = 0, x = 0..3`).
   */
  private findAvailableBeltSlot(
    player: InternalPlayerRecord,
    lowerCode: string,
  ): { x: number; y: number } | undefined {
    const newCatalog = BELT_POTION_CATALOG[lowerCode]
    if (!newCatalog) return undefined
    const belt = player.items.find(
      (item) => item.location === 'equipped' && item.bodyLoc === 8,
    )
    const beltCode = belt?.code.trim().toLowerCase() ?? ''
    const beltRows =
      belt === undefined ? NO_BELT_ROWS : (BELT_CODE_TO_ROWS[beltCode] ?? 4)
    const newPot = { ...newCatalog, id: lowerCode }

    // Pass 1: stack above an existing compatible potion/scroll in row 0.
    for (let bx = 0; bx < 4; bx++) {
      const baseItem = player.items.find(
        (it) => it.location === 'belt' && it.x === bx && it.y === 0,
      )
      if (!baseItem) continue
      const baseCode = baseItem.code.trim().toLowerCase()
      const baseCatalog = BELT_POTION_CATALOG[baseCode]
      if (!baseCatalog) continue
      if (!areBeltPotionsCompatible({ ...baseCatalog, id: baseCode }, newPot)) continue
      for (let by = 1; by < beltRows; by++) {
        if (!player.items.some((it) => it.location === 'belt' && it.x === bx && it.y === by)) {
          return { x: bx, y: by }
        }
      }
    }

    // Pass 2: place into the first empty base column (row 0).
    for (let bx = 0; bx < 4; bx++) {
      if (!player.items.some((it) => it.location === 'belt' && it.x === bx && it.y === 0)) {
        return { x: bx, y: 0 }
      }
    }
    return undefined
  }

  /** First free 10x10 cell on a vendor tab that fits the item footprint. */
  private findFreeVendorSlot(
    pool: readonly ServerItemEntry[],
    page: number,
    width: number,
    height: number,
  ): { x: number; y: number } | undefined {
    const occupied = new Uint8Array(100)
    for (const other of pool) {
      if (other.storePage !== page) continue
      for (let yy = 0; yy < other.height; yy++) {
        for (let xx = 0; xx < other.width; xx++) {
          const gx = other.x + xx
          const gy = other.y + yy
          if (gx >= 0 && gx < 10 && gy >= 0 && gy < 10) occupied[gy * 10 + gx] = 1
        }
      }
    }
    for (let y = 0; y <= 10 - height; y++) {
      for (let x = 0; x <= 10 - width; x++) {
        let free = true
        for (let yy = 0; yy < height && free; yy++) {
          for (let xx = 0; xx < width; xx++) {
            if (occupied[(y + yy) * 10 + x + xx] !== 0) {
              free = false
              break
            }
          }
        }
        if (free) return { x, y }
      }
    }
    return undefined
  }

  private handleNpcSell(
    player: InternalPlayerRecord,
    npcId: number,
    itemId: number,
  ): void {
    const idx = this.findPlayerItemIndex(player, itemId)
    if (idx === -1) return
    const sold = player.items[idx]
    if (!sold) return
    const npc = this.monsters.get(npcId)
    const isSyntheticSellFixture =
      npc === undefined &&
      sold.rawItemData === undefined &&
      player.activeNpcId === undefined &&
      player.activeVendorMode === null &&
      player.vendorPools.size === 0
    if (!isSyntheticSellFixture) {
      if (!npc || !npc.isNpc || npc.areaId !== player.areaId) return
      if (player.activeNpcId !== npcId) return
      if (!this.playerInNpcRange(player, npc)) return
      if (player.activeVendorMode !== 'trade') return
    }
    // 1.13c vendors only buy items carried in the inventory (not equipped, belt,
    // cursor, stash, cube or sockets), and never quest items or player ears
    // (`D2Common.#10705` `0x6FD741D0`).
    if (sold.location !== 'inventory') return
    const tables = getEmbeddedDropTables()
    const base = tables.getBase(sold.code.trim())
    const codeLower = sold.code.trim().toLowerCase()
    const rawFlags = Number(sold.rawItemData?.flags ?? 0)
    const isUnsellable =
      lookupBaseInfo(sold.code).quest ||
      (base?.quest ?? 0) > 0 ||
      base?.type?.trim().toLowerCase() === 'ques' ||
      codeLower === 'play' ||
      (rawFlags & 0x1000) !== 0
    if (isUnsellable) {
      if (npc) {
        this.emitToPlayer(player.unitId, {
          type: 'NpcTransaction',
          result: 0x09,
          flag: 0,
          itemId,
          gold: player.gold,
        })
      }
      return
    }

    // D2Common #10107 sell price (client `priceItem113c` type 1).
    const sellValue = npc
      ? this.serverItemPrice113c(player, npc.hcIdx, sold, 1)
      : Math.max(1, Math.floor(sold.cost / 4))
    const maxInventoryGold = getInventoryGoldLimit(player.level)
    const maxBankGold = getStashGoldLimit(player.level)
    const room = Math.max(0, maxInventoryGold - player.gold)
    const bankRoom = Math.max(0, maxBankGold - player.goldBank)
    if (sellValue > room + bankRoom) {
      this.emitToPlayer(player.unitId, {
        type: 'NpcTransaction',
        result: 0x0c,
        flag: 0,
        itemId,
        gold: player.gold,
      })
      return
    }
    player.items.splice(idx, 1)
    const toInventory = Math.min(sellValue, room)
    player.gold += toInventory
    const overflow = sellValue - toInventory
    if (overflow > 0) {
      player.goldBank = Math.min(
        getStashGoldLimit(player.level),
        player.goldBank + overflow,
      )
    }
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 14,
      value: player.gold,
    })
    if (overflow > 0) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 15,
        value: player.goldBank,
      })
    }

    // 1.13c buyback (`D2Game.dll` `NPC_SellItem` `0x6FCDF990`): non-ethereal,
    // non-broken, non-personalized, unsocketed items that are not already stocked
    // as a permanent store item enter this customer's vendor stock on their
    // `ItemTypes.txt` storePage with durability/quantity restored and identified.
    if (npc) {
      let pool = player.vendorPools.get(npcId)
      if (pool === undefined) {
        pool = npc.vendorPool
        player.vendorPools.set(npcId, pool)
      }
      const isBroken = sold.maxDurability > 0 && sold.durability <= 0
      const isEthereal =
        sold.ethereal ||
        sold.rawItemData?.ethereal === true ||
        (rawFlags & 0x400000) !== 0
      const isPersonalized =
        sold.rawItemData?.personalized === true ||
        (rawFlags & 0x01000000) !== 0
      const hasSocketedItems = sold.socketedItems.length > 0
      const alreadyPermStocked = pool.some(
        (entry) => entry.permStore === true && entry.code.trim() === sold.code.trim(),
      )
      if (!isBroken && !isEthereal && !isPersonalized && !hasSocketedItems && !alreadyPermStocked) {
        // 1.13c buyback tabs: armor -> 1, weapons1 -> 2 (overflow weapons2 -> 3),
        // misc -> 4. Never reuse the player's inventory `storePage`.
        const storeKind = base === undefined ? 'misc' : resolveStorePageForBase(base, tables.itemTypes)
        const preferredPage = storeKind === 'armo' ? 1 : storeKind === 'weap' ? 2 : 4
        let page = preferredPage
        let slot = this.findFreeVendorSlot(pool, page, sold.width, sold.height)
        if (slot === undefined && storeKind === 'weap') {
          page = 3
          slot = this.findFreeVendorSlot(pool, page, sold.width, sold.height)
        }
        if (slot !== undefined) {
          sold.location = 'vendor'
          sold.ownerId = npcId
          sold.storePage = page
          sold.x = slot.x
          sold.y = slot.y
          sold.gamble = false
          sold.buyback = true
          sold.identified = true
          sold.cost = sellValue
          if (sold.maxDurability > 0) {
            sold.durability = sold.maxDurability
          }
          if (base !== undefined && base.maxStack > 1) {
            sold.quantity = base.maxStack
          }
          if (sold.rawItemData !== undefined) {
            sold.rawItemData = {
              ...sold.rawItemData,
              identified: true,
              durability: sold.durability,
              curDurability: sold.durability,
              quantity: sold.quantity,
              flags: Number(sold.rawItemData.flags ?? 0) | 0x10,
            }
          }
          pool.push(sold)
          this.emitToPlayer(player.unitId, {
            type: 'ItemEvent',
            action: 'vendorPool',
            itemId: sold.unitId,
            code: sold.code,
            x: sold.x,
            y: sold.y,
            container: 'shop',
            item: this.serverEntryToItemData(sold),
          })
        }
      }
    }

    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'sell',
      itemId: sold.unitId,
      code: sold.code,
      x: sold.x,
      y: sold.y,
      container: 'shop',
      item: this.serverEntryToItemData(sold),
    })
  }

  private handleAllocateStat(
    player: InternalPlayerRecord,
    statId: number,
    amount: number,
  ): void {
    if (player.statPts <= 0) return
    if (statId < 0 || statId > 3) return
    const spend = Math.min(player.statPts, Math.max(1, amount))
    player.statPts -= spend
    const base = CANONICAL_CHARSTATS[player.classCode]

    if (statId === 0) {
      player.strength += spend
    } else if (statId === 1) {
      player.energy += spend
      const manaAddFixed = Math.max(
        FIXED_ONE,
        Math.round(base.perStatPoint.manaPerEnergy * spend * FIXED_ONE),
      )
      player.maxManaFixed += manaAddFixed
      player.manaFixed = player.maxManaFixed
      player.maxMana = Math.floor(player.maxManaFixed / FIXED_ONE)
      player.mana = player.maxMana
    } else if (statId === 2) {
      player.dexterity += spend
    } else if (statId === 3) {
      player.vitality += spend
      const lifeAddFixed = Math.max(
        FIXED_ONE,
        Math.round(base.perStatPoint.lifePerVitality * spend * FIXED_ONE),
      )
      const stamAddFixed = Math.max(
        FIXED_ONE,
        Math.round(base.perStatPoint.staminaPerVitality * spend * FIXED_ONE),
      )
      player.maxHpFixed += lifeAddFixed
      player.hpFixed = player.maxHpFixed
      player.maxHp = Math.floor(player.maxHpFixed / FIXED_ONE)
      player.hp = player.maxHp

      player.maxStaminaFixed += stamAddFixed
      player.staminaFixed = player.maxStaminaFixed
      player.staminaExhausted = false
      player.maxStamina = Math.floor(player.maxStaminaFixed / FIXED_ONE)
      player.stamina = player.maxStamina
    }

    const updatedVal =
      statId === 0
        ? player.strength
        : statId === 1
          ? player.energy
          : statId === 2
            ? player.dexterity
            : player.vitality
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId,
      value: updatedVal,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 4,
      value: player.statPts,
    })
    if (statId === 1) {
      for (const [poolStatId, poolVal] of [
        [8, player.manaFixed],
        [9, player.maxManaFixed],
      ] as const) {
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: poolStatId,
          value: poolVal,
        })
        this.emitToPlayer(player.unitId, {
          type: 'StatSet',
          stat: poolStatId,
          value: poolVal,
        })
      }
      this.emitPlayerVitals(player)
    } else if (statId === 3) {
      for (const [poolStatId, poolVal] of [
        [6, player.hpFixed],
        [7, player.maxHpFixed],
        [10, player.staminaFixed],
        [11, player.maxStaminaFixed],
      ] as const) {
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: poolStatId,
          value: poolVal,
        })
        this.emitToPlayer(player.unitId, {
          type: 'StatSet',
          stat: poolStatId,
          value: poolVal,
        })
      }
      this.emitPlayerVitals(player)
    }
  }

  private handleAllocateSkill(
    player: InternalPlayerRecord,
    skillId: number,
  ): void {
    if (player.newSkills <= 0) return
    if (!Number.isInteger(skillId) || skillId < 0 || skillId > 350) return
    player.newSkills -= 1
    const nextLvl = (player.skills.get(skillId) ?? 0) + 1
    player.skills.set(skillId, nextLvl)

    this.emitToPlayer(player.unitId, {
      type: 'SkillUpdate',
      unitId: player.unitId,
      skillId,
      level: nextLvl,
    })
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 5,
      value: player.newSkills,
    })
  }

  /**
   * 1.13c Akara Reset Stat/Skill Points (`D2Game.dll` `0x6fce0504` -> `0x6fcc1280` + `0x6fd0af80` + `0x6fc83bb0`).
   * Triggered by `C2S 0x38 NpcEntityAction(action=0, npcId=akara, complement=0)`.
   */
  private handleAkaraRespec(
    player: InternalPlayerRecord,
    npcId: number,
  ): boolean {
    const npc = this.resolveServiceNpc(player, npcId) ?? this.monsters.get(npcId)
    const isAkara = npc !== undefined ? npc.hcIdx === 148 : npcId === 148
    if (!isAkara) return false

    const q1 = player.questFlags[1] ?? 0
    if ((q1 & QUEST_FLAG_COMPLETED_113C) === 0) return false

    let q41 = player.questFlags[41] ?? 0
    if ((q41 & 1) !== 0) return false
    if (q41 === 0) {
      q41 = 0x2002
      player.questFlags[41] = q41
    }
    if ((q41 & 2) === 0) return false

    // 1. Skill Reset (D2Game.dll 0x6fcc1280): refund all hard skill points to stat 5 (newskills) and zero hard levels.
    const learnedSkillIds = [...player.skills.keys()]
    for (const skillId of learnedSkillIds) {
      const slvl = player.skills.get(skillId) ?? 0
      if (slvl > 0) {
        player.newSkills += slvl
      }
      this.emitToPlayer(player.unitId, {
        type: 'SkillUpdate',
        unitId: player.unitId,
        skillId,
        level: 0,
      })
    }
    player.skills.clear()
    if (player.d2sTemplate?.skills) {
      player.d2sTemplate.skills.fill(0)
    }
    if (player.leftSkill !== 0) {
      player.leftSkill = 0
      this.emitToPlayer(player.unitId, {
        type: 'ActiveSkill',
        unitId: player.unitId,
        hand: 'left',
        skill: 0,
        itemId: 0xffffffff,
      })
    }
    if (player.rightSkill !== 0) {
      player.rightSkill = 0
      this.emitToPlayer(player.unitId, {
        type: 'ActiveSkill',
        unitId: player.unitId,
        hand: 'right',
        skill: 0,
        itemId: 0xffffffff,
      })
    }

    // 2. Stat Reset (D2Game.dll 0x6fd0af80): reset Str/Dex/Ene/Vit to CharStats base values and refund to stat 4 (statpts).
    const base = CANONICAL_CHARSTATS[player.classCode]
    const strDiff = base.baseAttributes.strength - player.strength
    if (strDiff !== 0) {
      player.statPts -= strDiff
      player.strength = base.baseAttributes.strength
    }
    const dexDiff = base.baseAttributes.dexterity - player.dexterity
    if (dexDiff !== 0) {
      player.statPts -= dexDiff
      player.dexterity = base.baseAttributes.dexterity
    }
    const eneDiff = base.baseAttributes.energy - player.energy
    if (eneDiff !== 0) {
      player.statPts -= eneDiff
      player.energy = base.baseAttributes.energy
      const manaDeltaFixed = Math.round(
        base.perStatPoint.manaPerEnergy * eneDiff * FIXED_ONE,
      )
      player.maxManaFixed = Math.max(0, player.maxManaFixed + manaDeltaFixed)
      player.manaFixed = Math.min(player.manaFixed, player.maxManaFixed)
      player.maxMana = Math.max(0, Math.floor(player.maxManaFixed / FIXED_ONE))
      player.mana = Math.max(0, Math.min(player.maxMana, Math.floor(player.manaFixed / FIXED_ONE)))
    }
    const vitDiff = base.baseAttributes.vitality - player.vitality
    if (vitDiff !== 0) {
      player.statPts -= vitDiff
      player.vitality = base.baseAttributes.vitality
      const lifeDeltaFixed = Math.round(
        base.perStatPoint.lifePerVitality * vitDiff * FIXED_ONE,
      )
      const stamDeltaFixed = Math.round(
        base.perStatPoint.staminaPerVitality * vitDiff * FIXED_ONE,
      )
      player.maxHpFixed = Math.max(FIXED_ONE, player.maxHpFixed + lifeDeltaFixed)
      player.hpFixed = Math.min(player.hpFixed, player.maxHpFixed)
      player.maxHp = Math.max(1, Math.floor(player.maxHpFixed / FIXED_ONE))
      player.hp = Math.max(1, Math.min(player.maxHp, Math.floor(player.hpFixed / FIXED_ONE)))

      player.maxStaminaFixed = Math.max(FIXED_ONE, player.maxStaminaFixed + stamDeltaFixed)
      player.staminaFixed = Math.min(player.staminaFixed, player.maxStaminaFixed)
      player.maxStamina = Math.max(1, Math.floor(player.maxStaminaFixed / FIXED_ONE))
      player.stamina = Math.max(
        1,
        Math.min(player.maxStamina, Math.floor(player.staminaFixed / FIXED_ONE)),
      )
    }

    for (const [statId, val] of [
      [0, player.strength],
      [1, player.energy],
      [2, player.dexterity],
      [3, player.vitality],
      [4, player.statPts],
      [5, player.newSkills],
      [6, player.hpFixed],
      [7, player.maxHpFixed],
      [8, player.manaFixed],
      [9, player.maxManaFixed],
      [10, player.staminaFixed],
      [11, player.maxStaminaFixed],
    ] as const) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId,
        value: val,
      })
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        stat: statId,
        value: val,
      })
    }
    this.emitPlayerVitals(player)

    // 3. Consume Quest 41 (0x29) respec token (D2Game.dll 0x6fc83bb0: set bit 0 = 0x0001, clear bit 1 = 0x0002).
    player.questFlags[41] = (q41 & ~0x0002) | 0x2001
    this.emitQuestLog(player)
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'update',
      source: 0x28,
      quests: new Uint16Array(player.questFlags),
      flags: Array.from(player.questFlags),
    })
    return true
  }

  private handlePartyCommand(
    player: InternalPlayerRecord,
    action: number | string,
    targetPlayerId: number,
  ): void {
    const target = this.players.get(targetPlayerId)
    if (!target) return
    if (
      action === 0x06 ||
      action === 0x08 ||
      action === 'invite' ||
      action === 'accept' ||
      action === 'join'
    ) {
      const partyId =
        player.partyId !== 0xffff
          ? player.partyId
          : target.partyId !== 0xffff
            ? target.partyId
            : Math.min(player.unitId, target.unitId)
      player.partyId = partyId
      target.partyId = partyId
      for (const p of this.players.values()) {
        this.emitToPlayer(p.unitId, {
          type: 'Party',
          kind: 'roster',
          action: 'update',
          playerId: player.unitId,
          partyId,
        })
        this.emitToPlayer(p.unitId, {
          type: 'Party',
          kind: 'roster',
          action: 'update',
          playerId: target.unitId,
          partyId,
        })
      }
    } else if (
      action === 0x07 ||
      action === 0x09 ||
      action === 'leave' ||
      action === 'cancel'
    ) {
      player.partyId = 0xffff
      for (const p of this.players.values()) {
        this.emitToPlayer(p.unitId, {
          type: 'Party',
          kind: 'roster',
          action: 'update',
          playerId: player.unitId,
          partyId: 0xffff,
        })
      }
    }
  }

  private handleChatCommand(
    player: InternalPlayerRecord,
    text: string,
    whisperTo?: string,
  ): void {
    const trimmed = text.trim()
    if (/^\/?players\b/i.test(trimmed)) {
      if (this.policy.allowPlayersXCommand) {
        const match = /^\/?players(?:\s+(?:set\s+)?|\s*:\s*)(-?\d+)/i.exec(trimmed)
        if (match) {
          const val = Number(match[1])
          this.setPlayersX(val)
          this.emitToPlayer(player.unitId, {
            type: 'Chat',
            kind: 'system',
            from: 'Server',
            text: `players set to ${this.playersX}`,
          })
        }
      }
      return
    }

    const ev: ServerEvent = {
      type: 'Chat',
      kind: whisperTo ? 'whisper' : 'say',
      from: player.name,
      unit: { unitType: 0, id: player.unitId },
      text,
    }

    if (whisperTo) {
      for (const p of this.players.values()) {
        if (
          p.name.toLowerCase() === whisperTo.toLowerCase() ||
          p.unitId === player.unitId
        ) {
          this.emitToPlayer(p.unitId, ev)
        }
      }
    } else {
      for (const p of this.players.values()) {
        this.emitToPlayer(p.unitId, ev)
      }
    }
  }

  private findUnitPosition(
    unitId: number,
    areaId?: number,
  ): { x: number; y: number } | undefined {
    const p = this.players.get(unitId)
    if (p && (areaId === undefined || p.areaId === areaId)) return { x: p.x, y: p.y }
    const m = this.monsters.get(unitId)
    if (m && (areaId === undefined || m.areaId === areaId)) return { x: m.x, y: m.y }
    const o = this.objects.get(unitId)
    if (o && (areaId === undefined || o.areaId === areaId)) return { x: o.x, y: o.y }
    const g = this.groundItems.get(unitId)
    if (g && (areaId === undefined || g.areaId === areaId)) return { x: g.x, y: g.y }
    const w = this.warpTiles.get(unitId)
    if (w && (areaId === undefined || w.areaId === areaId)) return { x: w.x, y: w.y }
    return undefined
  }

  private emitToPlayer(playerUnitId: number, ev: ServerEvent): void {
    const queue = this.outbox.get(playerUnitId)
    if (queue) {
      queue.push(ev)
    }
  }

  private broadcastToArea(areaId: number, ev: ServerEvent): void {
    for (const p of this.players.values()) {
      if (p.areaId === areaId) {
        this.emitToPlayer(p.unitId, ev)
      }
    }
  }

  /** {@link broadcastToArea} without `exceptPlayerUnitId` (e.g. the moving player's own client). */
  private broadcastToAreaExcept(areaId: number, exceptPlayerUnitId: number, ev: ServerEvent): void {
    for (const p of this.players.values()) {
      if (p.areaId === areaId && p.unitId !== exceptPlayerUnitId) {
        this.emitToPlayer(p.unitId, ev)
      }
    }
  }

  drainEvents(playerUnitId?: number): readonly ServerEvent[] {
    if (playerUnitId !== undefined) {
      const queue = this.outbox.get(playerUnitId)
      if (!queue || queue.length === 0) return []
      return queue.splice(0, queue.length)
    }
    const all: ServerEvent[] = []
    for (const queue of this.outbox.values()) {
      if (queue.length > 0) {
        all.push(...queue.splice(0, queue.length))
      }
    }
    return all
  }

  drainPlayerEvents(playerUnitId: number): readonly ServerEvent[] {
    return this.drainEvents(playerUnitId)
  }

  getPlayerState(playerUnitId: number): ServerPlayerState | undefined {
    const p = this.players.get(playerUnitId)
    if (!p) return undefined
    const stats = new Map<number, number>([
      [0, p.strength],
      [1, p.energy],
      [2, p.dexterity],
      [3, p.vitality],
      [4, p.statPts],
      [5, p.newSkills],
      [6, p.hp],
      [7, p.maxHp],
      [8, p.mana],
      [9, p.maxMana],
      [10, p.stamina],
      [11, p.maxStamina],
      [12, p.level],
      [13, p.experience],
      [14, p.gold],
      [15, p.goldBank],
    ])
    return {
      unitId: p.unitId,
      name: p.name,
      classId: p.classId,
      classCode: p.classCode,
      level: p.level,
      act: p.act,
      areaId: p.areaId,
      x: p.x,
      y: p.y,
      targetX: p.targetX,
      targetY: p.targetY,
      run: p.run,
      mode: p.mode,
      hp: p.hp,
      maxHp: p.maxHp,
      mana: p.mana,
      maxMana: p.maxMana,
      stamina: p.stamina,
      maxStamina: p.maxStamina,
      experience: p.experience,
      gold: p.gold,
      goldInInventory: p.gold,
      goldBank: p.goldBank,
      stashGold: p.goldBank,
      strength: p.strength,
      dexterity: p.dexterity,
      vitality: p.vitality,
      energy: p.energy,
      statPts: p.statPts,
      statPoints: p.statPts,
      newSkills: p.newSkills,
      skillPoints: p.newSkills,
      leftSkill: p.leftSkill,
      rightSkill: p.rightSkill,
      skills: new Map(p.skills),
      stats,
      states: new Set(p.states),
      items: p.items.map((i) => ({ ...i, stats: new Map(i.stats) })),
      waypoints: new Set(p.waypoints),
      dead: p.dead,
      corpseId: p.corpseId,
      activeNpcId: p.activeNpcId,
      partyId: p.partyId,
    }
  }

  getMonsterState(monsterUnitId: number): ServerMonsterState | undefined {
    const m = this.monsters.get(monsterUnitId)
    if (!m) return undefined
    return {
      unitId: m.unitId,
      classId: m.classId,
      hcIdx: m.hcIdx,
      defId: m.defId,
      name: m.name,
      areaId: m.areaId,
      x: m.x,
      y: m.y,
      hp: m.hp,
      maxHp: m.maxHp,
      baseMaxHp: m.baseMaxHp,
      level: m.level,
      minDmg: m.minDmg,
      maxDmg: m.maxDmg,
      ar: m.ar,
      ac: m.ac,
      experience:
        m.isNpc || m.noRatio
          ? m.baseXp
          : Math.max(0, Math.floor((m.baseXp * (this.playersX + 1)) / 2)),
      mode: m.mode,
      dead: m.dead,
      alive: !m.dead,
      isNpc: m.isNpc,
      isVendor: m.isVendor,
      isKillable: m.isKillable,
      petIgnore: m.petIgnore,
      isBoss: m.isBoss,
      isPrimeEvil: m.isPrimeEvil,
      isUndead: m.isUndead,
      isDemon: m.isDemon,
      isFlying: m.isFlying,
      isRanged: m.isRanged,
      rank: m.rank,
      modifiers: [...m.modifiers],
      umodIds: [...m.umodIds],
      ai: m.ai,
      aiDelay: m.aiDelay,
      aiParams: [...m.aiParams],
      resistances: { ...m.resistances },
      frozenTicks: m.frozenTicks,
      chillTicks: m.chillTicks,
      fleeTicks: m.fleeTicks,
      states: new Set(m.states),
      shattered: m.shattered,
      corpseSuppressed: m.shattered,
      revivedByShaman: m.revivedByShaman,
    }
  }

  getMonster(monsterUnitId: number): ServerMonsterState | undefined {
    return this.getMonsterState(monsterUnitId)
  }

  /** Apply a `States.txt` state (by row id) to a player for `durationFrames` (25 Hz frames). */
  applyPlayerState(playerUnitId: number, stateId: number, durationFrames: number): boolean {
    const p = this.players.get(playerUnitId)
    if (!p || p.dead) return false
    if (this.registry.getStateById(stateId) === undefined) {
      throw new Error(`GameInstance.applyPlayerState: unknown States.txt row ${stateId}`)
    }
    this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, stateId, durationFrames)
    return true
  }

  applyMonsterState(
    monsterUnitId: number,
    stateIdOrName: number | string,
    durationFrames = 50,
    extra?: {
      readonly frozenTicks?: number | undefined
      readonly chillTicks?: number | undefined
      readonly sourcePlayerId?: number | undefined
    },
  ): boolean {
    const m = this.monsters.get(monsterUnitId)
    if (!m || m.dead || m.isNpc) return false

    let stateId: number
    if (typeof stateIdOrName === 'number') {
      stateId = stateIdOrName
    } else {
      const key = stateIdOrName.trim().toLowerCase()
      if (key === 'freeze' || key === 'frozen') stateId = 1
      else if (key === 'poison') stateId = 2
      else if (key === 'amplifiedamage' || key === 'amplify') stateId = 9
      else if (key === 'weaken') stateId = 19
      else if (key === 'stun' || key === 'stunned') stateId = 21
      else if (key === 'dimvision') stateId = 23
      else if (key === 'taunt') stateId = 27
      else if (key === 'chill' || key === 'chilled' || key === 'cold') stateId = 11
      else if (key === 'holyfreeze') stateId = 43
      else if (key === 'lifetap') stateId = 58
      else if (key === 'ironmaiden') stateId = 55
      else if (key === 'terror') stateId = 56
      else if (key === 'attract') stateId = 57
      else if (key === 'confuse') stateId = 59
      else if (key === 'decrepify') stateId = 60
      else if (key === 'lowerresist') stateId = 61
      else if (key === 'conviction') stateId = 28
      else if (key === 'conversion') stateId = 53
      else stateId = this.registry.getStateByName(key)?.id ?? (Number(key) || 11)
    }

    // Freeze/Stun interrupts a monster's pending melee/revive action frame.
    if (stateId === 1 || stateId === 29 || stateId === 21 || stateId === 25) {
      m.pendingAttack = undefined
      m.pendingAllyAttack = undefined
      m.pendingResurrection = undefined
    }

    const isBossOrUnique = m.isBoss || m.isPrimeEvil || m.rank === 'unique'
    // Taunt (27) reaches champions in 1.13c; the other AI-altering curses stay off
    // Champions as well as bosses/uniques.
    const isAiCcImmune =
      isBossOrUnique || (m.rank === 'champion' && stateId !== 27)
    if (isAiCcImmune) {
      // F14.B1: Bosses/Uniques ignore AI-altering crowd-control curses (stun 21/25,
      // dimvision 23, taunt 27, terror 56, attract 57, confuse 59). Champions keep
      // those immunities except Taunt, which reaches them in 1.13c.
      if (
        stateId === 21 ||
        stateId === 23 ||
        stateId === 25 ||
        stateId === 27 ||
        stateId === 56 ||
        stateId === 57 ||
        stateId === 59
      ) {
        return false
      }
    }
    if (isBossOrUnique) {
      // F14.B1: Bosses/Uniques cannot be frozen solid (convert freeze 1/29 -> cold 11)
      if (stateId === 1 || stateId === 29) {
        stateId = 11
        m.states.delete(1)
        m.states.delete(29)
        m.stateTimers.delete(1)
        m.stateTimers.delete(29)
        m.frozenTicks = 0
        m.chillTicks = Math.max(
          m.chillTicks,
          extra?.chillTicks ?? durationFrames,
        )
      }
    } else {
      if (stateId === 1 || stateId === 29) {
        m.frozenTicks = Math.max(
          m.frozenTicks,
          extra?.frozenTicks ?? durationFrames,
        )
      } else if (stateId === 11) {
        m.chillTicks = Math.max(
          m.chillTicks,
          extra?.chillTicks ?? durationFrames,
        )
      } else if (stateId === 27) {
        m.fleeTicks = 0
        m.states.delete(56)
        m.stateTimers.delete(56)
      } else if (stateId === 56) {
        m.fleeTicks = Math.max(m.fleeTicks, durationFrames)
      }
    }

    const isCurse = this.registry.getStateById(stateId)?.curse === true
    // 1.13c sub_6FCC00B0 (0x6FCC01C1): Attract (57) cannot be overwritten by any curse=1 state
    if (m.states.has(57) && isCurse) {
      return false
    }
    if (isCurse) {
      for (const prevCurseId of [...m.states]) {
        if (prevCurseId !== stateId && this.registry.getStateById(prevCurseId)?.curse === true) {
          m.states.delete(prevCurseId)
          m.stateTimers.delete(prevCurseId)
          this.monsterCombat.get(m.unitId)?.stateBus.removeState(prevCurseId)
          this.broadcastToArea(m.areaId, {
            type: 'UnitState',
            unitType: 'monster',
            unitId: m.unitId,
            state: prevCurseId,
            active: false,
            areaId: m.areaId,
          })
          this.broadcastToArea(m.areaId, {
            type: 'StateEnd',
            unit: { unitType: 1, id: m.unitId },
            state: prevCurseId,
          })
        }
      }
    }

    const dur = Math.max(1, Math.floor(durationFrames))
    if (stateId === 53) {
      m.convertedUntilFrame = Math.max(m.convertedUntilFrame, this.currentFrame + dur)
      if (extra?.sourcePlayerId !== undefined) {
        m.convertedByPlayerId = extra.sourcePlayerId
      }
    }
    if (
      extra?.sourcePlayerId !== undefined &&
      (stateId === 53 || stateId === 57 || stateId === 59)
    ) {
      this.monsterCombatContext(m).stateBus.applyState({
        stateNameOrId: stateId,
        sourceUnitId: `player_${extra.sourcePlayerId}`,
        sourceSkillId: 0,
        slvl: 1,
        durationFrames: dur,
        currentFrame: this.currentFrame,
      })
    }
    this.applyUnitState(
      m.states,
      m.stateTimers,
      'monster',
      m.unitId,
      m.areaId,
      stateId,
      dur,
    )
    return true
  }

  applyStateToMonster(
    monsterUnitId: number,
    stateIdOrName: number | string,
    durationFrames = 50,
    extra?: {
      readonly frozenTicks?: number | undefined
      readonly chillTicks?: number | undefined
      readonly sourcePlayerId?: number | undefined
    },
  ): boolean {
    return this.applyMonsterState(
      monsterUnitId,
      stateIdOrName,
      durationFrames,
      extra,
    )
  }

  private syncMercenaryOwnerAura(
    owner: InternalPlayerRecord,
    activeAura: string | undefined,
  ): void {
    if (!activeAura) return
    const auraKey = activeAura.trim().toLowerCase()
    const stateId = MERC_AURA_TO_STATE_ID[auraKey]
    if (stateId === undefined) return
    this.applyUnitState(
      owner.states,
      owner.stateTimers,
      'player',
      owner.unitId,
      owner.areaId,
      stateId,
      100,
    )
  }

  hireMercenary(ownerPlayerId: number, spec: HireMercenarySpec = {}): number {
    const owner = this.players.get(ownerPlayerId)
    for (const [mId, existing] of this.mercenaries.entries()) {
      if (existing.ownerPlayerId === ownerPlayerId) {
        this.broadcastToArea(existing.areaId, {
          type: 'UnitRemove',
          unitType: 'monster',
          id: mId,
          unitId: mId,
        })
        this.mercenaries.delete(mId)
      }
    }

    const act: 1 | 2 | 3 | 5 = spec.act ?? 2
    const level = Math.max(1, spec.level ?? owner?.level ?? 1)
    const difficulty: 1 | 2 | 3 =
      spec.difficulty ?? ((this.difficulty + 1) as 1 | 2 | 3)
    const defaultSubType =
      act === 1
        ? difficulty === 1
          ? 0
          : difficulty === 2
            ? 2
            : 4
        : act === 2
          ? difficulty === 1
            ? 7
            : difficulty === 2
              ? 11
              : 13
          : act === 3
            ? difficulty === 1
              ? 16
              : difficulty === 2
                ? 19
                : 22
            : difficulty === 1
              ? 24
              : difficulty === 2
                ? 26
                : 28
    const subType = spec.subType ?? defaultSubType
    const stats =
      resolveHirelingStatsAtLevel(subType, act, difficulty, level, true) ??
      resolveHirelingStatsAtLevel(defaultSubType, act, difficulty, level, true)

    const unitId = this.allocateUnitId()
    const maxHp = Math.max(1, spec.maxHp ?? spec.hp ?? stats?.hp ?? 120)
    const hp = Math.max(1, Math.min(maxHp, spec.hp ?? maxHp))
    const damage = stats
      ? Math.max(1, Math.floor((stats.minDmg + stats.maxDmg) / 2))
      : Math.max(8, level * 3)
    const auraSkill = stats?.skills.find((s) =>
      /Prayer|Blessed Aim|Defiance|Thorns|Holy Freeze|Might/i.test(s.skillName),
    )
    const activeAura =
      spec.activeAura ??
      (act === 2 ? (auraSkill?.skillName ?? 'Might') : undefined)
    const areaId = owner?.areaId ?? this.defaultAreaId ?? 1
    const x = spec.x ?? (owner ? owner.x + 1 : 128)
    const y = spec.y ?? (owner ? owner.y + 1 : 128)
    const name = spec.name ?? stats?.record.hireling ?? `Mercenary_${unitId}`
    const classId = stats?.classId ?? (act === 1 ? 271 : act === 2 ? 338 : act === 3 ? 359 : 561)

    const isDead = spec.dead === true
    const record: InternalMercenaryRecord = {
      unitId,
      ownerPlayerId,
      act,
      subType,
      classId,
      level,
      difficulty,
      name,
      areaId,
      x,
      y,
      hp: isDead ? 0 : hp,
      maxHp,
      damage,
      defense: stats?.defense ?? 0,
      resist: stats?.resist ?? 0,
      reach: act === 1 || act === 3 ? 14 : 2.8,
      aggroRadius: 30,
      speed: 30,
      cooldown: 0,
      cooldownTicks: 8,
      activeAura,
      state: isDead ? 'dead' : 'idle',
      alive: !isDead,
      equipment: [],
    }
    this.mercenaries.set(unitId, record)
    if (isDead) {
      return unitId
    }

    this.broadcastToArea(areaId, {
      type: 'UnitAssign',
      unitType: 'monster',
      unitId,
      classId,
      name,
      x,
      y,
      areaId,
      unit: {
        unitType: 1,
        id: unitId,
        classId,
        name,
        x,
        y,
        mode: 1,
        lifePct: 128,
      },
    })
    this.broadcastToArea(areaId, {
      type: 'Merc',
      kind: 'assign',
      mercId: unitId,
      ownerId: ownerPlayerId,
      classId,
    })
    this.broadcastToArea(areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId,
      statId: 12,
      value: Math.max(1, Math.floor(level)),
    })
    this.broadcastAllyHp(areaId, unitId, hp)
    if (owner) {
      this.syncMercenaryOwnerAura(owner, activeAura)
    }
    return unitId
  }

  getMercenaryForOwner(
    ownerPlayerId: number,
  ): ServerMercenaryState | undefined {
    for (const m of this.mercenaries.values()) {
      if (m.ownerPlayerId === ownerPlayerId) {
        return {
          unitId: m.unitId,
          ownerPlayerId: m.ownerPlayerId,
          act: m.act,
          subType: m.subType,
          classId: m.classId,
          level: m.level,
          difficulty: m.difficulty,
          name: m.name,
          areaId: m.areaId,
          x: m.x,
          y: m.y,
          hp: m.hp,
          maxHp: m.maxHp,
          damage: m.damage,
          activeAura: m.activeAura,
          state: m.state,
          alive: m.alive,
        }
      }
    }
    return undefined
  }

  getMercenaryState(
    unitIdOrOwnerId: number,
  ): ServerMercenaryState | undefined {
    const m = this.mercenaries.get(unitIdOrOwnerId)
    if (m) {
      return {
        unitId: m.unitId,
        ownerPlayerId: m.ownerPlayerId,
        act: m.act,
        subType: m.subType,
        classId: m.classId,
        level: m.level,
        difficulty: m.difficulty,
        name: m.name,
        areaId: m.areaId,
        x: m.x,
        y: m.y,
        hp: m.hp,
        maxHp: m.maxHp,
        damage: m.damage,
        activeAura: m.activeAura,
        state: m.state,
        alive: m.alive,
      }
    }
    return this.getMercenaryForOwner(unitIdOrOwnerId)
  }

  getMercenaryOrPetArea(unitId: number): number | undefined {
    const merc = this.mercenaries.get(unitId)
    if (merc) return merc.areaId
    for (const [ownerId, mgr] of this.summonManagers.entries()) {
      for (const pet of mgr.getActivePets()) {
        const mappedId =
          this.petUnitIds.get(pet.uid) ??
          (pet as unknown as { unitId?: number }).unitId
        if (mappedId === unitId) {
          return this.players.get(ownerId)?.areaId ?? this.defaultAreaId
        }
      }
    }
    return undefined
  }

  getMonsterOrAllyArea(unitId: number): number | undefined {
    const m = this.monsters.get(unitId)
    if (m) return m.areaId
    return this.getMercenaryOrPetArea(unitId)
  }

  private stepMercenaries(): void {
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || merc.hp <= 0) continue
      const owner = this.players.get(merc.ownerPlayerId)
      if (!owner || owner.dead) continue

      if (merc.areaId !== owner.areaId) {
        merc.areaId = owner.areaId
        merc.x = owner.x + 1
        merc.y = owner.y + 1
        merc.state = 'idle'
        this.broadcastToArea(merc.areaId, {
          type: 'UnitReassign',
          unitType: 'monster',
          id: merc.unitId,
          unitId: merc.unitId,
          at: { x: merc.x, y: merc.y },
          x: merc.x,
          y: merc.y,
          areaId: merc.areaId,
          snap: true,
        })
        continue
      }

      if (merc.cooldown > 0) {
        merc.cooldown--
      }

      const mercUnit: MercenaryUnitState = {
        act: merc.act,
        subType: merc.subType,
        level: merc.level,
        difficulty: merc.difficulty,
        x: merc.x,
        y: merc.y,
        hp: merc.hp,
        maxHp: merc.maxHp,
        damage: merc.damage,
        alive: merc.alive,
        activeAura: merc.activeAura,
      }
      const outcome = tickMercenaryAi25Hz(
        mercUnit,
        {
          player: { x: owner.x, y: owner.y } as any,
          players: [],
          monsters: [],
          tick: this.currentFrame,
          events: [],
          pendingKills: [],
        } as any,
      )
      if (outcome.activeAura) {
        merc.activeAura = outcome.activeAura
      }
      this.syncMercenaryOwnerAura(owner, merc.activeAura)

      const ownerDist = Math.hypot(owner.x - merc.x, owner.y - merc.y)
      if (ownerDist > 35) {
        merc.x = owner.x
        merc.y = owner.y
        merc.state = 'idle'
        this.broadcastToArea(merc.areaId, {
          type: 'UnitReassign',
          unitType: 1,
          id: merc.unitId,
          unitId: merc.unitId,
          areaId: merc.areaId,
          at: { x: Math.round(merc.x), y: Math.round(merc.y) },
          x: Math.round(merc.x),
          y: Math.round(merc.y),
          snap: true,
        })
        continue
      }

      let bestTarget: InternalMonsterRecord | undefined
      let bestDist = merc.aggroRadius
      for (const m of this.monsters.values()) {
        if (
          m.dead ||
          m.isNpc ||
          !m.isKillable ||
          m.petIgnore ||
          m.areaId !== merc.areaId
        ) {
          continue
        }
        const d = Math.hypot(m.x - merc.x, m.y - merc.y)
        if (d <= bestDist) {
          bestDist = d
          bestTarget = m
        }
      }

      if (bestTarget) {
        if (bestDist <= merc.reach) {
          merc.state = 'attack'
          if (merc.cooldown <= 0) {
            merc.cooldown = merc.cooldownTicks
            this.applyDamageToMonster(owner, bestTarget, merc.damage, 0, undefined, 'merc')
          }
        } else if (this.currentFrame % 2 === 0) {
          merc.state = 'chase'
          const dx = bestTarget.x - merc.x
          const dy = bestTarget.y - merc.y
          const nextX =
            Math.round((merc.x + (dx / bestDist) * 1.4) * 100) / 100
          const nextY =
            Math.round((merc.y + (dy / bestDist) * 1.4) * 100) / 100
          if (
            this.isMonsterStepWalkable(
              merc.areaId,
              merc.x,
              merc.y,
              nextX,
              nextY,
              false,
            )
          ) {
            merc.x = nextX
            merc.y = nextY
            this.broadcastToArea(merc.areaId, {
              type: 'UnitMove',
              unitType: 'monster',
              id: merc.unitId,
              unitId: merc.unitId,
              areaId: merc.areaId,
              mode: 'walk',
              to: { x: Math.round(merc.x), y: Math.round(merc.y) },
              x: Math.round(merc.x),
              y: Math.round(merc.y),
            })
          }
        }
      } else if (ownerDist > 4 && this.currentFrame % 2 === 0) {
        merc.state = 'follow'
        const dx = owner.x - merc.x
        const dy = owner.y - merc.y
        const nextX =
          Math.round((merc.x + (dx / ownerDist) * 1.4) * 100) / 100
        const nextY =
          Math.round((merc.y + (dy / ownerDist) * 1.4) * 100) / 100
        if (
          this.isMonsterStepWalkable(
            merc.areaId,
            merc.x,
            merc.y,
            nextX,
            nextY,
            false,
          )
        ) {
          merc.x = nextX
          merc.y = nextY
          this.broadcastToArea(merc.areaId, {
            type: 'UnitMove',
            unitType: 'monster',
            id: merc.unitId,
            unitId: merc.unitId,
            areaId: merc.areaId,
            mode: 'walk',
            to: { x: Math.round(merc.x), y: Math.round(merc.y) },
            x: Math.round(merc.x),
            y: Math.round(merc.y),
          })
        }
      } else {
        merc.state = 'idle'
      }
    }
  }

  getSummonManager(ownerPlayerId: number): SummonManager {
    let mgr = this.summonManagers.get(ownerPlayerId)
    if (!mgr) {
      mgr = new SummonManager(this.registry)
      this.summonManagers.set(ownerPlayerId, mgr)
    }
    return mgr
  }

  summonPet(ownerPlayerId: number, spec: SummonPetSpec): CreatePetOutcome {
    const owner = this.players.get(ownerPlayerId)
    const mgr = this.getSummonManager(ownerPlayerId)
    const statList = new UnitStatList()
    statList.setBaseStat('level', owner?.level ?? 1)
    statList.setBaseStat('maxhp', owner?.maxHpFixed ?? 100 * FIXED_ONE)
    statList.setHp256(owner?.hpFixed ?? 100 * FIXED_ONE)
    if (owner) {
      for (const [skId, lvl] of owner.skills.entries()) {
        statList.setBaseSkillLevel(skId, lvl)
      }
    }
    const slvl = Math.max(
      1,
      spec.slvl ?? spec.skillLevel ?? owner?.skills.get(spec.skillId) ?? 1,
    )
    statList.setBaseSkillLevel(spec.skillId, slvl)

    const ownerCtx: CombatUnitContext = {
      id: String(ownerPlayerId),
      name: owner?.name ?? `Player_${ownerPlayerId}`,
      unitType: 'player',
      statList,
      stateBus: new StateBus(statList),
      x: owner?.x ?? 128,
      y: owner?.y ?? 128,
    }

    const requiresCorpse =
      spec.skillId === 70 || spec.skillId === 80 || spec.skillId === 95
    const corpses: {
      id: string
      consumed: boolean
      baseMaxHp?: number
      classId?: number
      monId?: string
      monsterLevel?: number
      isBoss?: boolean
      revivable?: boolean
      isUnique?: boolean
      isChampion?: boolean
      states?: ReadonlySet<number>
      x?: number
      y?: number
      _monsterRef?: InternalMonsterRecord
    }[] = []

    if (requiresCorpse) {
      for (const m of this.monsters.values()) {
        if (!m.dead || m.shattered || m.isNpc) continue
        if (owner && m.areaId !== owner.areaId) continue
        if (
          spec.corpseMonsterId !== undefined &&
          m.unitId !== spec.corpseMonsterId
        ) {
          continue
        }
        corpses.push({
          id: String(m.unitId),
          consumed: false,
          baseMaxHp: m.baseMaxHp,
          classId: m.classId,
          monId: m.defId,
          monsterLevel: m.level,
          isBoss: m.isBoss,
          revivable: !m.isBoss && m.rank === 'normal',
          isUnique: m.rank === 'unique',
          isChampion: m.rank === 'champion',
          states: m.states,
          x: m.x,
          y: m.y,
          _monsterRef: m,
        })
      }
      const refX = spec.x ?? (owner ? owner.x : 0)
      const refY = spec.y ?? (owner ? owner.y : 0)
      corpses.sort((a, b) => {
        const da = ((a.x ?? refX) - refX) ** 2 + ((a.y ?? refY) - refY) ** 2
        const db = ((b.x ?? refX) - refX) ** 2 + ((b.y ?? refY) - refY) ** 2
        return da - db
      })
    }

    const areaId = owner?.areaId ?? this.defaultAreaId ?? 1
    let spawnX = spec.x ?? (owner ? owner.x + 1 : 128)
    let spawnY = spec.y ?? (owner ? owner.y + 1 : 128)
    if (
      this.terrainWalkableCheck &&
      !this.isWorldWalkableForPlayer(areaId, Math.round(spawnX), Math.round(spawnY))
    ) {
      let nudged = false
      for (let r = 1; r <= 5 && !nudged; r++) {
        for (let dy = -r; dy <= r && !nudged; dy++) {
          for (let dx = -r; dx <= r && !nudged; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
            const cx = Math.round(spawnX) + dx
            const cy = Math.round(spawnY) + dy
            if (this.isWorldWalkableForPlayer(areaId, cx, cy)) {
              spawnX = cx
              spawnY = cy
              nudged = true
            }
          }
        }
      }
      if (!nudged && owner) {
        spawnX = owner.x
        spawnY = owner.y
      }
    }

    if (requiresCorpse && corpses.length > 1) {
      const targetX = spec.x ?? owner?.x ?? spawnX
      const targetY = spec.y ?? owner?.y ?? spawnY
      corpses.sort(
        (a, b) =>
          Math.hypot((a.x ?? 0) - targetX, (a.y ?? 0) - targetY) -
          Math.hypot((b.x ?? 0) - targetX, (b.y ?? 0) - targetY),
      )
    }

    const outcome = mgr.createPet({
      owner: ownerCtx,
      skillId: spec.skillId,
      slvl,
      x: spawnX,
      y: spawnY,
      difficulty: this.difficulty,
      ...(requiresCorpse ? { corpses } : {}),
    })

    for (const c of corpses) {
      if (c.consumed && c._monsterRef) {
        c._monsterRef.shattered = true
        this.broadcastToArea(c._monsterRef.areaId, {
          type: 'UnitRemove',
          unitType: 1,
          id: c._monsterRef.unitId,
          unitId: c._monsterRef.unitId,
          areaId: c._monsterRef.areaId,
        })
      }
    }
    for (const evictedUid of outcome.evictedPetUids) {
      const evictedUnitId = this.petUnitIds.get(evictedUid)
      if (evictedUnitId !== undefined) {
        this.petUnitIds.delete(evictedUid)
        this.broadcastToArea(areaId, {
          type: 'UnitRemove',
          unitType: 1,
          id: evictedUnitId,
          unitId: evictedUnitId,
        })
        this.emitToPlayer(ownerPlayerId, {
          type: 'Merc',
          kind: 'assign',
          isSummonAction: true,
          summonAction: 0,
          petType: 1,
          mercId: evictedUnitId,
          ownerId: ownerPlayerId,
          classId: spec.skillId,
        })
      }
    }

    if (outcome.created && outcome.pet) {
      const petUnitId = this.allocateUnitId()
      this.petUnitIds.set(outcome.pet.uid, petUnitId)
      const petMeta = outcome.pet as unknown as {
        unitId?: number
        areaId?: number
      }
      petMeta.unitId = petUnitId
      petMeta.areaId = areaId
      const petTypeIdx =
        PET_TYPE_IDX_BY_NAME_113C[outcome.pet.petType] ??
        PET_TYPE_PORTRAIT_TABLE[0]?.idx ??
        1
      const classId = outcome.pet.classId ?? 363
      this.broadcastToArea(areaId, {
        type: 'UnitAssign',
        unitType: 'monster',
        unitId: petUnitId,
        classId,
        name: outcome.pet.name,
        x: outcome.pet.x,
        y: outcome.pet.y,
        areaId,
        unit: {
          unitType: 1,
          id: petUnitId,
          classId,
          name: outcome.pet.name,
          x: outcome.pet.x,
          y: outcome.pet.y,
          mode: 1,
          lifePct: 128,
        },
      })
      this.emitToPlayer(ownerPlayerId, {
        type: 'Merc',
        kind: 'assign',
        isSummonAction: true,
        summonAction: 1,
        petType: petTypeIdx,
        mercId: petUnitId,
        ownerId: ownerPlayerId,
        classId: spec.skillId,
      })
    }

    return outcome
  }

  unsummonPetAt(
    ownerPlayerId: number,
    x: number,
    y: number,
    radius = 80,
  ): SummonedPetUnit | null {
    const mgr = this.summonManagers.get(ownerPlayerId)
    if (!mgr) return null
    const removed = mgr.unsummonOwnPetAt(String(ownerPlayerId), x, y, radius)
    if (removed) {
      const petUnitId = this.petUnitIds.get(removed.uid)
      const owner = this.players.get(ownerPlayerId)
      const areaId = owner?.areaId ?? this.defaultAreaId ?? 1
      if (petUnitId !== undefined) {
        this.petUnitIds.delete(removed.uid)
        this.broadcastToArea(areaId, {
          type: 'UnitRemove',
          unitType: 1,
          id: petUnitId,
          unitId: petUnitId,
        })
        this.emitToPlayer(ownerPlayerId, {
          type: 'Merc',
          kind: 'assign',
          isSummonAction: true,
          summonAction: 0,
          petType: PET_TYPE_IDX_BY_NAME_113C[removed.petType] ?? 1,
          mercId: petUnitId,
          ownerId: ownerPlayerId,
          classId: removed.sourceSkillId,
        })
      }
    }
    return removed
  }

  getPetsForOwner(ownerPlayerId: number): readonly SummonedPetUnit[] {
    const mgr = this.summonManagers.get(ownerPlayerId)
    return mgr ? mgr.getActivePets().filter((pet) => pet.alive !== false && pet.hp > 0) : []
  }

  getPetState(
    idOrOutcome:
      | number
      | string
      | {
          readonly pet?: SummonedPetUnit | null | undefined
          readonly uid?: string | undefined
        },
  ): SummonedPetUnit | undefined {
    if (typeof idOrOutcome === 'object' && idOrOutcome !== null) {
      const targetUid = idOrOutcome.pet?.uid ?? idOrOutcome.uid
      if (targetUid) {
        for (const mgr of this.summonManagers.values()) {
          for (const pet of mgr.getActivePets()) {
            if (pet.uid === targetUid) return pet
          }
        }
      }
      return idOrOutcome.pet ?? undefined
    }
    for (const mgr of this.summonManagers.values()) {
      for (const pet of mgr.getActivePets()) {
        const mappedId =
          this.petUnitIds.get(pet.uid) ??
          (pet as unknown as { unitId?: number }).unitId
        if (
          pet.uid === String(idOrOutcome) ||
          mappedId === idOrOutcome ||
          Number(pet.uid) === idOrOutcome
        ) {
          return pet
        }
      }
    }
    return undefined
  }

  private stepSummonedPets(): void {
    for (const [ownerPlayerId, mgr] of this.summonManagers.entries()) {
      const owner = this.players.get(ownerPlayerId)
      if (!owner || owner.dead) continue
      const pets = mgr.getActivePets()
      for (const pet of pets) {
        if (pet.hp <= 0 || pet.alive === false) continue
        const isStationary =
          Boolean(pet.isStationary) ||
          pet.petType === 'assassintrap' ||
          pet.petType === 'hydra' ||
          pet.petType === 'totem' ||
          pet.petType === 'vine'
        const isFlyingPet = pet.petType === 'raven'
        const petUnitId =
          this.petUnitIds.get(pet.uid) ??
          (pet as unknown as { unitId?: number }).unitId
        const petMeta = pet as unknown as { areaId?: number; unitId?: number }
        if (petUnitId !== undefined && petMeta.unitId === undefined) {
          petMeta.unitId = petUnitId
        }

        const ownerDist = Math.hypot(owner.x - pet.x, owner.y - pet.y)
        if (
          !isStationary &&
          (ownerDist > 35 ||
            (petMeta.areaId !== undefined && petMeta.areaId !== owner.areaId))
        ) {
          pet.x = owner.x
          pet.y = owner.y
          petMeta.areaId = owner.areaId
          if (petUnitId !== undefined) {
            this.broadcastToArea(owner.areaId, {
              type: 'UnitReassign',
              unitType: 1,
              id: petUnitId,
              unitId: petUnitId,
              areaId: owner.areaId,
              at: { x: Math.round(pet.x), y: Math.round(pet.y) },
              x: Math.round(pet.x),
              y: Math.round(pet.y),
              snap: true,
            })
          }
          continue
        }
        petMeta.areaId = owner.areaId

        let bestTarget: InternalMonsterRecord | undefined
        let bestDist = 25
        for (const m of this.monsters.values()) {
          if (
            m.dead ||
            m.isNpc ||
            !m.isKillable ||
            m.petIgnore ||
            m.areaId !== owner.areaId
          ) {
            continue
          }
          const d = Math.hypot(m.x - pet.x, m.y - pet.y)
          if (d <= bestDist) {
            bestDist = d
            bestTarget = m
          }
        }

        if (bestTarget) {
          if (bestDist <= 2.5 || (isStationary && bestDist <= 18)) {
            if (this.currentFrame % 8 === 0) {
              const dmg = Math.max(
                2,
                (pet.minDamage ?? 5) + pet.slvl * 3,
              )
              this.applyDamageToMonster(
                owner,
                bestTarget,
                dmg,
                pet.sourceSkillId,
              )
            }
          } else if (!isStationary && this.currentFrame % 2 === 0) {
            const dx = bestTarget.x - pet.x
            const dy = bestTarget.y - pet.y
            const nextX =
              Math.round((pet.x + (dx / bestDist) * 1.3) * 100) / 100
            const nextY =
              Math.round((pet.y + (dy / bestDist) * 1.3) * 100) / 100
            if (
              this.isMonsterStepWalkable(
                owner.areaId,
                pet.x,
                pet.y,
                nextX,
                nextY,
                isFlyingPet,
              )
            ) {
              pet.x = nextX
              pet.y = nextY
              if (petUnitId !== undefined) {
                this.broadcastToArea(owner.areaId, {
                  type: 'UnitMove',
                  unitType: 'monster',
                  id: petUnitId,
                  unitId: petUnitId,
                  areaId: owner.areaId,
                  mode: 'walk',
                  to: { x: Math.round(pet.x), y: Math.round(pet.y) },
                  x: Math.round(pet.x),
                  y: Math.round(pet.y),
                })
              }
            }
          }
        } else if (!isStationary && ownerDist > 4) {
          const dx = owner.x - pet.x
          const dy = owner.y - pet.y
          const nextX =
            Math.round((pet.x + (dx / ownerDist) * 0.85) * 100) / 100
          const nextY =
            Math.round((pet.y + (dy / ownerDist) * 0.85) * 100) / 100
          if (
            this.isMonsterStepWalkable(
              owner.areaId,
              pet.x,
              pet.y,
              nextX,
              nextY,
              isFlyingPet,
            )
          ) {
            pet.x = nextX
            pet.y = nextY
            if (petUnitId !== undefined) {
              this.broadcastToArea(owner.areaId, {
                type: 'UnitMove',
                unitType: 'monster',
                id: petUnitId,
                unitId: petUnitId,
                areaId: owner.areaId,
                mode: 'walk',
                to: { x: Math.round(pet.x), y: Math.round(pet.y) },
                x: Math.round(pet.x),
                y: Math.round(pet.y),
              })
            }
          }
        }
      }
    }
  }

  getNpcVendorPool(npcUnitId: number): readonly ServerItemEntry[] {
    const m = this.monsters.get(npcUnitId)
    if (!m) return []
    return m.vendorPool.map((i) => ({ ...i, stats: new Map(i.stats) }))
  }

  getAllUnits(): readonly ServerUnitSummary[] {
    const out: ServerUnitSummary[] = []
    for (const p of this.players.values()) {
      out.push({
        unitType: 'player',
        unitId: p.unitId,
        classId: p.classId,
        x: p.x,
        y: p.y,
        areaId: p.areaId,
        name: p.name,
        mode: p.mode,
        hp: p.hp,
        maxHp: p.maxHp,
      })
    }
    for (const m of this.monsters.values()) {
      out.push({
        unitType: 'monster',
        unitId: m.unitId,
        classId: m.classId,
        x: m.x,
        y: m.y,
        areaId: m.areaId,
        name: m.name,
        mode: m.mode,
        hp: m.hp,
        maxHp: m.maxHp,
      })
    }
    for (const merc of this.mercenaries.values()) {
      out.push({
        unitType: 'monster',
        unitId: merc.unitId,
        classId: merc.classId,
        x: merc.x,
        y: merc.y,
        areaId: merc.areaId,
        name: merc.name,
        mode: merc.alive ? 1 : 12,
        hp: merc.hp,
        maxHp: merc.maxHp,
      })
    }
    for (const o of this.objects.values()) {
      out.push({
        unitType: 'object',
        unitId: o.unitId,
        classId: o.classId,
        x: o.x,
        y: o.y,
        areaId: o.areaId,
        mode: o.mode,
      })
    }
    for (const g of this.groundItems.values()) {
      out.push({
        unitType: 'item',
        unitId: g.unitId,
        classId: 0,
        x: g.x,
        y: g.y,
        areaId: g.areaId,
        name: g.code,
      })
    }
    for (const ms of this.missiles.values()) {
      out.push({
        unitType: 'missile',
        unitId: ms.unitId,
        classId: ms.missileId,
        x: ms.x,
        y: ms.y,
        areaId: ms.areaId,
      })
    }
    return out
  }

  exportPlayerD2s(playerUnitId: number): Uint8Array {
    const p = this.players.get(playerUnitId)
    if (!p) {
      throw new Error(
        `GameInstance.exportPlayerD2s: unknown player unitId ${playerUnitId}`,
      )
    }

    const skillsArray = new Uint8Array(30)
    const offset = CLASS_SKILL_OFFSET[p.classId] ?? 6
    if (p.d2sTemplate?.skills) {
      skillsArray.set(p.d2sTemplate.skills.subarray(0, 30))
    }
    for (const [skillId, slvl] of p.skills.entries()) {
      const idx = skillId - offset
      if (idx >= 0 && idx < 30) {
        skillsArray[idx] = Math.max(0, Math.min(255, slvl))
      }
    }

    const template = p.d2sTemplate
    const defaultWp = createDefaultWaypointData()
    const waypoints: [Uint8Array, Uint8Array, Uint8Array] = template?.waypoints
      ? [
          new Uint8Array(template.waypoints[0]),
          new Uint8Array(template.waypoints[1]),
          new Uint8Array(template.waypoints[2]),
        ]
      : [
          defaultWp.slice(8, 32),
          defaultWp.slice(32, 56),
          defaultWp.slice(56, 80),
        ]

    const diffWp = waypoints[this.difficulty]
    diffWp.fill(0, 2, 7)
    for (const areaId of p.waypoints) {
      const bitIndex = WAYPOINT_AREA_IDS.indexOf(areaId)
      if (bitIndex !== -1) {
        const byteIdx = 2 + (bitIndex >> 3)
        const bitMask = 1 << (bitIndex & 7)
        diffWp[byteIdx] = (diffWp[byteIdx] ?? 0) | bitMask
      }
    }
    const questsDiffs = template?.quests
      ? ([
          new Uint16Array(template.quests[0]),
          new Uint16Array(template.quests[1]),
          new Uint16Array(template.quests[2]),
        ] as [Uint16Array, Uint16Array, Uint16Array])
      : ([new Uint16Array(48), new Uint16Array(48), new Uint16Array(48)] as [
          Uint16Array,
          Uint16Array,
          Uint16Array,
        ])
    questsDiffs[this.difficulty] = new Uint16Array(p.questFlags)

    const statusFlags = template?.statusFlags ?? 0x20
    const isExpansion = (statusFlags & 0x20) !== 0
    const actsPerDiff = isExpansion ? 5 : 4
    const bossQuests = isExpansion
      ? (['a1q6', 'a2q6', 'a3q6', 'a4q3', 'a5q6'] as const)
      : (['a1q6', 'a2q6', 'a3q6', 'a4q3'] as const)
    let computedProgression = template?.progression ?? 0
    for (let d = 0; d < 3; d++) {
      const qWords = questsDiffs[d]!
      for (let a = 0; a < bossQuests.length; a++) {
        if (hasQuestFlag113c(qWords, bossQuests[a]!, QUEST_FLAG_COMPLETED_113C)) {
          computedProgression = Math.max(computedProgression, d * actsPerDiff + (a + 1))
        }
      }
    }

    const activeMerc = this.getMercenaryForOwner(playerUnitId)
    const exportedMerc = activeMerc
      ? {
          dead: !activeMerc.alive,
          seed: (template?.merc?.seed || activeMerc.unitId || 1) >>> 0,
          nameId: template?.merc?.nameId ?? 0,
          typeId: activeMerc.subType,
          experience: Math.max(
            template?.merc?.experience ?? 0,
            experienceForLevel113c(activeMerc.level),
          ),
        }
      : template?.merc

    return writeD2sSave113c(
      {
        name: p.name,
        classId: p.classId,
        level: p.level,
        statusFlags,
        progression: computedProgression,
        activeWeapon: template?.activeWeapon ?? 0,
        timestampSec: template?.timestampSec ?? 0,
        hotkeys: template?.hotkeys,
        leftSkill: p.leftSkill,
        rightSkill: p.rightSkill,
        altLeftSkill: template?.altLeftSkill ?? 0,
        altRightSkill: template?.altRightSkill ?? 0,
        appearance: template?.appearance,
        activeDifficulty: this.difficulty,
        activeAct: p.act,
        mapSeed: this.canPersistMapSeed()
          ? this.currentMapSeed
          : (template?.mapSeed ?? 0),
        merc: exportedMerc,
        mercItems: template?.mercItems,
        quests: questsDiffs,
        waypoints,
        npcIntro: template?.npcIntro ?? createDefaultNpcIntroData(),
        attributes: {
          strength: p.strength,
          energy: p.energy,
          dexterity: p.dexterity,
          vitality: p.vitality,
          statPts: p.statPts,
          newSkills: p.newSkills,
          hitpointsFixed: Math.max(1, p.hpFixed),
          maxHpFixed: p.maxHpFixed,
          manaFixed: p.manaFixed,
          maxManaFixed: p.maxManaFixed,
          staminaFixed: p.staminaFixed,
          maxStaminaFixed: p.maxStaminaFixed,
          level: p.level,
          experience: Math.max(p.experience, experienceForLevel113c(p.level)),
          gold: p.gold,
          goldBank: p.goldBank,
        },
        skills: skillsArray,
        items: p.items.map((item) => this.serverEntryToItemData(item)),
        corpseItems: p.corpseItems.map((item) => this.serverEntryToItemData(item)),
        ironGolem: p.ironGolemItem
          ? this.serverEntryToItemData(p.ironGolemItem)
          : null,
      },
      getServerItemDataTables(),
    )
  }

  computeFrameLockstepHash(): number {
    let h = 0x811c9dc5
    const mix = (val: number): void => {
      const v = val >>> 0
      h ^= v & 0xff
      h = Math.imul(h, 0x01000193) >>> 0
      h ^= (v >>> 8) & 0xff
      h = Math.imul(h, 0x01000193) >>> 0
      h ^= (v >>> 16) & 0xff
      h = Math.imul(h, 0x01000193) >>> 0
      h ^= (v >>> 24) & 0xff
      h = Math.imul(h, 0x01000193) >>> 0
    }

    mix(this.currentFrame)
    mix(this.currentMapSeed)
    const rngState = this.rng.getSeed()
    mix(rngState.lo)
    mix(rngState.hi)
    mix(this.playersX)

    for (const p of this.players.values()) {
      mix(p.unitId)
      mix(p.areaId)
      mix(Math.round(p.x * 100))
      mix(Math.round(p.y * 100))
      mix(p.hpFixed)
      mix(p.maxHpFixed)
      mix(p.manaFixed)
      mix(p.experience)
      mix(p.level)
      mix(p.strength)
      mix(p.dexterity)
      mix(p.vitality)
      mix(p.energy)
      mix(p.gold)
      mix(p.statPts)
      mix(p.newSkills)
      mix(p.items.length)
      mix(p.dead ? 1 : 0)
    }

    for (const m of this.monsters.values()) {
      mix(m.unitId)
      mix(m.areaId)
      mix(Math.round(m.x * 100))
      mix(Math.round(m.y * 100))
      mix(m.hp)
      mix(m.mode)
      mix(m.dead ? 1 : 0)
    }

    for (const merc of this.mercenaries.values()) {
      mix(merc.unitId)
      mix(merc.areaId)
      mix(Math.round(merc.x * 100))
      mix(Math.round(merc.y * 100))
      mix(merc.hp)
      mix(merc.alive ? 1 : 0)
    }

    for (const [ownerId, mgr] of this.summonManagers.entries()) {
      mix(ownerId)
      for (const pet of mgr.getActivePets()) {
        mix(Math.round(pet.x * 100))
        mix(Math.round(pet.y * 100))
        mix(pet.hp)
      }
    }

    for (const ms of this.missiles.values()) {
      mix(ms.unitId)
      mix(Math.round(ms.x * 100))
      mix(Math.round(ms.y * 100))
    }

    for (const g of this.groundItems.values()) {
      mix(g.unitId)
      mix(Math.round(g.x * 100))
      mix(Math.round(g.y * 100))
      mix(g.quality)
    }

    return h >>> 0
  }

  getStateHash(): number {
    return this.computeFrameLockstepHash()
  }

  getLastLockstepHash(): number {
    return this.computeFrameLockstepHash()
  }
}
