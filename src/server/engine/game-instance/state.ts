/**
 * GameInstance Core State Container (`src/server/engine/game-instance/state.ts`).
 */

import { getSharedDataRegistry, type D2DataRegistry } from '../../../common/data/data-registry.ts'
import { getAct2StaffTombLevelId } from '../../../common/drlg/drlg-drlg.ts'
import type { Item } from '../../../common/items/items.ts'
import { D2Rng, newD2Seed, type D2SeedStrc } from '../../../common/rng/d2-rng.ts'
import {
  createActMonsterOutfitPalettes113c,
  initGameSeed113c,
  type ActMonsterOutfitPalette113c,
} from './unit-seeds-113c.ts'
import { PartyManager } from '../../net/party.ts'
import type { LocalAreaBootstrapResolver, ServerEvent } from '../../../netproto/index.ts'
import type { PopulationRoomRect } from '../../ai/room-streamer.ts'
import type { SummonManager, SummonedPetUnit } from '../../ai/summon-manager.ts'
import type { SUnitDmgPacket, CombatUnitContext } from '../combat-pipeline.ts'
import type { MissileEngine as OnlineMissileEngine, OnlineMissileSpawn113c } from '../missile-engine.ts'
import type { AnimDispatcher } from '../anim-dispatcher.ts'
import type { FrenzyStack113c, MartialChargeState113c } from '../../skills/martial-dualwield-113c.ts'
import type { WhirlwindSpinState113c } from '../../skills/whirlwind-113c.ts'
import { TradeManager113c } from '../../net/trade-manager-113c.ts'
import { AreaPathWorld113c } from '../../ai/town-npc-ai-113c.ts'
import { DrlgRoomPopulator113c } from '../../world/room-populate-113c.ts'
import type { AreaPopulationState, GameInstanceConfig, GameMode, GameModePolicy, InternalMercenaryRecord, InternalMissileRecord, InternalMonsterRecord, InternalObjectRecord, InternalPlayerRecord, InternalWarpTileRecord, LoadedAreaRecord, MercAuraRuntime, PendingRoomPresets113c, PersistentCombatUnit, PlayerAuraRuntime, PlayerMotionState, PlayerSkillCast, QueuedPlayerCommand, ServerItemEntry } from './types.ts'
import { CLOSED_REALM_POLICY, OPEN_BNET_POLICY, SINGLE_PLAYER_POLICY, areaToAct, getOrCreateEmbeddedFallbackRegistry, resolveGameModePolicy } from './constants-and-helpers.ts'

export class GameInstanceState {

  readonly mode: GameMode

  readonly policy: GameModePolicy

  readonly difficulty: 0 | 1 | 2

  readonly gameName: string

  readonly registry: D2DataRegistry

  readonly partyManager: PartyManager

  readonly tradeManager = new TradeManager113c()

  /** @internal 1.13c D2Common DynamicPath collision world + Town NPC AI (`0x6FC3DB40`). */
  readonly areaPathWorld = new AreaPathWorld113c()

  /** @internal */
  readonly configLadder: boolean | undefined

  /** @internal */

  currentFrame = 0

  /** @internal */
  currentMapSeed: number

  /** @internal */
  readonly hasExplicitMapSeed: boolean

  readonly defaultAreaId: number | undefined

  /** @internal */
  readonly defaultAct: 0 | 1 | 2 | 3 | 4 | undefined

  /** @internal */
  rng: D2Rng

  /** @internal */
  pausedState = false

  /** @internal */
  manualPlayersX: number

  /**
   * @internal Next unit id per 1.13c unit type (player, monster, object, missile, item, tile).
   * `D2Game.dll` keeps six counters `pGame->dwLastUnitId[type]` (`+0x90..+0xA4`, zeroed at game creation
   * `0x6FC4C703..0x6FC4C721`); `SUNIT_GetNewUnitId` (`0x6FCFF9C0`) pre-increments and skips `-1`, so the
   * first id of every type is 1 and ids repeat across types.
   */
  readonly nextUnitIdByType: number[] = [1, 1, 1, 1, 1, 1]

