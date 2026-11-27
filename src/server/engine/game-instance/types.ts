/**
 * GameInstance Public & Internal Types (`src/server/engine/game-instance/types.ts`).
 */

import type { MissileRecord, SkillRecord } from '../../../common/data/data-registry.ts'
import type { DrlgEnv } from '../../../common/drlg/drlg-types.ts'
import type { Item } from '../../../common/items/items.ts'
import type { LocalMovementPredictor } from '../../../common/path/movement-predictor.ts'
import type { SubTilePoint } from '../../../common/path/pathfind.ts'
import type { MonAiFamily } from '../../../common/units/monai-113c.ts'
import type { CharacterClassCode } from '../../../common/units/classes.ts'
import type { HirelingCandidateDesc } from '../../../common/units/hireling-table.ts'
import type { MonsterModeMissiles113c, MonsterRank } from '../../../common/units/monsters-data.ts'
import type { MonsterElementalAttack, MonsterSkillEntry } from '../../../common/units/unit-types.ts'
import type { CharClassId, ClientCommand, ItemData, LocalAreaBootstrap, LocalAreaBootstrapResolver, LocalAreaPresetMonster, LocalAreaRoomReveal, UnitType } from '../../../netproto/index.ts'
import type { LevelPopulationPlan113c, PopulationRoomRect } from '../../ai/room-streamer.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import type { ResolvedMonsterMonProps113c } from '../../ai/monprop-113c.ts'
import type { RolledMonsterLoadout113c } from '../../ai/monequip-helper-113c.ts'
import type { CombatUnitContext } from '../combat-pipeline.ts'
import type { OnlineMissileState113c } from '../missile-engine.ts'
import type { LinearMissilePathState113c } from '../missile-path-113c.ts'
import type { D2sDecodedCharacterSave } from '../../save/d2s-reader.ts'
import type { UnitStatList } from '../stat-list.ts'
import type { StateBus } from '../state-bus.ts'
import type { AuraScanner, ActiveAuraSource } from '../aura-scanner.ts'
import type { BladeSentinelPatrolState113c, ConversionSavedStats113c } from '../../skills/p1-wave4-skills-113c.ts'
import type { SkillEvalResult } from '../../skills/types.ts'


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
  readonly worldEventSojThreshold?: number | undefined
  readonly registry?: unknown
  /**
   * Server-side area bootstrap resolver (`src/server/world/area-bootstrap.ts`): when set, areas are
   * brought online on demand (game entry, waypoint, town portal, warp) with their collision, rooms,
   * preset objects/NPCs/monsters and warps, and players land on standable floor of the target area.
   */
  readonly resolveAreaBootstrap?: LocalAreaBootstrapResolver | undefined
  /** Whether ladder-only runewords and cube recipes (`server=1` / `ladder=1`) are enabled (defaults to `false`, `#1949`). */
  readonly ladder?: boolean | undefined
  readonly isLadder?: boolean | undefined
  /**
   * `#1789`: When enabled, player casts and attacks step through 25Hz `AnimDispatcher` windup,
   * `ActionFlag` release, multi-hit rollback/sequence keyframes (`#1862`), follow-through frame-lock,
   * and pre-`ActionFlag` `GH`/`BL` interruption.
   */
  readonly animActionWindup?: boolean | undefined
  readonly enableAnimWindup?: boolean | undefined
  /**
   * 1.13c DRLG environment (`MapService.getDrlgEnv()`): when provided, enables per-room DRLG
   * activation, procedural monster/object population (`0x6FD01430`), per-level `D2MonRegStrc`
   * outfit pre-rolls (`0x6FCEAB30`), and 12-frame distant-room hibernation (`0x6FC4CB60`).
   */
  readonly drlgEnv?: DrlgEnv | null | undefined
}