  /**
   * @internal 1.13c game seed `pGame->tSeed` (`D2GameStrc+0xD0`): every unit's own seed is drawn from it
   * when the unit is allocated (`SUNIT_AllocUnitData` `0x6FD01D90` -> `0x6FD00110`). See `unit-seeds-113c.ts`.
   */
  readonly gameSeed: D2SeedStrc = newD2Seed()

  /** @internal Per-unit `D2SeedStrc` (`D2UnitStrc+0x20/+0x24`), keyed `${unitType}:${unitId}`. */
  readonly unitSeeds = new Map<string, D2SeedStrc>()

  /** @internal Per-Act 13-slot monster outfit palette (`pGame->pMonReg[nAct]`, `0x6FCEA5F0`). */
  actMonsterOutfitPalettes: ActMonsterOutfitPalette113c[] = createActMonsterOutfitPalettes113c()

  /** @internal 1.13c per-room DRLG populator & distant-room hibernator (`0x6FD01430` / `0x6FC4CB60`). */
  readonly drlgRoomPopulator: DrlgRoomPopulator113c | null

  /**
   * @internal DRLG preset monsters of loaded areas not yet spawned, by room index; a room's presets are
   * spawned once when it is activated near a player (D2Game `0x6FC4CBE0` -> `0x6FD01430`).
   */
  readonly pendingPresetMonsters = new Map<
    number,
    { readonly byRoom: Map<number, PendingRoomPresets113c>; readonly activated: Set<number> }
  >()

  /** @internal */

  readonly players = new Map<number, InternalPlayerRecord>()

  /** @internal */
  readonly monsters = new Map<number, InternalMonsterRecord>()

  /** @internal */
  readonly mercenaries = new Map<number, InternalMercenaryRecord>()

  /** @internal */
  readonly summonManagers = new Map<number, SummonManager>()

  /** @internal */
  readonly petUnitIds = new Map<string, number>()

  /** @internal */
  readonly objects = new Map<number, InternalObjectRecord>()

  /** @internal Area-indexed `Objects.txt` `isDoor === 1` footprints for O(1) door collision checks. */
  readonly doorFootprintsByArea = new Map<
    number,
    {
      readonly obj: InternalObjectRecord
      readonly minX: number
      readonly maxX: number
      readonly minY: number
      readonly maxY: number
    }[]
  >()

  /** @internal Tracked `objects.size` + object `nextUnitIdByType` watermark for `doorFootprintsByArea` cache coherence. */
  doorFootprintsWatermark = -1

  /** @internal Indexed BoneWall / Diablo BonePrison (`hcIdx 340..344`) records for O(1) collision checks. */
  readonly bonePrisonMonsters: InternalMonsterRecord[] = []

  /** @internal Tracked `monsters.size` + monster `nextUnitIdByType` watermark for `bonePrisonMonsters` cache coherence. */
  bonePrisonsWatermark = -1

  /** Deferred quest object spawns (e.g. Duriel's Lair portal after the staff). */
  /** SuperUnique seal bosses killed per area. */
  /** @internal */
  readonly sealBossDeaths = new Map<number, Set<string>>()

  /** Areas where Diablo has already been spawned after the seals. */
  /** @internal */
  readonly diabloSpawnedAreas = new Set<number>()

  /** Ancient Barbarian deaths per area. */
  /** @internal */
  readonly ancientDeaths = new Map<number, Set<string>>()

  /** Areas where the five Cairn Stones already opened the Tristram portal. */
  /** @internal */
  readonly cairnPortalAreas = new Set<number>()

  /** Deterministic per-game 5-stone sequence (`17..21`, `D2Game.dll` `a1q3.cpp` `0x6FC84290`, #1926). */
  /** @internal */
  readonly cairnStoneOrder: readonly number[]

  /** Current number of Cairn Stones activated in exact sequence per area (`0..5`, #1926). */
  /** @internal */
  readonly cairnStoneStepByArea = new Map<number, number>()

  /** Scheduled 125-frame Chaos Sanctuary Diablo (`#243`) spawns (`D2Game.dll` `0x6FCDC271..0x6FCDC337`, #1928). */
  /** @internal */
  readonly pendingDiabloSpawns: {
    frame: number
    areaId: number
    x: number
    y: number
  }[] = []

  /**
   * 1.13c A3Q5 (`D2Game.dll` `0x6FD073C0` / `0x6FD07DB0`, #1984): killed Council Member `unitId`s
   * per area (`Area 83` Travincal in DRLG games, or synthetic non-DRLG test areas).
   */
  /** @internal */
  readonly councilDeaths = new Map<number, Set<number>>()

  /**
   * 1.13c A3Q5 (`D2Game.dll` `0x6FD07E2F..0x6FD07EF3`, #1984): per-area single-drop gates for
   * Khalim's Flail (`'qf1'`, `[esi+0xd]`) and Travincal backup Horadric Cube (`'box'`, `[esi+0xe]`).
   */
  /** @internal */
  readonly councilDropGates = new Map<number, { flailDropped: boolean; cubeDropped: boolean }>()

  /** 1.13c A3Q1 per-game Jade Figurine (j34) drop gate (`D2Game.dll` @ `0x6fd08010..0x6fd080c6`). */
  /** @internal */
  a3q1JadeFigurineDropped = false

  /** 1.13c A5Q2 (`D2Game.dll` `0x6FC7A41B..0x6FC7A4FF`, #2021): slain `act5pow` (`hcIdx 534`) count in Frigid Highlands (`Area 111`). */
  /** @internal */
  arreatDeadPowCount = 0

  /** 1.13c A5Q2 (`ACT5Q2_ObjInit` @ `0x6FC7C850 -> 0x6FC7C2A0`, #2021): `Objects.txt 473` pens whose 5 `act5pow` soldiers were spawned. */
  /** @internal */
  readonly arreatSpawnedPenObjectIds = new Set<number>()

  /** 1.13c A4Q2 Hellforge (`pQuestDataEx->wForgeMode` @ `0x6fcdae11`: 0 = idle, 2 = soulstone placed, 3 = smashed). */
  /** @internal */
  hellforgeState: 0 | 2 | 3 = 0

  /** 1.13c A4Q2 Hellforge hammer hit counter (`pQuestDataEx->nHammerHits` @ `[edi+0x0c]`, `0x6fcdb9da`). */
  /** @internal */
  hellforgeHits = 0

  /** 1.13c World Event (`#333 diabloclone`): Stone of Jordan sale counter, trigger state, and single-spawn gate (#1842). */
  /** @internal */
  readonly worldEventSojThreshold: number

  /** @internal */
  sojSoldCount = 0

  /** @internal */
  worldEventTriggered = false

  /** @internal */
  diabloCloneSpawned = false

  /** @internal */
  readonly everRevealedRoomKeys = new Set<string>()

  /** @internal */
  readonly spawnedSuperUniquePackIds = new Map<
    number,
    {
      readonly superUniqueIndex: number
      readonly areaId: number
      readonly x: number
      readonly y: number
      readonly allUnitIds: readonly number[]
    }
  >()

  /** @internal */
  readonly pendingObjectSpawns: {
    frame: number
    classId: number
    x: number
    y: number
    areaId: number
    destAreaId?: number | undefined
  }[] = []

  /** @internal */
  readonly pendingObjectModeTransitions: {
    frame: number
    unitId: number
    mode: number
  }[] = []

  /** #1962: Staggered 20-frame Hellforge (`A4Q2`, `Event 7`) gem & rune drop beats (`+20, +40, +60, +80`). */
  /** @internal */
  readonly pendingHellforgeDrops: {
    frame: number
    areaId: number
    x: number
    y: number
    items: readonly Item[]
  }[] = []

  /** #1963: Victory catapult bombardment timers triggered around Shenk (`hcIdx = 479`) on `A5Q1` death. */
  /** @internal */
  readonly activeShenkBombardments: {
    areaId: number
    centerX: number
    centerY: number
    nextStrikeFrame: number
    endFrame: number
    ownerUnitId: number
  }[] = []