export interface ConnectPlayerSpec {
  readonly charName?: string | undefined
  readonly name?: string | undefined
  readonly classId?: CharClassId | CharacterClassCode | number | string | undefined
  readonly charClass?: CharClassId | CharacterClassCode | number | string | undefined
  readonly level?: number | undefined
  readonly experience?: number | undefined
  readonly hp?: number | undefined
  readonly maxHp?: number | undefined
  readonly mana?: number | undefined
  readonly maxMana?: number | undefined
  readonly stamina?: number | undefined
  readonly maxStamina?: number | undefined
  readonly strength?: number | undefined
  readonly dexterity?: number | undefined
  readonly vitality?: number | undefined
  readonly energy?: number | undefined
  readonly statPts?: number | undefined
  readonly newSkills?: number | undefined
  readonly gold?: number | undefined
  readonly goldBank?: number | undefined
  readonly ar?: number | undefined
  readonly tohit?: number | undefined
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
  readonly leftSkill?: number | undefined
  readonly rightSkill?: number | undefined
  readonly restoreMercenary?: boolean | undefined
  readonly hardcore?: boolean | undefined
  readonly isHardcore?: boolean | undefined
  readonly statusFlags?: number | undefined
  readonly questFlags?: Uint16Array | undefined
  /**
   * Starting items of a character created without a full `.d2s`: `'charstats'` gives the 1.13c
   * `CharStats.txt` `item1..item10` kit (a new character entering its first game); the default is the
   * legacy 4-potion kit.
   */
  readonly startingItems?: 'charstats' | undefined
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
  /** S2C `0xAC` 16-bit monster name/palette seed (`MonsterData+0x18`, `D2Client 0x6fb5e5cf`). */
  readonly nameSeed?: number | undefined
  /** S2C `0xAC` 16-component animation appearance indices (`HD..S8`, `D2Game 0x6fcacb35`). */
  readonly compVariants?: readonly number[] | undefined
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
  /** Optional explicit override for `stat 100 = monster_playercount` recorded at spawn (`D2Game!0x6FCCF840` / `0x6FCCFF3B`). */
  readonly monsterPlayerCount?: number | undefined
  /** Spawn submerge-capable monsters (`247..249`, `258..263`) already surfaced (`mode = 1`). */
  readonly startSurfaced?: boolean | undefined
  /** Spawn `4..6` companion `Tentacle` (`258..260`) limbs around a `TentacleHead` (`261..263`). */
  readonly spawnTentacleLimbs?: boolean | undefined
  /** Parent `TentacleHead` unitId linked to a `Tentacle` limb (`AiTentacle` `0x6FC9CB10` boss check). */
  readonly bossUnitId?: number | undefined
  /** Summoned Uber Tristram minion (`D2Game.dll` `0x6FD0A730..0x6FD0AB09`): 0 XP, 0 drops, despawns on 3rd Uber Prime death (#1841). */
  readonly isUberSummonedMinion?: boolean | undefined
  /** `MonUMod #41` (`always_run_ai`) override (#1906). */
  readonly alwaysRunAi?: boolean | undefined
  /** `MonStats.txt` `killminions` override (#1906). */
  readonly killMinions?: boolean | undefined
  /** Explicit `/players 1` normal base max HP override for Corpse Explosion (`#1882`). */
  readonly unscaledMaxHp?: number | undefined
  /** Bone Wall (`#78`) / Bone Prison (`#88`) construct owner player `unitId` (`#1883`). */
  readonly boneConstructOwnerPlayerId?: number | undefined
  /** Explicit auto-despawn frame (`0` = permanent, `#1883`). */
  readonly despawnAtFrame?: number | undefined
  /** Summoned/hatched/revived monster flag preventing duplicate XP or item drops (`#1891`, `#1892`, `#1894`). */
  readonly alreadyGrantedKillRewards?: boolean | undefined
  /** `MonStats.txt` `Align` (`0` = Evil, `1` = Good/Friendly, `2` = Neutral, `#2005`). */
  readonly align?: 0 | 1 | 2 | undefined
  /** DS1 `pMapAI` town NPC waypoint path (`AI_FollowDs1NpcPath` `0x6FC3BBC0`). */
  readonly mapAi?: LocalAreaPresetMonster['mapAi']
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
  readonly experience?: number | undefined
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
  readonly experience: number
  readonly expPerLvl: number
  readonly states?: ReadonlySet<number> | undefined
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
  readonly restoreSavedIronGolem?: boolean | undefined
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
  /** Optional explicit container trap type (`1..9`, `gpTrapFnTable` `0x6FD27B8C`, #1918). */
  readonly trapType?: number | undefined
  /** If true, rolls `rollChestTrapType113c` (`(areaLvl >> 3) + 5`%) when `trapType` is omitted (#1918). */
  readonly rollTrap?: boolean | undefined
  /** If true, rolls `rollPreOperateOpen113c` (`1/14` -> `mode = 2`) when `mode` is omitted (#1918). */
  readonly rollPreOperate?: boolean | undefined
  /**
   * DRLG room presets: the unit seed is drawn when the room is activated (`activatePresetRoomsNearPlayer113c`),
   * not at allocation, so the game-seed draw order follows 1.13c room activation.
   */
  readonly deferUnitSeed?: boolean | undefined
  /** Paired permanent red portal (`classId = 60`) `unitId` in the destination area (`D2Game.dll` `0x6FCC24C0`, #1841). */
  readonly linkedPortalId?: number | undefined
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
    | 'trade'
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
  /** Optional item PRNG seed (`D2Common #10695` `ITEMS_GetSeed`). */
  seed?: number | undefined
  /** 25 Hz server frame at which a ground item decays (`15000 / 30000 / 45000` frames, #1915). */
  expireFrame?: number | undefined
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
  readonly monsterPlayerCount: number
  readonly submerged: boolean
  readonly bossUnitId?: number | undefined
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


/** #1327: one level's DRLG rooms, its resolved `Levels.txt` plan and which rooms are populated. */
export interface AreaPopulationState {
  readonly rooms: readonly PopulationRoomRect[]
  readonly plan: LevelPopulationPlan113c | null
  readonly populated: Set<number>
}


/**
 * D2Game dispatches on `MonStats.AI` -> `MonAi.txt` row. `GameInstance` keeps one runtime
 * behavior family per AI row (the full 148-row state machines are the long-term target; this
 * table replaces the old defId/name regexes at least for the AI rows with distinct behavior).
 */
export type MonsterAiBehavior = MonAiFamily


export interface ItemBaseSizeInfo {
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
  /** Armor/Weapons/Misc.txt `type` token (e.g. `helm`, `circ`, `tors`, `shie`, `pole`, `spea`, `bow`, `swor`). */
  readonly itemType: string
  /** True when the base record originates from `Weapons.txt`. */
  readonly isWeapon: boolean
  /** True when `Weapons.txt` `2handed` is `1`. */
  readonly twoHanded: boolean
  /** `Weapons/Misc.txt` `stackable == 1`. */
  readonly stackable: boolean
  /** `Weapons/Misc.txt` `maxstack` (0 when non-stackable). */
  readonly maxStack: number
  /** `Armor/Weapons/Misc.txt` `Nameable == 1` (`D2Common.dll` `0x6FD74140`, `#1952`). */
  readonly nameable: boolean
}


export interface InternalPlayerRecord {
  unitId: number
  /**
   * 1.13c `D2PlayerDataStrc+0x148/+0x14C`: destination of the player's last SUNIT warp (written at
   * `D2Game.dll` `0x6FD01B19..0x6FD01B23`, cleared at `0x6FD0042B`); zero until the first warp. Read by
   * the NecroPet follow check `0x6FC3E366` (kb/monsters/d2game-necropet-ai-113c.md §3).
   */
  lastWarpPos113c?: { x: number; y: number } | undefined
  /** 1.13c `D2PlayerDataStrc::tHistoryPos` (`0x6FC99BF0`): 20-entry breadcrumb ring (`dx^2 + dy^2 > 45`). */
  breadcrumbs113c?: Array<{ x: number; y: number }> | undefined
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
  moveTargetUnitId?: number | undefined
  /** 1.13c unit type of `moveTargetUnitId` (ids are per type); undefined = legacy any-kind lookup. */
  moveTargetUnitType?: 0 | 1 | 2 | 3 | 4 | 5 | undefined
  /** 1.13c `D2Common#10329` (`0x6FCEE120`): skill queued while running into melee range of a unit. */
  queuedSkillOnTarget?:
    | {
        readonly skillId: number
        readonly targetId: number
        readonly targetType?: 0 | 1 | 2 | 3 | 4 | 5 | undefined
      }
    | undefined
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
  ar?: number | undefined
  tohit?: number | undefined
  statPts: number
  newSkills: number
  leftSkill: number
  rightSkill: number
  altLeftSkill: number
  altRightSkill: number
  leftSkillItemId?: number | undefined
  rightSkillItemId?: number | undefined
  altLeftSkillItemId?: number | undefined
  altRightSkillItemId?: number | undefined
  weaponSet?: number | undefined
  hotkeys: number[]
  hotkeyItemIds: number[]
  npcIntro: Uint8Array
  createdTimestampSec: number
  lastPlayedTimestampSec: number
  connectedFrame: number
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
  isHardcore?: boolean | undefined
  hasDied?: boolean | undefined
  statusFlags?: number | undefined
  corpseId: number | undefined
  corpseAreaId?: number | undefined
  corpseX: number
  corpseY: number
  corpseLostExp?: number | undefined
  corpseRequiresClick?: boolean | undefined
  extraCorpses?:
    | Array<{
        corpseId: number
        areaId: number
        x: number
        y: number
        items: ServerItemEntry[]
        lostExp?: number | undefined
      }>
    | undefined
  /** `D2Game.dll` `0x6FC57730` (`[pClient + 0x508]`): experience lost on most recent death. */
  lastDeathExpLoss?: number | undefined
  /** `D2Game.dll` `0x6FC58180` (`stat 0xAF` / `175`): gold lost on most recent death. */
  lastDeathGoldLoss?: number | undefined
  activeNpcId: number | undefined
  /** Tracks the NPC unitId whose C2S 0x13 -> S2C 0x28 handshake just ran, preventing duplicate S2C 0x27 info on immediate 0x2F follow-up. */
  lastNpcInteractHandshakeId?: number | undefined
  /** `D2Game.dll` `0x6FC7F89F..0x6FC7F94A`: once-per-game replacement of a lost unconsumed A5Q3 `'tr2'` scroll. */
  a5q3ReplacedTr2InGame?: boolean | undefined
  /** Cached 1.13c mercenary vendor candidate list (`D2Game.dll` `0x6FCDCED0` / `D2Common.dll` `0x6FD7CCC0`). */
  mercHireCandidates?: readonly HirelingCandidateDesc[] | undefined
  /** End frame of the player's `PLRMODE_GETHIT` (`mode = 4`) animation (`D2Game.dll` `0x6FCFD0FC`). */
  hitRecoveryUntilFrame?: number | undefined
  /** 1.13c `D2Game.dll` `0x6FD100D6` / `0x6FC8D176` / `0x6FCF0D61`: 60s (`1500f`) TP + Waypoint lockout after declaring hostility (#1858). */
  hostilePortalLockUntilFrame?: number | undefined
  /** End frame of the player's `PLRMODE_BLOCK` (`mode = 9`) animation (`D2Common.dll` `0x6FD831FE`). */
  blockRecoveryUntilFrame?: number | undefined
  /** Mode held until `blockRecoveryUntilFrame`: 9 (BL) or 13 (S1 dodge / avoid, `0x6FCFD1DC`). */
  blockRecoveryMode113c?: number | undefined
  /** `STAT 95` (frame of the last block, `0x6FCFD337`) gating the next BL mode (`0x6FCFD2F8`). */
  lastBlockFrame113c?: number | undefined
  /** Frame on which a new command may restart the current interruptible attack (`0x6FC98340` / `0x6FC97FA0`). */
  animRestartFrame113c?: number | undefined
  /** 1.13c `D2Game.dll` `0x6FC89E00`: 1-frame deferred reset to `NU`/`TN` after skill animation completion. */
  animResetFrame?: number | undefined
  /** 1.13c arrival-triggered skill windup: skip ticking `AnimDispatcher` on the movement arrival frame itself. */
  animStartSkipFrame?: number | undefined
  /** 1.13c interact queue: walk into range, then run the interaction. */
  pendingInteraction?:
    | {
        readonly kind: 'object' | 'warp' | 'npc' | 'waypoint' | 'corpse' | 'player'
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
export interface PlayerMotionState {
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


export interface InternalMonsterRecord {
  unitId: number
  classId: number
  hcIdx: number
  defId: string
  /** SuperUniques.txt row id when this is a preset super unique. */
  superUniqueId: string | undefined
  /** S2C `0xAC` 16-bit monster name/palette seed (`MonsterData+0x18`). */
  nameSeed: number
  /** S2C `0xAC` 16-component animation appearance indices (`HD..S8`). */
  compVariants?: readonly number[] | undefined
  name: string
  areaId: number
  x: number
  y: number
  hp: number
  /**
   * 1/256 hit points (`STAT_HITPOINTS` raw storage) after a fractional hit (`SrvDmg03` ground fire).
   * Authoritative only while `hp256Whole === hp`; any integer write to `hp` invalidates it.
   */
  hp256?: number | undefined
  hp256Whole?: number | undefined
  /** Frame of the last `finishMonsterDamage` (oracle-path regen skips that frame). */
  lastDamagedFrame113c?: number | undefined
  /** Next frame on which `MONSTER_Event3_HpRegen` (`0x6FC96740`) fires (`undefined` = no `Event 3` queued). */
  nextEvent3Frame113c?: number | undefined
  /** Monotonic insertion counter into the `EVENT_SetEvent(..., 3, frame)` FIFO bucket (`0x6FCAEA80`). */
  event3Seq113c?: number | undefined
  maxHp: number
  baseMaxHp: number
  /** Unmultiplied single-player normal-rank base max HP (`D2Game.dll` `0x6FC4673A`, #1821). */
  unscaledMaxHp: number
  level: number
  baseXp: number
  experience: number
  unscaledXp: boolean
  baseMinDmg: number
  baseMaxDmg: number
  minDmg: number
  maxDmg: number
  /** MonStats `A2MinD/A2MaxD` and `S1MinD/S1MaxD` (difficulty scaled). */
  baseAttack2MinDmg: number
  baseAttack2MaxDmg: number
  attack2MinDmg: number
  attack2MaxDmg: number
  baseSpecial1MinDmg: number
  baseSpecial1MaxDmg: number
  special1MinDmg: number
  special1MaxDmg: number
  hasAttack2: boolean
  hasSpecial1: boolean
  /** MonStats `El1..3` elemental melee riders (`players=1` base & `/players N` scaled). */
  baseElementalAttacks: readonly MonsterElementalAttack[]
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
  baseAr: number
  baseAttack2Ar: number
  baseSpecial1Ar: number
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
  /** 1.13c `AITHINK_Fn028_Vampire` (`0x6FCA6954` / `0x6FCA6EC3`, #2007): AI-think-tick lockout (`11` ticks) on `#170` / `#171` upgrade spells. */
  vampireUpgradeCooldownTicks: number
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
  /** 1.13c `MonUMod #17` (`lightning`) last bolt proc frame (`pMonsterData->dwLastLeFrame`, `0x6FC4634D`, #1995). */
  lastLightningBoltFrame?: number | undefined
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
  /** Originating unit kind (`player` / `merc` / `pet`) for LAEK/MAEK kill credit (#1938). */
  poisonKillSource?: 'player' | 'merc' | 'pet' | undefined
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
  /** `MonUMod` 30 `aura` or innate boss aura (#1819, #1820): the 1.13c aura skill this monster carries. */
  auraSkillId: number | undefined
  /** Effective 1.13c aura `slvl` (`max(1, floor(mlvl / divisor))` or innate boss `slvl`, #1819, #1820). */
  auraLevel: number | undefined
  /** Cached D2Common `findPathWorld` waypoints toward `pathTargetX/Y`. */
  path: readonly SubTilePoint[]
  pathIndex: number
  pathTargetX: number
  pathTargetY: number
  /** Earliest 25Hz server frame to re-run A* `findMonsterPath` on target drift or blocked path. */
  pathNextRecomputeFrame: number
  /** DRLG spawn anchor for return-to-nest behaviour. */
  homeX: number
  homeY: number
  fleeTicks: number
  /** Stable fear destination while terror/morale panic is active. */
  fleeTargetX: number
  fleeTargetY: number
  shattered: boolean
  /** Single-use corpse lock (`STATE_CORPSE_NOSELECT = 118`, #1809, #1810). */
  corpseConsumed?: boolean
  revivedByShaman: boolean
  /** `MonUMod #38` (`Possessed`, `0x6FC437E5` `0x20` flag): immune to all curses (#1903). */
  uncursable: boolean
  /** `MonUMod #41` (`always_run_ai`, `0x6FC469F0`): bypasses room/radius AOI culling (#1906). */
  alwaysRunAi: boolean
  /** `MonStats.txt` `killminions` / `SplEndDeath === 1`: triggers surrounding minion death on kill (#1906). */
  killMinions: boolean
  /** Prevents duplicate XP / item drops after `#293 Self-resurrect` or shaman resurrection (#1901). */
  alreadyGrantedKillRewards: boolean
  /** Scheduled frame for `#293 Self-resurrect` (`MonUMod #34` `ai_after_death`) check (`0` = none, #1901). */
  selfResurrectCheckFrame: number
  /** Count of completed `#293 Self-resurrect` revives (#1901). */
  selfResurrectCount: number
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
  /** `stat 100 = monster_playercount` recorded when the monster spawned (`D2Game!0x6FCCF840` / `0x6FCCFF3B`). */
  monsterPlayerCount: number
  /** `MonStats2.txt` `MeleeRng` (sub-tiles; `Tentacle` = 6). */
  meleeRange: number
  /** 1.13c `#176 Submerge` (`~0x0E` untargetable / invulnerable underwater state). */
  submerged: boolean
  /** `pAiControl->dwAiState` (`1` = submerged, `2` = surfaced) for `AiTentacle` / `AiTentacleHead` / `FrogDemon`. */
  submergeAiState: number
  /** `pAiControl->dwAiParam[0]` frame timer gating re-submerge or re-emerge. */
  submergeTimerFrame: number
  /** Frame when `#180 Emerge` (`MONMODE_SKILL1 = 8`) finishes and settles into `MONMODE_NEUTRAL (1)`. */
  emergeUntilFrame: number
  /** Linked `TentacleHead` / `BaalCrab` boss `unitId` for `Tentacle` limbs, `BaalClone`, `BaalTentacle`, and boss summons. */
  bossUnitId: number | undefined
  /** Summoned Uber Tristram minion (`0` XP, `0` drops, despawns when all 3 Uber Prime Evils die, #1841). */
  isUberSummonedMinion: boolean
  /** Next frame at which an Uber Prime Evil (`704, 705, 709`) may summon a reinforcement minion (#1841). */
  uberSummonNextFrame: number
  /** Frame at which a temporary summon (`baalclone`, `baaltentacle`, `boneprison`, `hydra`) auto-despawns (`0` = permanent). */
  despawnAtFrame: number
  /** Real `baalcrab` (#544): count of Vile Effigy (`#570 baalclone`) spawns & active clone `unitId` (`0` = none, #1826). */
  baalCloneSpawnCount: number
  activeBaalCloneUnitId: number
  /** Active multi-frame boss / monster channel (`DiabLight #193`, `Baal Inferno #317`, Talic `Whirlwind #151`, `SrvDo095` Monster Inferno, #1825..#1827, #2012). */
  activeBossChannel:
    | {
        readonly kind: 'diablight' | 'baalinferno' | 'whirlwind' | 'monsterinferno'
        readonly skillId: number
        readonly slvl: number
        remainingFrames: number
        elapsedFrames?: number | undefined
        angle: number
        targetX: number
        targetY: number
        readonly startOffset: number
        readonly stepVx?: number | undefined
        readonly stepVy?: number | undefined
        readonly missileId?: number | undefined
        readonly rangeFrames?: number | undefined
        readonly stepFrames?: number | undefined
        readonly physDamage?: number | undefined
        readonly elemDamage?: number | undefined
        readonly element?: MissileDamageChannel | undefined
        readonly elemDurationFrames?: number | undefined
        readonly hitMonsters?: boolean | undefined
        readonly nextHitFrames: Map<number, number>
      }
    | undefined
  /** Active Baal `#318 Baal Cold Missiles` (`Hoarfrost`) expanding V-wedge waves (#1826). */
  activeHoarfrostWaves:
    | {
        x: number
        y: number
        readonly vx: number
        readonly vy: number
        readonly perpX: number
        readonly perpY: number
        remainingSteps: number
        stepDone: number
        readonly slvl: number
        readonly hitUnits: Set<number>
      }[]
    | undefined
  /** Active `#349 Diablogeddon` (`Armageddon`) meteor rain expiry frame (`> currentFrame`) on `#333` / `#705` (#1825). */
  diablogeddonUntilFrame: number
  /** Original unbuffed `ac` before Madawc `#138 Shout` (`state 26`) so Shout refreshes idempotently (#1827). */
  baseAcBeforeShout: number
  /** Saved `mlvl/maxHp/hp` while `state 53` (`conversion`) + `state 109` (`conversion_save`) scale `clvl < mlvl` (#1879). */
  conversionSavedStats?: ConversionSavedStats113c | undefined
  /** Fear repulsion origin `(x, y)` when terrified by a `#150 Grim Ward` totem (#1881). */
  fleeOriginX: number
  fleeOriginY: number
  /** Active `#238 Rabies` carrier state for 4-frame proximity contagion (`#1886`). */
  rabiesInfection?:
    | {
        readonly expireFrame: number
        readonly rawBitrate256: number
        readonly attackerId: number
        readonly slvl: number
      }
    | undefined
  /** Bone Wall (`#78`) / Bone Prison (`#88`) construct owner player `unitId` (#1883). */
  boneConstructOwnerPlayerId?: number | undefined
  /** Innate `MonProp.txt` stats rolled at spawn (`#1897`). */
  monProps: ResolvedMonsterMonProps113c
  /** Equipped `MonEquip.txt` items & combat stats rolled at spawn (`#1898`). */
  monEquipLoadout: RolledMonsterLoadout113c | undefined
  /** Putrid Defiler `#300 Impregnate` (`MON_UMOD #40`): spawns Pain Worm on death (`#1894`). */
  wormsOnDeath: boolean
  /** Regurgitator `#214 RegurgitatorEat` consumed corpse charges for `#213 CorpseSpit` (`#1895`). */
  corpseAmmo: number
  /** Demon Imp `#330 Imp Teleport` carrier linkage (`#1894`). */
  mountedImpUnitId: number | undefined
  mountedOnUnitId: number | undefined
  /** `MaggotEgg` (`#159`) scheduled hatch frame (`0` = not an egg, `#1892`). */
  hatchAtFrame: number
  /** `MonStats.txt` `Align` (`0` = Evil, `1` = Good/Friendly, `2` = Neutral, `#2005`). */
  align: 0 | 1 | 2
  /** `#97 Spirit` (`0x6FC360B0`, `hcIdx 401 mephistospirit`) `dwAiFlags3` one-shot melee latch (`#2005`). */
  spiritAttackedOnce: boolean
  /** `#99 TrappedSoul` (`0x6FCC5580`, `hcIdx 403..404`) `dwAiState` (`0` = resting, `1` = awake fidget, `#2005`). */
  trappedSoulState: number
  /** DS1 `pMapAI` town NPC waypoint path (`AI_FollowDs1NpcPath` `0x6FC3BBC0`). */
  mapAi?: LocalAreaPresetMonster['mapAi']
  /** Whether 1.13c Town NPC AI (`AI_Npc` `0x6FC3DB40`) is active on this monster. */
  townNpcAiEnabled?: boolean | undefined
  /** 1.13c monster AI dormancy gate (`AI_ActivateMonstersNearPlayers` every 25 frames within dist 35). */
  aiAwake?: boolean | undefined
  /** 1.13c `MONMODE_RUN` (`15`) velocity bonus (`+100` in `AiZombie` `0x6FCA38B0`). */
  runVelocityBonus?: number | undefined
  /** 1.13c `MONMODE_DEATH` (`0`) -> `MONMODE_DEAD` (`12`) transition frame. */
  deathAnimEndFrame?: number | undefined
  /** 1.13c monster attack/action animation end frame (`mode 4/5/8 -> 1`). */
  actionAnimEndFrame?: number | undefined
  /** `item_slow` of the active state 24 `slowed` (Clay Golem `ITEMEVENTS_ApplySlow` 0x6FCCD2C0, capped). */
  slowedPct113c?: number | undefined
  /** `pAiGeneral` group leader unit id (`+0x2C`, set by the party spawner `0x6FD0E480` for `SetBoss` rows). */
  groupLeader113c?: number | undefined
  /** Leader only: minion unit ids, newest first (`pAiGeneral+0x34` list, `0x6FC40CF0`). */
  groupMinions113c?: number[] | undefined
  /** `pAiGeneral` command stack (`+0x20` head = last element), command type at node `+0x08` (`0x6FC40F30`). */
  aiCommands113c?: number[] | undefined
  /** `AiFallen` per-monster "afraid" flag (`pAiTick->[0]+0x14`, set by the death-flee branch). */
  fallenAfraid113c?: boolean | undefined
  /** DRLG event order: wheel-insertion stand-ins for the AI event, mode end and death end (frame-and-commands). */
  eventSeq113c?:
    | { ai: number; act: number; death: number; seenAi: number; seenAct: number; seenDeath: number }
    | undefined
}


export interface InternalMercenaryRecord {
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
  ar?: number | undefined
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
  /** Current mercenary experience points and `Hireling.txt` `Exp/Lvl` factor (`0x6FD7C990`). */
  experience: number
  expPerLvl: number
  /** Mercenary gear (helmet / armor / weapon) used for kill MF/GF aggregation. */
  equipment: ServerItemEntry[]
  /** 1/256 fixed-point HP regeneration carry (`MERCS_SetStats` `0x6FC68EE6..0x6FC68F0D`, #1671). */
  regenCarry256?: number | undefined
  mode?: number | undefined
  strength?: number | undefined
  dexterity?: number | undefined
  minDmg?: number | undefined
  maxDmg?: number | undefined
  maxHp256?: number | undefined
  hp256?: number | undefined
  hpRegen256?: number | undefined
  oracleMercAi113c?: import('./hireable-ai-113c.ts').OracleHireableAiState113c | undefined
  states: Set<number>
  stateTimers: Map<number, number>
}


export interface InternalObjectRecord {
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
  /** Container trap type (`0` = none, `1..9` = `gpTrapFnTable` `0x6FD27B8C`, #1918). */
  trapType: number
  /** Frame at which a used shrine returns to mode 0 (Shrines.txt ResetTime). */
  shrineResetFrame: number
  /** Remaining water well charges (`pObjectData->bInteractType`, `InitFn 16` @ `0x6fc4e760`: `Parm2 << 1 = 2`). */
  wellCharges: number
  /** Scheduled `Object Event 2` (`0x6fc89ca0`) frame numbers (`currentFrame + Parm0 + 1`). */
  wellRegenFrames: number[]
  /** Compelling Orb hit counter (1.13c requires two Khalim's Will hits). */
  useCount: number
  /** Invisible MonStats 366 compellingorb monster paired with Objects.txt 404 (InitFn 60 @ 0x6fd084a0). */
  linkedMonsterId?: number | undefined
  /** Paired permanent red portal (`classId = 60`) `unitId` in the destination area (`D2Game.dll` `0x6FCC24C0`, #1841). */
  linkedPortalId?: number | undefined
}


/** A level warp (`UNIT_TILE = 5`, S2C 0x09 AssignWarp) of a bootstrapped area. */
export interface InternalWarpTileRecord {
  readonly unitId: number
  /** LvlWarp.txt `Id` (the tile unit's class). */
  readonly lvlWarpId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly destAreaId: number
}


export interface LoadedAreaRecord {
  readonly areaId: number
  readonly spawnX: number
  readonly spawnY: number
  readonly rooms: readonly LocalAreaRoomReveal[]
  readonly roomRects: LocalAreaBootstrap['roomRects']
  readonly adjacentAreaIds: readonly number[]
  readonly isWalkable: LocalAreaBootstrap['isWalkable']
  readonly findActSpawnLocation?: LocalAreaBootstrap['findActSpawnLocation']
  readonly originX?: number | undefined
  readonly originY?: number | undefined
  readonly subWidth?: number | undefined
  readonly subHeight?: number | undefined
  readonly collision?: Uint16Array | undefined
  /** DS1 `Objects.txt` `InitFn` NPC/boss spawner anchor coordinates recorded during `loadArea` (#2000). */
  readonly initFnAnchors?: ReadonlyArray<{
    readonly classId: number
    readonly x: number
    readonly y: number
  }>
}


/** How a player enters an area (decides the landing spot, D2Game `LEVEL_WarpUnit` callers). */
export type AreaArrival =
  | { readonly kind: 'waypoint' }
  | { readonly kind: 'townPortal'; readonly x?: number | undefined; readonly y?: number | undefined }
  | { readonly kind: 'warp'; readonly fromAreaId: number }
  | {
      readonly kind: 'levelSpawn'
      readonly tileIndex: number
      readonly fallbackFromAreaId?: number | undefined
    }
  | { readonly kind: 'respawn' }


export type MissileDamageChannel = 'phys' | 'fire' | 'ltng' | 'cold' | 'pois' | 'mag'


export interface InternalMissileRecord {
  unitId: number
  missileId: number
  skillId: number
  ownerType: 'player' | 'monster'
  ownerId: number
  /**
   * Set for chest-trap missiles whose owner is an object (`ownerType: 'monster'` combat side). Object and
   * monster ids come from different per-type counters (`D2Game 0x6FCFF9C0`) and may be equal.
   */
  ownerIsObject?: boolean | undefined
  areaId: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  remainingFrames: number
  /** Elapsed movement ticks since creation (`MISSMODE_MoveMissile` `0x6FC5F413` `Activate` gate, #1997). */
  ticksElapsed?: number | undefined
  /** Frame on which this missile was spawned (`D2Game.dll` skips stepping newly spawned missiles until next frame). */
  createdFrame?: number | undefined
  /** `Missiles.txt` `CollideType` (0 = ignore terrain, 8 = floor-hugging, 1/3/6 = flying). */
  collideType: number
  /** `Missiles.txt` `Size` — collision radius contribution. */
  size: number
  /** `Missiles.txt` `Pierce` — keep flying after a hit. */
  pierce: boolean
  /**
   * 1.13c creation-time `pierce_idx` (`0x6FC8F660`): remaining extra unit hits for `CollideKill = 1`
   * player missiles (`item_pierce + skill_pierce`, at most 4), consumed per hit (`0x6FC58F40`, #1802).
   */
  pierceRemaining?: number | undefined
  /** 1.13c `Missiles.txt` `SrcDamage` / `Skills.txt` `SrcDam` (`128 = 100%` weapon damage, #1873). */
  srcDamage?: number | undefined
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
  /** #1790: `pSrvDoFunc` / `pSrvHitFunc` state routed through `MissileEngine` (online bridge). */
  online?: OnlineMissileState113c | undefined
  /**
   * #1790 damage carrier: `'none'` = functional missile without its own damage (Fire Wall makers,
   * Blizzard / Meteor centres, zero-damage carriers), `'groundfire'` = per-frame burning patch.
   */
  carrier?: 'none' | 'groundfire' | undefined
  /** Per-frame 1/256 fire damage of a `'groundfire'` patch (or the range its children inherit). */
  groundFire256?: { readonly min: number; readonly max: number } | undefined
  /** Fractional 1/256 burning damage carried per struck unit. */
  groundFireCarry?: Map<number, number> | undefined
  /** Exact 1/256 fixed-point elemental/magic damage payload (e.g. `#112 Blessed Hammer` Concentration snapshot, #1878). */
  elemDamage256?: number | undefined
  /**
   * Elemental min/max unit stats (1/256) the missile carries from its skill (`minfire`/`maxfire` 48/49,
   * `lightmindam`/`lightmaxdam` 50/51, `magicmindam`/`magicmaxdam` 52/53), rolled at impact by
   * `0x6FC59B40` (see `kb/skills/missiles/d2game-srvhit01-fireball-113c.md`).
   */
  srvHitElem256?: { readonly min: number; readonly max: number } | undefined
  /** `D2Common.#10024` LastCollide unit (`'<kind>:<id>'`), checked by `#10227` in `MISSMODE_SrvHitDispatch`. */
  lastCollideKey113c?: string | undefined
  /** Path stepped onto a new sub-tile in this frame's move / in the previous frame's move (`D2Common_10234`). */
  pathStepNow113c?: boolean | undefined
  pathStepPrev113c?: boolean | undefined
  /** 1.13c `D2Common` 16.16 linear path state including 5-step `Accel` (`PATH_StepVelocity` `0x6FD5CEB0`). */
  linearPath113c?: LinearMissilePathState113c | undefined
  /** True when `#112 Blessed Hammer` already snapshotted caster's Concentration `floor(concEd / 2)` at cast time (#1878). */
  concentrationSnapshotted?: boolean | undefined
  /** True for `#266 Blade Fury` / `#257 Blade Sentinel` weapon-carrying blade missiles (#1884). */
  bladeWeaponHit?: boolean | undefined
  /** Back-and-forth shuttle state for `#257 Blade Sentinel` (`#392 blade creeper`, #1884). */
  patrolState?: BladeSentinelPatrolState113c | undefined
  /** Linked `SummonManager` `'assassintrap'` pet `uid` for `#257 Blade Sentinel` 5-trap cap (#1884). */
  trapOwnerPlayerId?: number | undefined
  trapPetUid?: string | undefined
  /** Oracle 1.13c mercenary-launched projectile state (`D2Common #10413` `0x6FDBBE60` + `SrvDmg01` `0x6FC5A850`). */
  mercOwnerUnitId?: number | undefined
  mercSlvl113c?: number | undefined
  mercSrvDmgFunc113c?: number | undefined
  mercPhysMin256?: number | undefined
  mercPhysMax256?: number | undefined
  mercPhysEdPct?: number | undefined
  mercDeadlyStrike?: boolean | undefined
  mercElemType?: 'fire' | 'cold' | 'mag' | undefined
  mercElemMin256?: number | undefined
  mercElemMax256?: number | undefined
  mercColdLenFrames?: number | undefined
}


export interface QueuedPlayerCommand {
  readonly playerUnitId: number
  readonly command: ClientCommand
}


/** #1790 optional launch parameters of `launchPlayerSkillMissile`. */
export interface PlayerSkillMissileLaunchOptions113c {
  /** Path origin when it is not the caster (Fire Wall makers start at the target point). */
  readonly fromX?: number | undefined
  readonly fromY?: number | undefined
  /** Unit-locked homing target (`SKILLS_SrvDo010` `TargetX = 1`). */
  readonly lockedMonsterId?: number | undefined
  readonly lockedTargetKey?: string | undefined
  /** Per-frame 1/256 ground fire damage (Fire Wall pillars and makers). */
  readonly groundFire256?: { readonly min: number; readonly max: number } | undefined
  /** Assassin Blade skill (`#266` / `#257`) weapon-carrier physical missile (#1884). */
  readonly bladeWeaponHit?: boolean | undefined
  /** Additive missile velocity delta (`sub_6FCC2800` flag `0x04` -> `#130 Howl` `calc1`). */
  readonly velDelta?: number | undefined
  /** Unconditional pass-through pierce (`sub_6FCC2800` sets `Pierce = 1` without 4-pierce cap). */
  readonly forcePierce?: boolean | undefined
}


/** A player skill cast resolved through `skills/registry.ts` (#1328). */
export interface PlayerSkillCast {
  readonly skill: SkillRecord
  readonly slvl: number
  readonly evalResult: SkillEvalResult
  /** Server `Missiles.txt` row launched by the cast; `undefined` for missile-less skills. */
  readonly missile: MissileRecord | undefined
  /** Optional off-hand `Missiles.txt` row for dual-throw skills (`Double Throw` #140). */
  readonly offHandMissile?: MissileRecord | undefined
  /** Equipped item whose `item_charged_skill` (204) charge pays for this cast (no mana cost). */
  readonly chargeItem?: ServerItemEntry | undefined
  /** Caster stat list / hard points used to evaluate the cast's `Skills.txt` `calc1..calc4` cells. */
  readonly statList: UnitStatList
  readonly blvl: number
  /** `Skills.txt` `nocostinstate = 1`: true when the caster is already in `skill.auraState` (waives mana cost). */
  readonly isNoCostInState?: boolean | undefined
}


/** Persistent combat unit: stat list + state bus kept across frames (see `playerCombat`). */
export interface PersistentCombatUnit {
  readonly statList: UnitStatList
  readonly stateBus: StateBus
  readonly itemStatList?: UnitStatList | undefined
}


/** The selected aura of a player: its `AuraScanner` and evaluated pulse radius in sub-tiles. */
export interface PlayerAuraRuntime {
  readonly scanner: AuraScanner
  readonly skillId: number
  readonly radiusSubtiles: number
  readonly source: ActiveAuraSource | undefined
  readonly targetStateId: number | undefined
}


export interface MercAuraSourceEntry {
  readonly skillId: number
  readonly slvl: number
  readonly isItemAura: boolean
  readonly radiusSubtiles: number
  readonly casterStateId: number | undefined
  readonly targetStateId: number | undefined
  readonly source: ActiveAuraSource
}


export interface MercAuraRuntime {
  readonly scanner: AuraScanner
  readonly signature: string
  readonly sources: readonly MercAuraSourceEntry[]
  needsInitialPulse: boolean
}


export interface ArmorCombatMeta113c {
  readonly minAc: number
  readonly maxAc: number
  readonly block: number
  readonly smiteMinDam: number
  readonly smiteMaxDam: number
}

export interface FriendlyAuraAlliesResult113c {
  readonly allyPlayers: { readonly record: InternalPlayerRecord; readonly ctx: CombatUnitContext }[]
  readonly allyMercs: { readonly record: InternalMercenaryRecord; readonly ctx: CombatUnitContext }[]
  readonly allyPets: {
    readonly pet: SummonedPetUnit
    readonly unitId: number
    readonly ctx: CombatUnitContext
    readonly states: Set<number>
    readonly timers: Map<number, number>
  }[]
  readonly allAllies: CombatUnitContext[]
}

/** DRLG presets of one room not yet activated (`activatePresetRoomsNearPlayer113c`). */
export interface PendingRoomPresets113c {
  /** Preset object unit ids (or hidden server-only marker unit ids) whose unit seed is drawn on activation, in preset order. */
  readonly objectIds: number[]
  /** Preset monsters spawned on activation, in preset order. */
  readonly monsters: LocalAreaPresetMonster[]
  /** Warp tile unit ids (already spawned) whose unit seed is drawn on activation. */
  readonly tileIds: number[]
}