  /** #1988: Act 1 Quest 4 (`a1q4`) Countess `towerchestspawner` (`Missiles.txt #332`, `0x6FC608D0`) timers. */
  /** @internal */
  readonly activeTowerChestSpawners: {
    areaId: number
    chestUnitId: number
    remainingFrames: number
    armed: boolean
    killerUnitId: number
  }[] = []

  /** @internal */
  readonly groundItems = new Map<number, ServerItemEntry>()

  /** Gamble-window mystery items by vendor entry unit id, resolved by `resolveGambledItem` on purchase. */
  /** @internal */
  readonly gambleSourceItems = new Map<number, Item>()

  /** `${MonStats Id}:${difficulty}` of Act bosses already killed in this game (quest TC only on the first kill). */
  /** @internal */
  readonly killedActBosses = new Set<string>()

  /** Pandemonium Event (`133..136`) portal destination areas already opened in this game (`D2Game.dll` `0x6FC9D160`, #1841). */
  /** @internal */
  readonly openedPandemoniumAreas = new Set<number>()

  /** Distinct Uber Prime Evil `hcIdx`s (`704, 705, 709`) killed in Area `136` during this game (#1841). */
  /** @internal */
  readonly uberTristramKilledBosses = new Set<number>()

  /** Ensures `Hellfire Torch` + `Standard of Heroes` finale reward drops at most once per game (#1841). */
  /** @internal */
  uberTristramRewardDropped = false

  /**
   * 1.13c per-game unique spawn bitmap (`pGame + 0x1b24`, 4096 bits, `D2Game.dll` `0x6FC2E250` /
   * `0x6FC2EDC0` / `0x6FC2F370`): tracks `UniqueItems.txt` row IDs (`id`) already spawned in this
   * game so each non-quest, non-`nolimit` unique can spawn at most once per game.
   */
  /** @internal */
  readonly spawnedUniqueIds = new Set<number>()

  /** @internal */
  readonly missiles = new Map<number, InternalMissileRecord>()

  /** #1790: `MissileEngine` that owns every room missile's srvdo / srvhit dispatch (lazy, uses `registry`). */
  /** @internal */
  onlineMissileEngineInstance: OnlineMissileEngine | undefined

  /** #1790: children queued by srvdo / srvhit functions during `stepMissiles`, created after the sweep. */
  /** @internal */
  readonly pendingOnlineMissileChildren: { parent: InternalMissileRecord; spawn: OnlineMissileSpawn113c }[] = []

  /**
   * `#1877` Global `STATE_SKILLDELAY` (`state 121`, `D2Game.dll` `SKILLS_ApplySkillDelay` @ `0x6FCBFF70`):
   * per-player expiration frame of the shared casting-delay state blocking all `delay > 0` skills.
   */
  /** @internal */
  readonly playerSkillDelayUntilFrame = new Map<number, number>()

  /** `#1789`: Whether 25Hz `AnimDispatcher` windup / keyframe release / follow-through lock is active. */
  /** @internal */
  animActionWindupEnabled = false

  /** `#1789`/`#1862`: Per-player `AnimDispatcher` bound to `playerCombat` `UnitStatList` + `StateBus`. */
  /** @internal */
  readonly playerAnimDispatchers = new Map<number, AnimDispatcher>()

  /** `#1789`/`#1862`: Pending windup / multi-hit strike callbacks keyed by `player.unitId`. */
  /** @internal */
  readonly pendingPlayerAnimActions = new Map<
    number,
    {
      readonly cast: PlayerSkillCast
      readonly manaCommittedOnStart: boolean
      readonly onStrike: (strikeIndex: number, totalStrikes: number) => void
      readonly onCleanup?: (() => void) | undefined
    }
  >()

  /** Per-player active channeling skill id (`STATE_INFERNO = 12` for `Inferno` #41, `Arctic Blast` #230, `Blade Fury` #266). */
  /** @internal */
  readonly playerChannelSkillId = new Map<number, number>()

  /** Active `#150 Grim Ward` corpse totems pulsing `state 56` (`terror`) every 25f for 1000f (#1881). */
  /** @internal */
  readonly activeGrimWards = new Map<
    number,
    {
      readonly objectUnitId: number
      readonly ownerPlayerId: number
      readonly areaId: number
      readonly x: number
      readonly y: number
      readonly slvl: number
      readonly radiusSubtiles: number
      readonly fleeDurationFrames: number
      readonly expireFrame: number
      nextPulseFrame: number
    }
  >()

  /** Active `#277 Blade Shield` periodic melee-pulse state per player (`perdelay = 25`f, `radius = 6`, #1884). */
  /** @internal */
  readonly activeBladeShields = new Map<
    number,
    {
      slvl: number
      expireFrame: number
      nextPulseFrame: number
    }
  >()

  /** Active `#266 Blade Fury` 5-frame channeling cadence tracker per player (#1884). */
  /** @internal */
  readonly activeBladeFuryChannels = new Map<
    number,
    {
      tx: number
      ty: number
      nextAutoShotFrame: number
      lastShotFrame: number
      hold?: boolean | undefined
    }
  >()

  /** Active continuous 1.13c Whirlwind (`#151`) spin states per player (`SrvSt38` / `SrvDo076`). */
  /** @internal */
  readonly playerWhirlwindStates = new Map<number, WhirlwindSpinState113c>()

  /** Active 1.13c Open Wounds (`STATE_OPENWOUNDS = 62`, 200f) monster bleed states. */
  /** @internal */
  readonly monsterOpenWounds = new Map<
    number,
    { bitrate256: number; remainingFrames: number; carry256: number; attackerId: number }
  >()

  /** Cached 1.13c `MonStats.txt` / `MonStats2.txt` corpse & conversion flags by monster key. */
  /** @internal */
  readonly monTableFlagsCache = new Map<
    string,
    {
      readonly corpseSel: boolean
      readonly soft: boolean
      readonly isAtt: boolean
      readonly align: number
      readonly monStatsBoss: boolean
      readonly primeevil: boolean
      readonly killable: boolean
    }
  >()

  /** #1813 Frenzy (`SrvDo009`) hit counter per player: stacks + expiry frame of `frenzy` (state 94). */
  /** @internal */
  readonly playerFrenzyStack113c = new Map<number, FrenzyStack113c>()

  /** #1815/#1816 Assassin progressive charges (states 122..127) per player. */
  /** @internal */
  readonly playerMartialCharges113c = new Map<number, MartialChargeState113c>()

  /**
   * #1417: `Skills.txt` `srvdofunc` ids of missile skills whose `D2Game.dll` volley logic has no
   * GameInstance implementation yet (see `classifyPlayerSrvDoMissile113c`); reported once each.
   */
  /** @internal */
  readonly unmodeledPlayerSrvDoFuncs = new Set<number>()

  /**
   * #1327: per-level room population state. `plan === null` marks a level that
   * populates nothing (town, `MonDen` 0, no DRLG rooms) so it is not re-resolved.
   */
  /** @internal */
  readonly areaPopulations = new Map<number, AreaPopulationState>()

  /** @internal */
  areaRoomProvider:
    | ((areaId: number) => readonly PopulationRoomRect[] | null | undefined)
    | undefined

  /** Active aura (`Skills.txt` `aura = 1` `aurastate` row id) per player unit id. */
  /** @internal */
  readonly playerActiveAuraState = new Map<number, number>()

  /**
   * Persistent 1.13c combat contexts (`UnitStatList` + `StateBus`) carrying skill buff / curse / aura
   * states with their `aurastat` modifiers, so they feed `executeSUnitDmg` and the weapon damage roll.
   */
  /** @internal */
  readonly playerCombat = new Map<number, PersistentCombatUnit>()

  /** @internal */
  readonly monsterCombat = new Map<number, PersistentCombatUnit>()

  /** @internal */
  readonly mercCombat = new Map<number, PersistentCombatUnit>()

  /** Persistent 1.13c `Bone Armor` (#68, state 14) remaining / max absorb pool in HP points (#1793). */
  /** @internal */
  readonly playerBoneArmorPool = new Map<number, { current: number; max: number }>()

  /** Persistent 1.13c `Cyclone Armor` (#235, state 151) remaining / max absorb pool in HP points (#1793). */
  /** @internal */
  readonly playerCycloneArmorPool = new Map<number, { current: number; max: number }>()

  /** Re-entrancy depth of item chance-to-cast procs (a proc never re-triggers `195`/`198`/`200`, #1797). */
  /** @internal */
  playerCtcProcDepth = 0

  /** Unit-global `STATE_JUSTHIT` (state 86) expiration frame keyed by `${unitType}:${unitId}` (#1792). */
  /** @internal */
  readonly unitJustHitUntilFrame = new Map<string, number>()

  /** Per-player `AuraScanner` running the selected aura's periodic pulse (`perdelay`). */
  /** @internal */
  readonly playerAuraScanners = new Map<number, PlayerAuraRuntime>()

  /** Per-player `AuraScanner` running equipped `STAT_ITEM_AURA` (`statId === 151`) item aura pulses. */
  /** @internal */
  readonly playerItemAuraScanners = new Map<number, MercAuraRuntime>()

  /** Per-mercenary `AuraScanner` running the hireling's innate + item-granted (`STAT_ITEM_AURA`) aura pulses. */
  /** @internal */
  readonly mercAuraScanners = new Map<number, MercAuraRuntime>()

  /** Per-summon-pet `AuraScanner` running Druid Spirit Totem (`#296..#298`) aura pulses. */
  /** @internal */
  readonly petAuraScanners = new Map<string, MercAuraRuntime>()

  /** Visual state sets & timers mirrored onto summoned pets (`unitType = 'monster'`). */
  /** @internal */
  readonly petVisualStates = new Map<
    number,
    { readonly states: Set<number>; readonly timers: Map<number, number>; areaId: number; readonly pet: SummonedPetUnit }
  >()

  /** @internal */
  readonly commandQueue: QueuedPlayerCommand[] = []

  /** @internal */
  readonly outbox = new Map<number, ServerEvent[]>()

  /** @internal */
  readonly playerMotion = new Map<number, PlayerMotionState>()

  /** @internal */
  terrainWalkableCheck:
    | ((areaId: number, x: number, y: number, isFlying?: boolean) => boolean)
    | undefined

  /** @internal */
  areaBootstrapResolver: LocalAreaBootstrapResolver | undefined

  /** @internal */
  onPlayersXChange: ((playersX: number) => void) | undefined

  /** @internal */
  readonly loadedAreas = new Map<number, LoadedAreaRecord>()

  /** @internal */
  readonly warpTiles = new Map<number, InternalWarpTileRecord>()

  /** @internal */
  inStepPlayerAnimations113c = false

  /** @internal */
  inStepPlayerMovement = false

  /** @internal */

  readonly mercMissiles = new Map<
    number,
    {
      unitId: number
      missileClassId: number
      mercUnitId: number
      ownerPlayerId: number
      areaId: number
      x: number
      y: number
      vx: number
      vy: number
      remainingFrames: number
      pierce: boolean
      pierceRemaining?: number | undefined
      guaranteedHit: boolean
      skillId: number
      slvl: number
      element: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag'
      physDamage: number
      elemDamage: number
      elemDurationFrames: number
      splashRadiusSubtiles: number
      isWeaponAttack: boolean
      hitUnitIds: Set<number>
    }
  >()

  /** @internal */

  readonly petMissiles = new Map<
    number,
    {
      unitId: number
      missileClassId: number
      petUnitId: number
      ownerPlayerId: number
      mslOwnerCtx: CombatUnitContext
      areaId: number
      x: number
      y: number
      vx: number
      vy: number
      remainingFrames: number
      pierce: boolean
      nextDelayFrames: number
      sourceSkillId: number
      slvl: number
      dmgPacket: SUnitDmgPacket
      hitUnitIds: Set<number>
    }
  >()

  /** @internal */

  readonly petMissileNextDelayUntil = new Map<string, number>()


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
    this.configLadder = config.ladder ?? config.isLadder
    this.gameName = config.gameName ?? 'LocalGame'
    this.worldEventSojThreshold = Math.max(
      1,
      Math.floor(config.worldEventSojThreshold ?? 1),
    )
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
    const initDraws4 = initGameSeed113c(this.gameSeed, this.currentMapSeed)
    this.actMonsterOutfitPalettes = createActMonsterOutfitPalettes113c()
    this.drlgRoomPopulator = config.drlgEnv
      ? new DrlgRoomPopulator113c({
          drlgEnv: config.drlgEnv,
          mapSeed: this.currentMapSeed,
          difficulty: this.difficulty,
          monCtrlInit: initDraws4[0],
          objCtrlInit: initDraws4[1],
        })
      : null
    if (this.drlgRoomPopulator !== null) {
      const populator = this.drlgRoomPopulator
      this.areaPathWorld.setDrlgTileZoneResolver113c((areaId, x, y) =>
        populator.tileZoneAt113c(areaToAct(areaId), x, y),
      )
    }
    {
      const stoneRng = new D2Rng(((this.currentMapSeed ^ 0x6a09e667) >>> 0) || 1)
      const stones = [17, 18, 19, 20, 21]
      for (let i = stones.length - 1; i > 0; i -= 1) {
        const j = stoneRng.rand(i + 1)
        const tmp = stones[i]!
        stones[i] = stones[j]!
        stones[j] = tmp
      }
      this.cairnStoneOrder = Object.freeze(stones)
    }
    this.manualPlayersX = Math.max(
      1,
      Math.min(8, Math.floor(config.playersX ?? this.policy.defaultPlayersX ?? 1)),
    )
    this.onPlayersXChange = config.onPlayersXChange
    this.partyManager = new PartyManager((unitId, partyId) => {
      const p = this.players.get(unitId)
      if (p) p.partyId = partyId
    })
    this.animActionWindupEnabled = Boolean(
      config.animActionWindup ?? config.enableAnimWindup ?? false,
    )
    if (config.resolveAreaBootstrap) {
      this.setAreaBootstrapResolver(config.resolveAreaBootstrap)
    }
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


  get playersX(): number {
    return Math.max(1, Math.min(8, Math.max(this.manualPlayersX, this.players.size)))
  }


  get playerCount(): number {
    return this.players.size
  }


  /** Ladder-only runewords / cube recipes (`Runes.txt` `server=1`, `Cubemain.txt` `ladder=1`, `#1949`). */
  get isLadder(): boolean {
    return this.isLadderRulesEnabled()
  }

  /**
   * 1.13c `DUNGEON_GetHoradricStaffTombLevelId(pAct[1])` (`D2Game.dll` `0x6fc2ab9e`):
   * deterministic Act II True Tomb of Tal Rasha area ID (`66..72`) derived from `currentMapSeed`.
   */
  get trueTalRashaTombAreaId(): number {
    return getAct2StaffTombLevelId(this.currentMapSeed)
  }

  getTrueTalRashaTombAreaId(): number {
    return getAct2StaffTombLevelId(this.currentMapSeed)
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
      if (area.isWalkable(areaId, x, y, isFlying)) return true
      for (const adjId of area.adjacentAreaIds) {
        const adj = this.loadedAreas.get(adjId)
        if (adj && adj.isWalkable(adjId, x, y, isFlying)) return true
      }
      return false
    }
    // #1327 room population reads the DRLG rooms of the loaded area.
    this.setAreaRoomProvider((areaId) => this.loadedAreas.get(areaId)?.roomRects ?? null)
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


  isLadderRulesEnabled(): boolean {
    return Boolean(this.configLadder ?? false)
  }
}
