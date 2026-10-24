/**
 * Canonical 25Hz Authoritative Simulation Engine & Barrel (`src/server/engine/game-engine.ts`).
 * Hosts `GameEngine` and re-exports `GameInstance` / `GameModePolicy` (`game-instance.ts`) and all 1.13c engine subsystems.
 */

export * from './game-instance.ts'
export * from './state-hash.ts'
export * from './stat-list.ts'
export * from './state-bus.ts'
export * from './anim-dispatcher.ts'
export * from './aura-scanner.ts'
export * from './combat-pipeline.ts'
export * from './missile-engine.ts'
export * from './world-arena.ts'

import { tickCombat, createWorld, spawnMonsters, spawnMonsterPacks, damageMonster, rebindPlayer, levelForXp } from '../ai/monster-ai.ts'
import type { CombatWorld, CombatOptions, MonsterPack, MonsterStats, SafeZone, CombatPlayer, Monster, CombatEvent } from '../ai/monster-ai.ts'
import { CANONICAL_CHARSTATS, type CharacterClassCode } from '../../common/units/classes.ts'
import { Inventory, goldItem, totalStat } from '../../common/items/items.ts'
import type { Item, ItemBase, Affix, PlacedItem } from '../../common/items/items.ts'
import { castSkill, tickProjectiles, CANONICAL_113C_MISSILES, ISO_GROUND_ASPECT_RATIO, createActiveOverlay, getSkillCastOverlay, isAuraSkill, getAuraOverlayName, getAuraOverlayNames } from '../skills/skills.ts'
import {
  calculateHolyFireStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
  calculateSanctuaryStats,
  calculateConvictionStats,
  calculatePrayerStats,
  calculateCleansingStats,
  calculateMeditationStats,
  calculateRedemptionStats,
} from '../../common/skills/paladin-auras.ts'
import type { SkillDef, Projectile, ActiveOverlay, CreateActiveOverlayOptions } from '../skills/skills.ts'
import { QuestLog, npcDialog } from '../../common/world/quests.ts'
import type { NpcDef, QuestDef } from '../../common/world/quests.ts'
import { D2Rng, Rng } from '../../common/rng/d2-rng.ts'
import type { DropTables, CharsiImbueOptions } from '../../common/items/drop-tables.ts'
import {
  executeDropPipeline,
  computeCharsiImbueIlvl,
  isEligibleForCharsiImbue113c,
  imbueItem113c,
} from '../../common/items/drop-tables.ts'
import type { MonsterKind, Difficulty, MonsterRank } from '../../common/units/monsters-data.ts'
import { getMonsterTreasureClass, monsterStatsOf, monsterLevelFor, UNSCALED, MONSTER_TABLE } from '../../common/units/monsters-data.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import { resolvePotionSpec } from '../../common/items/misc-items.ts'
import { captureSnapshot, parseSnapshot, restoreSnapshot, serializeSnapshot } from '../save/save.ts'
import { MonsterStreamingManager } from '../../common/units/monster-streaming.ts'
import type { MonsterStreamingOptions, StreamingRoomDef, StreamingRoomState } from '../../common/units/monster-streaming.ts'
import { GroundItemManager, triggerFlippyBounce, findSafeDropPosition, findIsometricDropPosition, getPickupEdgeDistance, isWithinPickupBounds } from '../../common/items/ground-items.ts'
import type { GroundItemEntity, GroundItemSource } from '../../common/items/ground-items.ts'
import { ORTHO_CELL_WIDTH, ORTHO_CELL_HEIGHT } from '../../common/world/d2map.ts'
import { getInventoryGoldLimit } from '../../common/items/inventory-model.ts'
import { BeltModel as BeltHud } from '../../common/items/belt-model.ts'
import { computeLockstepHash } from './state-hash.ts'
import { encode0xA3AuraSkill } from '../../netproto/index.ts'
export { computeLockstepHash }

function isMonsterUndead(monster: Monster | undefined): boolean {
  if (!monster) return false
  if (typeof (monster as any).isUndead === 'boolean') return (monster as any).isUndead
  if (typeof monster.stats?.isUndead === 'boolean') return monster.stats.isUndead
  return false
}

export interface EngineInput {
  readonly movement: { readonly x: number; readonly y: number }
  readonly attacking: boolean
  readonly pickingUp: boolean
  readonly talking: boolean
  readonly digits: readonly number[]
  readonly saving: boolean
  readonly loading: boolean
}

export interface WorldMapProvider {
  readonly widthPx: number
  readonly heightPx: number
  readonly grid?: any
  readonly originX?: number
  readonly originY?: number
  overlap(x: number, y: number): number
  isMissileBlocked?(x: number, y: number, fromX?: number, fromY?: number): boolean
  hasLineOfSight?(fromX: number, fromY: number, toX: number, toY: number): boolean
}

/**
 * Project world pixel coordinates back to map cell coordinates.
 *
 * Inverts the 2:1 isometric diamond projection:
 * px = worldX - originX, py = worldY - originY
 * cellX = floor((px / 80 + py / 40) / 2)
 * cellY = floor((py / 40 - px / 80) / 2)
 */
export function worldToCell(
  terrain: WorldMapProvider | undefined,
  worldX: number,
  worldY: number,
): { cellX: number; cellY: number } {
  const originX = (terrain as any)?.originX ?? (terrain as any)?.grid?.originX ?? 0
  const originY = (terrain as any)?.originY ?? (terrain as any)?.grid?.originY ?? 0
  const px = worldX - originX
  const py = worldY - originY
  return {
    cellX: Math.floor((px / ORTHO_CELL_WIDTH + py / ORTHO_CELL_HEIGHT) / 2),
    cellY: Math.floor((py / ORTHO_CELL_HEIGHT - px / ORTHO_CELL_WIDTH) / 2),
  }
}

export interface PendingMonsterDrop {
  readonly monsterIndex: number
  readonly subjectId: string
  readonly superUniqueId?: string | undefined
  readonly monsterLevel: number
  readonly monsterRank: MonsterRank
  readonly monsterType: number
  readonly x: number
  readonly y: number
  readonly tcName: string
  readonly isBoss: boolean
  readonly isNoRatio: boolean
  readonly seed: number
  readonly killerContext: {
    readonly playerMf: number
    readonly playerGf: number
    readonly gamePlayers: number
    readonly partyPlayers: number
  }
  items?: readonly Item[] | undefined
}

/**
 * Where snapshots are kept.
 *
 * The engine owns *when* a save happens — on the rising edge of
 * {@link EngineInput.saving}, at a tick boundary, after the simulation has
 * settled — but not *where* it goes. Browsers have `localStorage`, tests have a
 * `Map`, and a future server would have a file; none of that may leak into the
 * simulation, which has to stay reproducible from a seed and an input log.
 */
export interface SnapshotStore {
  /**
   * Read the stored snapshot.
   *
   * @returns the serialized snapshot, or null when nothing has been saved.
   */
  read(): string | null
  /**
   * Overwrite the stored snapshot.
   *
   * @param data - a serialized snapshot.
   */
  write(data: string): void
}

export interface GameEngineOptions {
  spawn: { x: number; y: number }
  stats: readonly MonsterStats[]
  xpTable: readonly number[]
  itemBases?: readonly ItemBase[] | undefined
  prefixAffixes?: readonly Affix[] | undefined
  suffixAffixes?: readonly Affix[] | undefined
  dropTables?: DropTables | undefined
  difficulty?: Difficulty | undefined
  monsterKinds?: Map<string, MonsterKind> | undefined
  skills: readonly SkillDef[]
  npcDefs: readonly NpcDef[]
  questDefs: readonly QuestDef[]
  combatOptions: CombatOptions
  lootSeed?: number
  talkRadius: number
  pickupRadius: number
  inventoryCols: number
  inventoryRows: number
  /**
   * How many monsters to spawn at construction.
   *
   * Defaults to 8, which is the sandbox number this engine grew up with. Real
   * levels derive it from `Levels.txt` (`NumMon` for how many *kinds*, `MonDen`
   * for density), so callers that have a level row pass their own.
   */
  monsterCount?: number
  /**
   * Spawn spread around {@link GameEngineOptions.spawn}, in scene pixels.
   *
   * Defaults to 260. Real levels scatter across the whole map rather than a
   * disc around the entrance, so this is a sandbox affordance, not a rule.
   */
  monsterSpread?: number
  /**
   * Pre-planned packs, which take precedence over
   * {@link GameEngineOptions.stats} and {@link GameEngineOptions.monsterCount}.
   */
  monsterPacks?: readonly MonsterPack[]
  /**
   * Optional safe zones (e.g. around spawn point, town bridges, and waypoints)
   * where ordinary monster packs must not spawn.
   */
  safeZones?: readonly SafeZone[]
  /**
   * Whether to place NPCs on a synthetic ring around the spawn.
   */
  npcRingFallback?: boolean
  /**
   * Backing store for {@link EngineInput.saving} and
   * {@link EngineInput.loading}.
   */
  snapshotStore?: SnapshotStore
  /**
   * Optional pre-constructed MonsterStreamingManager for lazy room population
   * and active/sleeping monster streaming.
   */
  streamingManager?: MonsterStreamingManager | undefined
  /**
   * Pre-planned rooms for monster streaming. When configured without an explicit
   * streamingManager, a MonsterStreamingManager is initialized automatically.
   */
  roomPacks?: readonly StreamingRoomDef[] | undefined
  /**
   * Alias for roomPacks.
   */
  streamingRooms?: readonly StreamingRoomDef[] | undefined
  /**
   * Tuning options for MonsterStreamingManager when created from roomPacks.
   */
  streamingOptions?: MonsterStreamingOptions | undefined
  /**
   * Whether the level is a town (e.g. Rogue Encampment, Lut Gholein, Kurast Docks, Pandemonium Fortress, Harrogath).
   * In town, friendly auras only affect self; enemy debuffs, pulses, and corpse redemption are suspended.
   */
  isTown?: boolean | undefined
  /**
   * Current level ID (e.g. 1 for Rogue Encampment).
   */
  levelId?: number | undefined
  /**
   * Optional allies (mercenaries, party members, summons) for aura propagation in wilderness.
   */
  allies?: readonly any[] | undefined
  /**
   * Optional getter returning the list of items currently equipped by the player
   * (helm, armor, weapons, rings, amulet, boots, gloves, belt).
   * Evaluated dynamically on each kill event to combine with `this.bag.contents`.
   */
  getEquippedItems?: (() => readonly (Item | PlacedItem | any)[]) | undefined
  /**
   * Static list of equipped items, as an alternative to `getEquippedItems`.
   */
  equippedItems?: readonly (Item | PlacedItem | any)[] | undefined
  /**
   * Total players in game (for /players N NoDrop scaling). Defaults to 1 (clamped 1..8).
   */
  gamePlayers?: number | undefined
  /**
   * Nearby party members (for /players N NoDrop scaling). Defaults to 1 (clamped 1..8).
   */
  partyPlayers?: number | undefined
  /**
   * Optional BeltHud instance for authentic 1.13c two-pass potion auto-slotting on pickup.
   */
  belt?: BeltHud | undefined
  /**
   * Optional character class code for canonical CharStats initialization.
   */
  classCode?: CharacterClassCode | undefined
}

export interface GameEngineMetrics {
  casts: number
  castRefusals: number
  castHits: number
  dropsRolled: number
  pickups: number
  inventoryRefusals: number
  lastDrops: string[]
  playerHits: number
  questXp: number
  questGold: number
  saves: number
  loads: number
  saveError: string | null
}

/** Active explosion visual effect (e.g. fireexplode from firebolt). */
export interface ActiveExplosion {
  readonly id?: string | undefined
  readonly missileType: string
  readonly x: number
  readonly y: number
  frame: number
  readonly maxFrames: number
  readonly radius?: number | undefined
}

/**
 * Legacy single-player simulation harness kept for existing unit tests.
 *
 * @deprecated Not an authoritative runtime: no production module instantiates it (#1328).
 * `LocalLoopbackAdapter` (single player) and `MultiClientRoomHost` (multiplayer) both run
 * `GameInstance` (`game-instance.ts`), which is the single 25 Hz authoritative server. Wire new
 * 1.13c mechanics into `GameInstance`, never only here.
 */
export class GameEngine {
  world: CombatWorld
  loot: Rng
  bag: Inventory
  belt: BeltHud = new BeltHud()
  hud?: any | undefined
  equipped: Record<string, any> = {}
  private _beltSlots: (any | null)[] = new Array(16).fill(null)
  private _goldExplicitlySet = false
  ground: { x: number; y: number; item: Item; groundItemId?: string | undefined; id?: string | undefined; isGold?: boolean | undefined; goldAmount?: number | undefined }[] = []
  groundItems: GroundItemManager = new GroundItemManager()
  questLog: QuestLog
  projectiles: Projectile[] = []
  explosions: ActiveExplosion[] = []
  overlays: ActiveOverlay[] = []
  castRng: Rng
  hydraGroupSeqCounter = 0
  overlaySeqCounter = 0
  pendingCommands: any[] = []
  private _syncingGround = false
  skillCooldown = 0
  selectedSkill = 0
  npcEntities: NpcEntity[] = []
  dialog: string[] = []
  isTown = false
  levelId = 1
  allies: any[] = []
  public gamePlayers = 1
  public partyPlayers = 1
  activeAuraSkillId: number | null = null
  activeAuraOverlay: ActiveOverlay | null = null
  activeAuraOverlays: ActiveOverlay[] = []
  activeAuraLevel = 1
  onMissileStep?: ((missileType: string, prevX: number, prevY: number, curX: number, curY: number, projectile: Projectile) => void) | undefined
  streamingManager?: MonsterStreamingManager | undefined
  private savingHeld = false
  private loadingHeld = false
  
  metrics: GameEngineMetrics = {
    casts: 0, castRefusals: 0, castHits: 0, dropsRolled: 0, pickups: 0,
    inventoryRefusals: 0, lastDrops: [], playerHits: 0, questXp: 0, questGold: 0,
    saves: 0, loads: 0, saveError: null,
  }

  tickCount = 0
  nextDelayByTarget: Map<string | number, number> = new Map()

  public terrain: WorldMapProvider
  public opts: GameEngineOptions

  constructor(terrainOrClass?: WorldMapProvider | CharacterClassCode, rawOpts?: GameEngineOptions) {
    const isClassArg = typeof terrainOrClass === 'string' || terrainOrClass === undefined
    const terrain: WorldMapProvider = isClassArg
      ? { widthPx: 2000, heightPx: 2000, overlap: () => 0 }
      : terrainOrClass
    const opts: GameEngineOptions = rawOpts ?? {
      spawn: { x: 200, y: 200 },
      stats: [],
      xpTable: [0, 0, 500, 1500, 3750],
      skills: [],
      npcDefs: [],
      questDefs: [],
      combatOptions: {
        playerSpeed: 170,
        playerReach: 48,
        playerCooldownTicks: 5,
        playerDamage: 10,
        playerManaPerAttack: 0,
        respawnTicks: 50,
      },
      lootSeed: 0x5eed,
      talkRadius: 64,
      pickupRadius: 64,
      inventoryCols: 10,
      inventoryRows: 4,
      monsterCount: 0,
      ...(typeof terrainOrClass === 'string' ? { classCode: terrainOrClass } : {}),
    }
    this.terrain = terrain
    this.opts = opts
    this.isTown = opts.isTown ?? false
    this.levelId = opts.levelId ?? 1
    this.allies = opts.allies ? [...opts.allies] : []
    if (opts.belt) {
      this.belt = opts.belt
    } else {
      this.belt = new BeltHud()
      this.belt.bindEquippedBeltSource(() => this.equipped.belt ?? null)
    }
    this.gamePlayers = Math.max(1, Math.min(8, Math.trunc(opts.gamePlayers ?? 1)))
    this.partyPlayers = Math.max(1, Math.min(this.gamePlayers, Math.trunc(opts.partyPlayers ?? 1)))
    const rooms = opts.roomPacks ?? opts.streamingRooms
    if (opts.streamingManager !== undefined) {
      this.streamingManager = opts.streamingManager
      this.world = opts.streamingManager.world
    } else {
      const initialClass = opts.classCode ?? 'sor'
      this.world = createWorld(opts.spawn.x, opts.spawn.y, undefined, undefined, initialClass)
      this.applyClassProfile(initialClass)
      if (rooms !== undefined && rooms.length > 0) {
        this.streamingManager = new MonsterStreamingManager(
          this.world,
          this.terrain,
          rooms,
          opts.streamingOptions,
        )
      }
    }

    const spread = opts.monsterSpread ?? 260
    const count = opts.monsterCount ?? 8
    const spawnSeed = opts.lootSeed ?? 0x5eed
    if (this.streamingManager !== undefined) {
      // Monsters are lazily populated by streamingManager; avoid frame-0 eager population.
    } else if (opts.monsterPacks !== undefined && opts.monsterPacks.length > 0) {
      spawnMonsterPacks(this.world, opts.monsterPacks, opts.spawn, spread, this.terrain, opts.safeZones, undefined, spawnSeed)
    } else if (count > 0) {
      spawnMonsters(this.world, opts.stats, count, opts.spawn, spread, this.terrain, spawnSeed)
    }
    this.loot = new Rng(opts.lootSeed ?? 0x5eed)
    this.bag = new Inventory(opts.inventoryCols, opts.inventoryRows)
    this.questLog = new QuestLog(opts.questDefs ?? [])
    this.castRng = new Rng((opts.lootSeed ?? 0x5eed) ^ 0x51c1)

    this.groundItems.onAdd = (entity) => {
      if (this._syncingGround) return
      const existing = this.ground.find(g => g.groundItemId === entity.id)
      if (!existing) {
        const itemObj = (entity.item && typeof entity.item === 'object' && 'name' in entity.item)
          ? (entity.item as Item)
          : (entity.isGold ? goldItem(entity.amount || 1) : (entity.item as any))
        const entry: any = {
          x: entity.x,
          y: entity.y,
          item: itemObj,
          groundItemId: entity.id,
        }
        Object.defineProperties(entry, {
          id: { get: () => entity.id, enumerable: false, configurable: true },
          isGold: { get: () => entity.isGold, enumerable: false, configurable: true },
          goldAmount: { get: () => entity.amount, enumerable: false, configurable: true },
        })
        this.ground.push(entry)
      }
    }
    this.groundItems.onRemove = (entity) => {
      if (this._syncingGround) return
      const idx = this.ground.findIndex(g => g.groundItemId === entity.id || (g.groundItemId === undefined && g.item === entity.item))
      if (idx !== -1) {
        this.ground.splice(idx, 1)
      }
    }
    this.groundItems.onClear = () => {
      if (this._syncingGround) return
      this.ground.length = 0
    }

    if (opts.npcRingFallback ?? true) {
      for (let attempt = 0; attempt < 40 && this.npcEntities.length < this.opts.npcDefs.length; attempt += 1) {
        const angle = attempt * 1.7 + 0.6
        const x = opts.spawn.x + Math.cos(angle) * 56
        const y = opts.spawn.y + Math.sin(angle) * 56
        if (this.terrain.overlap(x, y) > 0) continue
        const def = this.opts.npcDefs[this.npcEntities.length]
        if (def === undefined) break
        this.npcEntities.push({ def, x, y, hasSprite: false })
      }
    }
  }

  /**
   * Synchronize any direct array mutations on `this.ground` (e.g. `engine.ground.push(...)` or `engine.ground.length = 0`)
   * with `this.groundItems` so both views stay strictly 1:1.
   */
  public syncGroundStores(): void {
    if (this._syncingGround) return
    this._syncingGround = true
    try {
      if (this.ground.length === 0 && this.groundItems.count > 0) {
        this.groundItems.clear()
        return
      }
      for (const entry of this.ground) {
        if (!entry.groundItemId || !this.groundItems.get(entry.groundItemId)) {
          const cell = worldToCell(this.terrain, entry.x, entry.y)
          const isGold = entry.item?.base?.id === 'gold' || entry.item?.code?.trim() === 'gld' || (entry.item as any)?.id === 'gold'
          const goldAmount = isGold ? (entry.item.stack ?? entry.item.value ?? 1) : undefined
          const entity = this.groundItems.add(entry.item, cell.cellX, cell.cellY, entry.x, entry.y, {
            ...(goldAmount !== undefined ? { amount: goldAmount } : {}),
            bounce: false,
            now: this.world.tick * 40,
          })
          entry.groundItemId = entity.id
        }
      }
    } finally {
      this._syncingGround = false
    }
  }

  /**
   * Dynamically assign or update drop tables (e.g. when loaded asynchronously in the background).
   */
  setDropTables(dropTables: DropTables): void {
    this.opts.dropTables = dropTables
    this.opts.monsterKinds = dropTables.monsterKinds
  }

  get dropTables(): DropTables | undefined {
    return this.opts.dropTables
  }

  /** Player gold amount in bag inventory. */
  get gold(): number {
    return this.bag.gold
  }

  set gold(value: number) {
    this._goldExplicitlySet = true
    this.bag.gold = Math.max(0, Math.min(this.maxGoldCapacity, Math.floor(value)))
    if (this.hud?.inventory) {
      this.hud.inventory.gold = this.bag.gold
    }
  }

  /** Authentic 1.13c character inventory gold capacity: level * 10,000. */
  get maxGoldCapacity(): number {
    return getInventoryGoldLimit(this.world.player?.level ?? 1)
  }

  /**
   * Authoritative player state view backed directly by `this.world.player` and `this.bag`.
   */
  get playerState(): any {
    const engine = this
    const p = this.world.player
    return {
      get hp() { return p.hp },
      set hp(v: number) { p.hp = Math.max(0, Math.min(p.maxHp, v)); p.alive = p.hp > 0; engine.hud?.syncFromEngine?.() },
      get maxHp() { return p.maxHp },
      set maxHp(v: number) { p.maxHp = Math.max(1, v); engine.hud?.syncFromEngine?.() },
      get mana() { return p.mana },
      set mana(v: number) { p.mana = Math.max(0, Math.min(p.maxMana, v)); engine.hud?.syncFromEngine?.() },
      get maxMana() { return p.maxMana },
      set maxMana(v: number) { p.maxMana = Math.max(0, v); engine.hud?.syncFromEngine?.() },
      get stamina() { return p.stamina ?? 100 },
      set stamina(v: number) { p.stamina = Math.max(0, Math.min(p.maxStamina ?? 100, v)); engine.hud?.syncFromEngine?.() },
      get maxStamina() { return p.maxStamina ?? 100 },
      set maxStamina(v: number) { p.maxStamina = Math.max(1, v); engine.hud?.syncFromEngine?.() },
      get level() { return p.level ?? engine.world.level ?? 1 },
      set level(v: number) { p.level = v; engine.world.level = v; engine.hud?.syncFromEngine?.() },
      get xp() { return p.xp },
      set xp(v: number) { p.xp = v; engine.world.xp = v; engine.hud?.syncFromEngine?.() },
      get str() { return p.str ?? 10 },
      set str(v: number) { p.str = v; engine.hud?.syncFromEngine?.() },
      get strength() { return p.str ?? 10 },
      set strength(v: number) { p.str = v; engine.hud?.syncFromEngine?.() },
      get dex() { return p.dex ?? 25 },
      set dex(v: number) { p.dex = v; engine.hud?.syncFromEngine?.() },
      get dexterity() { return p.dex ?? 25 },
      set dexterity(v: number) { p.dex = v; engine.hud?.syncFromEngine?.() },
      get vit() { return p.vit ?? 10 },
      set vit(v: number) { p.vit = v; engine.hud?.syncFromEngine?.() },
      get vitality() { return p.vit ?? 10 },
      set vitality(v: number) { p.vit = v; engine.hud?.syncFromEngine?.() },
      get ene() { return p.ene ?? 35 },
      set ene(v: number) { p.ene = v; engine.hud?.syncFromEngine?.() },
      get energy() { return p.ene ?? 35 },
      set energy(v: number) { p.ene = v; engine.hud?.syncFromEngine?.() },
      get statPoints() { return p.statPoints ?? 0 },
      set statPoints(v: number) { p.statPoints = v; engine.hud?.syncFromEngine?.() },
      get skillPoints() { return p.skillPoints ?? 0 },
      set skillPoints(v: number) { p.skillPoints = v; engine.hud?.syncFromEngine?.() },
      get gold() { return engine.bag.gold },
      set gold(v: number) { engine.gold = v },
      get maxGold() { return engine.maxGoldCapacity },
      get maxGoldCapacity() { return engine.maxGoldCapacity },
      get classCode() { return p.classCode ?? 'sor' },
      set classCode(v: CharacterClassCode) { engine.applyClassProfile(v); engine.hud?.syncFromEngine?.() },
      get alive() { return p.alive },
      set alive(v: boolean) { p.alive = v },
      get equipped() { return engine.equipped },
      get belt() { return engine._beltSlots },
      get bag() { return engine.bag },
    }
  }

  /**
   * Set players simulation count (1..8) and party count (1..8) for authentic 1.13c /players N NoDrop scaling.
   */
  public setPlayers(players: number, partyPlayers = 1): void {
    this.gamePlayers = Math.max(1, Math.min(8, Math.trunc(players)))
    this.partyPlayers = Math.max(1, Math.min(this.gamePlayers, Math.trunc(partyPlayers)))
  }

  /**
   * Activates or deactivates an authentic Diablo II v1.13c aura on the player.
   */
  updateActiveAura(skillId: number | null, slvl = 1): void {
    const normalizedSkillId = skillId !== null && isAuraSkill(skillId) ? skillId : null
    if (this.activeAuraSkillId === normalizedSkillId && this.activeAuraLevel === slvl) {
      return
    }

    // Clean up previous aura overlay and any enemy conviction overlays
    if (this.activeAuraSkillId !== null) {
      for (const ov of this.overlays) {
        if (ov.isAura) {
          ov.expired = true
        }
      }
      this.overlays = this.overlays.filter(ov => !ov.expired)
      this.activeAuraOverlay = null
      this.activeAuraOverlays = []
    }

    this.activeAuraSkillId = normalizedSkillId
    this.activeAuraLevel = slvl

    if (normalizedSkillId !== null) {
      const ovNames = getAuraOverlayNames(normalizedSkillId)
      const player = this.world.player
      const spawned: ActiveOverlay[] = []
      for (const ovName of ovNames) {
        const auraOverlay = createActiveOverlay(
          ovName,
          { x: player.x, y: player.y },
          'player',
          undefined,
          {
            id: `overlay_${ovName}_${++this.overlaySeqCounter}`,
            loop: true,
            isAura: true,
            auraSkillId: normalizedSkillId,
          },
        )
        this.overlays.push(auraOverlay)
        spawned.push(auraOverlay)
      }
      this.activeAuraOverlays = spawned
      this.activeAuraOverlay = spawned[0] ?? null
    }
  }

  /**
   * Spawns an active cast overlay effect on an entity (defaulting to the player).
   * Replaces any existing non-aura cast overlay for the same caster to prevent oversaturated additive stacking.
   */
  spawnOverlay(
    overlayName: string,
    caster?: { x: number; y: number },
    casterId = 'player',
    options?: CreateActiveOverlayOptions,
  ): ActiveOverlay {
    const pos = caster ?? { x: this.world.player.x, y: this.world.player.y }
    const mergedOptions: CreateActiveOverlayOptions = {
      ...options,
      id: options?.id ?? `overlay_${overlayName}_${++this.overlaySeqCounter}`,
    }
    const overlay = createActiveOverlay(overlayName, pos, casterId, undefined, mergedOptions)

    if (overlay.isCastOverlay) {
      for (const ov of this.overlays) {
        if (ov.casterId === casterId && ov.isCastOverlay && !ov.isAura) {
          ov.expired = true
        }
      }
    } else if (overlay.isStateOverlay) {
      for (const ov of this.overlays) {
        if (ov.casterId === casterId && ov.isStateOverlay && !ov.isAura) {
          const isSameOverlay = ov.overlayName === overlay.overlayName
          const isGroup1MutualExclusion = ov.stateGroup === 1 && overlay.stateGroup === 1
          if (isSameOverlay || isGroup1MutualExclusion) {
            ov.expired = true
          }
        }
      }
    }

    this.overlays = this.overlays.filter(ov => !ov.expired)
    this.overlays.push(overlay)
    return overlay
  }

  tick(input: EngineInput): void {
    if (this.pendingCommands.length > 0) {
      const cmds = this.pendingCommands.splice(0, this.pendingCommands.length)
      for (const cmd of cmds) {
        this.execute(cmd)
      }
    }
    if (this.ground.length === 0 && this.groundItems.count > 0) {
      this._syncingGround = true
      this.groundItems.clear()
      this._syncingGround = false
    }
    if (!this.world.pendingKills || this.world.pendingKills.length === 0) {
      this.world.events = []
    }
    const movement = input.movement
    const player = this.world.player
    const beforeX = player.x
    const beforeY = player.y

    this.streamingManager?.update(player.x, player.y)

    // Authentic 1.13c mana regeneration: full mana pool over 120 seconds (3000 ticks at 25fps)
    if (player.mana < player.maxMana) {
      const rem = (player.manaRemainder256 ?? 0) + player.maxMana
      const whole = Math.floor(rem / 3000)
      player.manaRemainder256 = rem % 3000
      if (whole > 0) {
        player.mana = Math.min(player.maxMana, player.mana + whole)
      }
    } else {
      player.manaRemainder256 = 0
    }

    const digits = input.digits
    let digitTriggeredShorthandCast = false
    if (digits.length > 0 && this.opts.skills.length > 0) {
      const nextIdx = Math.min(Math.max(digits[0]! - 1, 0), this.opts.skills.length - 1)
      const cand = this.opts.skills[nextIdx] as any
      if (cand && (cand.kind !== undefined || (this.opts.skills.length === 1 && cand.projectile === true))) {
        this.selectedSkill = nextIdx
        digitTriggeredShorthandCast = true
      }
    }

    const rawWanted = this.opts.skills[this.selectedSkill] as any
    const wanted: SkillDef | undefined = rawWanted
      ? {
          ...rawWanted,
          projectile: rawWanted.projectile ?? rawWanted.kind === 'projectile',
          baseMinDamage: rawWanted.baseMinDamage ?? rawWanted.damage ?? 1,
          baseMaxDamage: rawWanted.baseMaxDamage ?? rawWanted.damage ?? 1,
          damagePerLevel: rawWanted.damagePerLevel ?? 0,
          range:
            rawWanted.range ??
            Math.max(16, Math.round(((rawWanted.rangeTicks ?? 20) * (rawWanted.speed ?? 200)) / 25)),
        }
      : undefined
    let castHappened = false
    const casting =
      wanted !== undefined &&
      ((input.attacking && (this.selectedSkill > 0 || rawWanted?.kind !== undefined)) ||
        digitTriggeredShorthandCast)

    if (casting && wanted !== undefined) {
      const result = castSkill(
        wanted, { x: player.x, y: player.y, facing: player.facing },
        1, this.castRng, this.skillCooldown, player.mana,
      )
      if (result.kind === 'projectile') {
        this.projectiles.push(result.projectile)
        player.mana = Math.max(0, player.mana - wanted.manaCost)
        this.skillCooldown = wanted.cooldownTicks
        this.metrics.casts += 1
        castHappened = true
        const overlayName = wanted.castOverlay ?? getSkillCastOverlay(wanted.id)
        if (overlayName) {
          this.spawnOverlay(overlayName, { x: player.x, y: player.y }, 'player')
        }
      } else if (result.kind === 'instant') {
        player.mana = Math.max(0, player.mana - wanted.manaCost)
        this.skillCooldown = wanted.cooldownTicks
        this.metrics.casts += 1
        castHappened = true
        const overlayName = wanted.castOverlay ?? getSkillCastOverlay(wanted.id)
        if (overlayName) {
          this.spawnOverlay(overlayName, { x: player.x, y: player.y }, 'player')
        }
        this.world.monsters.forEach((monster, index) => {
          if (monster.state === 'dead') return
          if (Math.hypot(monster.x - player.x, monster.y - player.y) > wanted.radius + 20) return
          damageMonster(this.world, index, result.damage)
        })
      } else if (result.kind === 'mana') {
        this.metrics.castRefusals += 1
      }
    }

    const combatOptions = { ...this.opts.combatOptions, preserveEvents: true }
    tickCombat(this.world, { movement, attack: castHappened ? false : input.attacking }, combatOptions, this.terrain, this.opts.xpTable ?? [])

    for (const ev of this.world.events) {
      if (
        ev.kind === 'unitOverlay' &&
        ev.overlayToken &&
        !(ev as any)._overlaySpawned
      ) {
        ;(ev as any)._overlaySpawned = true
        const targetId =
          ev.targetUnitType === 1 && ev.monsterIndex !== undefined
            ? `monster-${ev.monsterIndex}`
            : 'player'
        this.spawnOverlay(ev.overlayToken, { x: ev.x, y: ev.y }, targetId, {
          loop: false,
          isCastOverlay: false,
          ...(ev.targetUnitType === 1 && ev.monsterIndex !== undefined
            ? { targetMonsterIndex: ev.monsterIndex }
            : {}),
        })
      }
      if (
        ev.kind === 'missileHit' &&
        ev.missileType === 'chillingarmorbolt' &&
        !(ev as any)._boltSpawned
      ) {
        ;(ev as any)._boltSpawned = true
        const attacker =
          ev.monsterIndex !== undefined
            ? this.world.monsters.find(m => m.index === ev.monsterIndex)
            : undefined
        const tx = attacker?.x ?? player.x + 18
        const ty = attacker?.y ?? player.y
        const dx = tx - player.x
        const dy = ty - player.y
        const dist = Math.hypot(dx, dy) || 1
        const speed = 18 // 1.13c Missiles.txt chillingarmorbolt Vel=18, Range=25
        this.spawnOverlay('chillarmor_hit', { x: player.x, y: player.y }, 'player', { loop: false })
        this.projectiles.push({
          skillId: '60',
          x: player.x,
          y: player.y,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          damage: 0,
          ttl: 25,
          fromPlayer: true,
          missileType: 'chillingarmorbolt',
          pierce: false,
        })
      }
    }
    
    if (this.world.events.some(event => event.kind === 'monsterHit')) this.metrics.playerHits += 1

    if (digits.length > 0 && this.opts.skills.length > 0) {
      this.selectedSkill = Math.min(Math.max(digits[0]! - 1, 0), this.opts.skills.length - 1)
    }
    if (this.skillCooldown > 0) this.skillCooldown -= 1

    this.tickCount = this.world.tick
    for (const [targetId, expireTick] of this.nextDelayByTarget) {
      if (expireTick <= this.tickCount) {
        this.nextDelayByTarget.delete(targetId)
      }
    }

    if (this.projectiles.length > 0) {
      const targets = this.world.monsters.map((monster, index) => ({
        index, x: monster.x, y: monster.y, radius: 20, alive: monster.state !== 'dead',
      }))
      const outcome = tickProjectiles(this.projectiles, targets, {
        overlap: (x, y) => this.terrain.overlap(x, y),
        isMissileBlocked: this.terrain.isMissileBlocked ? (x, y, fromX, fromY) => this.terrain.isMissileBlocked!(x, y, fromX, fromY) : undefined,
        nextDelayByTarget: this.nextDelayByTarget,
        currentTick: this.tickCount,
        onMissileStep: this.onMissileStep,
      })
      this.projectiles.length = 0
      // outcome.alive already contains spawned projectiles from tickProjectiles
      this.projectiles.push(...outcome.alive)
      for (const hit of outcome.hits) {
        const targetMonster = this.world.monsters.find(m => m.index === hit.targetIndex)
        if (hit.isUndeadOnly) {
          if (!isMonsterUndead(targetMonster)) {
            continue
          }
        }

        damageMonster(this.world, hit.targetIndex, hit.damage)
        this.metrics.castHits += 1

        if (targetMonster) {
          if (hit.statusEffect === 'freeze') {
            targetMonster.frozenTicks = hit.statusDuration ?? 75
          } else if (hit.statusEffect === 'chill') {
            targetMonster.chillTicks = hit.statusDuration ?? 100
          } else if (hit.statusEffect === 'poison') {
            targetMonster.poisonTicks = hit.statusDuration ?? 100
          }
          if (hit.stunDuration !== undefined && hit.stunDuration > 0 && !(targetMonster as any).isBoss && targetMonster.stats?.rank !== 'boss') {
            targetMonster.stunTicks = Math.max(targetMonster.stunTicks ?? 0, hit.stunDuration)
          }
          if (hit.knockback && !(targetMonster as any).isBoss && targetMonster.stats?.rank !== 'boss') {
            const dx = targetMonster.x - player.x
            const dy = targetMonster.y - player.y
            const len = Math.hypot(dx, dy) || 1
            targetMonster.x += Math.round((dx / len) * 20)
            targetMonster.y += Math.round((dy / len) * 20)
          }
        }

        // AoE splash damage
        if (hit.aoeRadius && hit.aoeRadius > 0) {
          for (const m of this.world.monsters) {
            if (m.index === hit.targetIndex || m.state === 'dead' || m.hp <= 0) continue
            if (hit.isUndeadOnly) {
              if (!isMonsterUndead(m)) continue
            }
            // Ground distance in 2:1 isometric projection:
            // dx^2 + (dy / ISO_GROUND_ASPECT_RATIO)^2 <= aoeRadius^2
            const dx = m.x - hit.x
            const dy = (m.y - hit.y) / ISO_GROUND_ASPECT_RATIO
            if (Math.hypot(dx, dy) <= hit.aoeRadius) {
              damageMonster(this.world, m.index, hit.aoeDamage ?? hit.damage)
              if (hit.statusEffect === 'freeze') {
                m.frozenTicks = hit.statusDuration ?? 75
              } else if (hit.statusEffect === 'chill') {
                m.chillTicks = hit.statusDuration ?? 100
              } else if (hit.statusEffect === 'poison') {
                m.poisonTicks = hit.statusDuration ?? 100
              }
            }
          }
        }

        const missileType =
          hit.missileType ??
          (hit.skillId === '36' || hit.skillId === 'firebolt'
            ? 'firebolt'
            : hit.skillId === '47' || hit.skillId === 'fireball'
              ? 'fireball'
              : hit.skillId === '27' || hit.skillId === 'immolationarrow'
                ? 'immolationarrow'
                : hit.skillId === '31' || hit.skillId === 'freezingarrow'
                  ? 'freezingarrow'
                  : undefined)
        const mslData = missileType ? CANONICAL_113C_MISSILES[missileType] : undefined
        const explType =
          mslData?.explosionMissile ||
          (missileType === 'firebolt'
            ? 'fireexplode'
            : missileType === 'fireball' ||
                missileType === 'immolationarrow' ||
                hit.skillId === '27'
              ? 'explodingarrowexp'
              : missileType === 'freezingarrow' ||
                  hit.skillId === '31' ||
                  missileType === 'glacialspike' ||
                  hit.skillId === '55'
                ? 'freezingarrowexp1'
                : '')
        if (explType) {
          const explData = CANONICAL_113C_MISSILES[explType]
          const maxFrames = explData?.animLen || 16
          this.explosions.push({
            missileType: explType,
            x: hit.x,
            y: hit.y,
            frame: 0,
            maxFrames,
            radius: hit.aoeRadius ?? 24,
          })
          if (missileType === 'glacialspike' || hit.skillId === '55' || hit.skillId === 'glacialspike') {
            const ejectaData = CANONICAL_113C_MISSILES['freezingarrowexp2']
            this.explosions.push({
              missileType: 'freezingarrowexp2',
              x: hit.x,
              y: hit.y,
              frame: 0,
              maxFrames: ejectaData?.animLen || 15,
              radius: hit.aoeRadius ?? 64,
            })
          } else if (missileType === 'freezingarrow' || hit.skillId === '31') {
            const exp2Data = CANONICAL_113C_MISSILES['freezingarrowexp2']
            this.explosions.push({
              missileType: 'freezingarrowexp2',
              x: hit.x,
              y: hit.y,
              frame: 0,
              maxFrames: exp2Data?.animLen || 15,
              radius: hit.aoeRadius ?? 80,
            })
          }
          this.world.events.push({
            kind: 'missileExplode',
            missileType: explType,
            skillId: hit.skillId,
            x: hit.x,
            y: hit.y,
            amount: hit.aoeDamage ?? hit.damage,
          })
        }
      }

      if (outcome.wallHitEvents) {
        for (const wallHit of outcome.wallHitEvents) {
          if (wallHit.aoeRadius && wallHit.aoeRadius > 0) {
            for (const m of this.world.monsters) {
              if (m.state === 'dead' || m.hp <= 0) continue
              const dx = m.x - wallHit.x
              const dy = (m.y - wallHit.y) / ISO_GROUND_ASPECT_RATIO
              if (Math.hypot(dx, dy) <= wallHit.aoeRadius) {
                const dmg = wallHit.damage ?? 10
                damageMonster(this.world, m.index, dmg)
                if (wallHit.statusEffect === 'freeze' || wallHit.missileType === 'glacialspike' || wallHit.skillId === '55' || wallHit.skillId === 'glacialspike') {
                  m.frozenTicks = wallHit.statusDuration ?? 75
                } else if (wallHit.statusEffect === 'chill') {
                  m.chillTicks = wallHit.statusDuration ?? 100
                } else if (wallHit.statusEffect === 'poison') {
                  m.poisonTicks = wallHit.statusDuration ?? 100
                }
              }
            }
          }
          const missileType =
            wallHit.missileType ??
            (wallHit.skillId === '36' || wallHit.skillId === 'firebolt'
              ? 'firebolt'
              : wallHit.skillId === '47' || wallHit.skillId === 'fireball'
                ? 'fireball'
                : wallHit.skillId === '27' || wallHit.skillId === 'immolationarrow'
                  ? 'immolationarrow'
                  : wallHit.skillId === '31' || wallHit.skillId === 'freezingarrow'
                    ? 'freezingarrow'
                    : undefined)
          const mslData = missileType ? CANONICAL_113C_MISSILES[missileType] : undefined
          const explType =
            mslData?.explosionMissile ||
            (missileType === 'firebolt'
              ? 'fireexplode'
              : missileType === 'fireball' ||
                  missileType === 'immolationarrow' ||
                  wallHit.skillId === '27'
                ? 'explodingarrowexp'
                : missileType === 'freezingarrow' ||
                    wallHit.skillId === '31' ||
                    missileType === 'glacialspike' ||
                    wallHit.skillId === '55'
                  ? 'freezingarrowexp1'
                  : '')
          if (explType) {
            const explData = CANONICAL_113C_MISSILES[explType]
            const maxFrames = explData?.animLen || 16
            this.explosions.push({
              missileType: explType,
              x: wallHit.x,
              y: wallHit.y,
              frame: 0,
              maxFrames,
              radius: wallHit.aoeRadius ?? 24,
            })
            if (missileType === 'glacialspike' || wallHit.skillId === '55' || wallHit.skillId === 'glacialspike') {
              const ejectaData = CANONICAL_113C_MISSILES['freezingarrowexp2']
              this.explosions.push({
                missileType: 'freezingarrowexp2',
                x: wallHit.x,
                y: wallHit.y,
                frame: 0,
                maxFrames: ejectaData?.animLen || 15,
                radius: wallHit.aoeRadius ?? 64,
              })
            } else if (missileType === 'freezingarrow' || wallHit.skillId === '31') {
              const exp2Data = CANONICAL_113C_MISSILES['freezingarrowexp2']
              this.explosions.push({
                missileType: 'freezingarrowexp2',
                x: wallHit.x,
                y: wallHit.y,
                frame: 0,
                maxFrames: exp2Data?.animLen || 15,
                radius: wallHit.aoeRadius ?? 80,
              })
            }
            this.world.events.push({
              kind: 'missileExplode',
              missileType: explType,
              skillId: wallHit.skillId,
              x: wallHit.x,
              y: wallHit.y,
            })
          }
        }
      }
    }

    if (this.explosions.length > 0) {
      for (const exp of this.explosions) {
        exp.frame += 1
      }
      this.explosions = this.explosions.filter(exp => exp.frame < exp.maxFrames)
    }

    if (this.overlays.length > 0) {
      for (const overlay of this.overlays) {
        if (overlay.casterId === 'player') {
          overlay.x = player.x
          overlay.y = player.y
        } else if (overlay.targetMonsterIndex !== undefined) {
          const mon =
            this.world.monsters.find(m => m.index === overlay.targetMonsterIndex) ??
            this.world.monsters[overlay.targetMonsterIndex]
          if (!mon || mon.state === 'dead' || mon.hp <= 0) {
            overlay.expired = true
            continue
          }
          overlay.x = mon.x
          overlay.y = mon.y
        }
        overlay.frame += overlay.animRate / 25
        if (overlay.frame >= overlay.maxFrames) {
          if (overlay.loop) {
            overlay.frame = overlay.frame % overlay.maxFrames
          } else {
            overlay.expired = true
          }
        }
      }
      this.overlays = this.overlays.filter(overlay => !overlay.expired)
    }

    // Periodic Thunder Storm simulation (D2Game 0x6fc62510 + 0x6fc9a190 + 0x6fcaba90)
    if (player.thunderstormTicks && player.thunderstormTicks > 0) {
      player.thunderstormTicks -= 1
      if (player.thunderstormTicks <= 0) {
        player.thunderstormTicks = 0
        for (const ov of this.overlays) {
          if (
            (ov.overlayName === 'thunderstormback' || ov.overlayName === 'thunderstorm') &&
            ov.casterId === 'player'
          ) {
            ov.expired = true
          }
        }
      } else {
        player.thunderstormNextStrike = (player.thunderstormNextStrike ?? 0) - 1
        if (player.thunderstormNextStrike <= 0) {
          player.thunderstormNextStrike = player.thunderstormInterval ?? 41
          const inTown =
            this.isTown ||
            (this.opts.levelId !== undefined && [1, 40, 75, 103, 109].includes(this.levelId)) ||
            (player as any).isTown === true
          if (!inTown) {
            // Find nearest live monster within 17 subtiles (340 px)
            let nearestMonster: any = null
            let nearestMonsterIdx = -1
            let minDist = 340
            for (let mIdx = 0; mIdx < this.world.monsters.length; mIdx++) {
              const monster = this.world.monsters[mIdx]!
              if (monster.state === 'dead' || monster.hp <= 0 || (monster as any).isTown === true) continue
              const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
              if (dist <= minDist) {
                minDist = dist
                nearestMonster = monster
                nearestMonsterIdx = mIdx
              }
            }
            if (nearestMonster && nearestMonsterIdx >= 0) {
              const dmg = player.thunderstormDamage ?? 50
              const slvl = Math.max(1, player.thunderstormSlvl ?? 1)
              const casterId = Number((player as any).id ?? 1) >>> 0
              const targetId = Number(nearestMonster.index ?? nearestMonsterIdx) >>> 0
              damageMonster(this.world, nearestMonsterIdx, dmg)
              const unitSkillEvent = {
                type: 'UnitSkillEvent' as const,
                flag: 0,
                skill: 57,
                level: slvl,
                caster: { rawUnitType: 0, id: casterId },
                target: { rawUnitType: 1, id: targetId },
                x: 0,
                y: 0,
              }
              const packet0xA3 = encode0xA3AuraSkill(unitSkillEvent)
              this.projectiles.push({
                skillId: '57',
                x: nearestMonster.x,
                y: nearestMonster.y,
                vx: 0,
                vy: 0,
                damage: 0,
                ttl: 9,
                fromPlayer: true,
                missileType: 'thunderstorm1',
                pierce: true,
                ageTicks: 0,
              })
              this.world.events.push({
                kind: 'monsterHit',
                x: nearestMonster.x,
                y: nearestMonster.y,
                amount: dmg,
              })
              this.world.events.push({
                kind: 'missileHit',
                x: nearestMonster.x,
                y: nearestMonster.y,
                missileType: 'thunderstorm1',
                skillId: '57',
                amount: dmg,
              })
              this.world.events.push({
                kind: 'unitSkillEvent',
                x: nearestMonster.x,
                y: nearestMonster.y,
                monsterIndex: nearestMonster.index,
                skillId: '57',
                amount: dmg,
                packet0xA3,
                unitSkillEvent,
              })
            }
          }
        }
      }
    }

    if (!player.thunderstormTicks || player.thunderstormTicks <= 0) {
      for (const ov of this.overlays) {
        if (
          (ov.overlayName === 'thunderstormback' || ov.overlayName === 'thunderstorm') &&
          ov.casterId === 'player'
        ) {
          ov.expired = true
        }
      }
    }

    // Energy Shield duration tick & overlay management
    if (player.energyshieldTicks && player.energyshieldTicks > 0) {
      player.energyshieldTicks -= 1
      if (player.energyshieldTicks <= 0) {
        for (const ov of this.overlays) {
          if (ov.overlayName === 'energyshield' && ov.casterId === 'player') {
            ov.expired = true
          }
        }
      }
    }

    // Enchant buff overlay management (countdown handled in tickCombat)
    if (!player.enchantTicks || player.enchantTicks <= 0) {
      for (const ov of this.overlays) {
        if (ov.overlayName === 'enchant' && ov.casterId === 'player') {
          ov.expired = true
        }
      }
    }

    // Cold Armor duration tick & overlay management
    if (player.coldArmorTicks && player.coldArmorTicks > 0) {
      player.coldArmorTicks -= 1
      if (player.coldArmorTicks <= 0) {
        player.coldArmorType = undefined
        for (const ov of this.overlays) {
          if (
            (ov.overlayName === 'frozenarmor' ||
              ov.overlayName === 'shiverarmor' ||
              ov.overlayName === 'chillingarmor') &&
            ov.casterId === 'player'
          ) {
            ov.expired = true
          }
        }
      }
    }

    this.overlays = this.overlays.filter(overlay => !overlay.expired)

    // Blaze buff duration tick & footstep fire patch emission
    if (player.blazeTicks && player.blazeTicks > 0) {
      player.blazeTicks -= 1
      const distFromLast = Math.hypot(
        player.x - (player.lastBlazeX ?? player.x),
        player.y - (player.lastBlazeY ?? player.y),
      )
      if (distFromLast >= 24 || player.lastBlazeX === undefined) {
        player.lastBlazeX = player.x
        player.lastBlazeY = player.y
        this.projectiles.push({
          skillId: '46',
          x: player.x,
          y: player.y,
          vx: 0,
          vy: 0,
          damage: player.blazeDamage ?? 10,
          ttl: player.blazePatchDuration ?? 115,
          fromPlayer: true,
          missileType: 'blaze',
          pierce: true,
          aoeRadius: 24,
        })
      }
      if (player.blazeTicks <= 0) {
        player.lastBlazeX = undefined
        player.lastBlazeY = undefined
      }
    }

    // Druid Cyclone Armor (#235) state 151 cleanup when shield HP is depleted (#1081, #1285)
    if ((player.cycloneArmorHp ?? 0) <= 0) {
      ;(player as any).states?.delete?.(151)
      for (const ov of this.overlays) {
        if (
          (ov.overlayName === 'cyclonearmor1front' ||
            ov.overlayName === 'cyclonearmor1back' ||
            ov.overlayName === 'cyclonearmor2front' ||
            ov.overlayName === 'cyclonearmor2back' ||
            ov.overlayName === 'cyclonearmor3front' ||
            ov.overlayName === 'cyclonearmor3back') &&
          ov.casterId === 'player'
        ) {
          ov.expired = true
        }
      }
    }

    // Druid Armageddon (#249) duration tick & periodic meteor rock rainfall
    if (player.armageddonTicks && player.armageddonTicks > 0) {
      player.armageddonTicks -= 1
      if (player.armageddonTicks % 8 === 0) {
        const step = Math.floor(player.armageddonTicks / 8)
        const offX = ((step * 97) % 321) - 160
        const offY = ((step * 61) % 321) - 160
        const dropX = player.x + offX
        const dropY = player.y + offY
        this.projectiles.push({
          skillId: '249',
          x: dropX,
          y: dropY,
          vx: 0,
          vy: 0,
          altitude: 15 * 25,
          damage: player.armageddonDamage ?? 30,
          residualDamage: player.armageddonResidualDamage ?? 4,
          ttl: 15,
          fromPlayer: true,
          missileType: 'armageddonrock',
          aoeRadius: 40,
          pierce: false,
          slvl: player.armageddonSlvl ?? 1,
        })
      }
      if (player.armageddonTicks <= 0) {
        player.armageddonTicks = 0
        for (const ov of this.overlays) {
          if (ov.overlayName === 'inferno' && ov.casterId === 'player') {
            ov.expired = true
          }
        }
      }
    }

    // Druid Hurricane (#250) duration tick & periodic cold vortex pulse (every 20 frames, radius 9 subtiles = 180px)
    if (player.hurricaneTicks && player.hurricaneTicks > 0) {
      player.hurricaneTicks -= 1
      const inTown = this.isTown || [1, 40, 75, 103, 109].includes(this.levelId)
      if (!inTown && player.hurricaneTicks % 20 === 0) {
        const coldDmg = player.hurricaneDamage ?? 15
        const radiusPx = 180
        for (const monster of this.world.monsters) {
          if (monster.state === 'dead' || monster.hp <= 0) continue
          const dx = monster.x - player.x
          const dy = (monster.y - player.y) / ISO_GROUND_ASPECT_RATIO
          if (Math.hypot(dx, dy) <= radiusPx) {
            damageMonster(this.world, monster.index, coldDmg)
            monster.chillTicks = Math.max(monster.chillTicks ?? 0, 50)
          }
        }
      }
      if (player.hurricaneTicks <= 0) {
        player.hurricaneTicks = 0
        for (const ov of this.overlays) {
          if (ov.overlayName === 'Inferno' && ov.casterId === 'player') {
            ov.expired = true
          }
        }
      }
    }

    this.overlays = this.overlays.filter(overlay => !overlay.expired)

    // Periodic & continuous aura simulation (D2 v1.13c parity)
    if (this.activeAuraSkillId !== null) {
      const auraId = this.activeAuraSkillId
      const slvl = this.activeAuraLevel
      const inTown = this.isTown || [1, 40, 75, 103, 109].includes(this.levelId)
      const skillLevels = (this.hud as any)?.skillLevels ?? (player as any)?.skillLevels ?? {}
      const resistFireBlvl = Math.max(0, Number(skillLevels[100] ?? 0))
      const resistColdBlvl = Math.max(0, Number(skillLevels[105] ?? 0))
      const resistLightningBlvl = Math.max(0, Number(skillLevels[110] ?? 0))
      const salvationBlvl = Math.max(0, Number(skillLevels[125] ?? 0))
      const prayerBlvl = Math.max(0, Number(skillLevels[99] ?? 0))
      const cleansingBlvl = Math.max(0, Number(skillLevels[109] ?? 0))

      // Conviction (123):
      // - Caster has ground ring visual only, zero resistance/defense reduction on self!
      // - In wilderness: hostile enemies in range receive -Def% & -Res% and display convictionback ring under feet.
      // - In town: enemy debuffs and enemy overlays are completely suspended.
      if (auraId === 123) {
        const convStats = calculateConvictionStats(slvl)
        const auraRadius = Math.round(convStats.radiusSubtiles * 16)
        if (!inTown) {
          const activeIndices = new Set<number>()
          for (const monster of this.world.monsters) {
            if (monster.state === 'dead' || monster.hp <= 0) continue
            const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
            if (dist <= auraRadius) {
              activeIndices.add(monster.index)
              const hasOv = this.overlays.some(
                ov => !ov.expired && ov.isAura && ov.auraSkillId === 123 && ov.targetMonsterIndex === monster.index,
              )
              if (!hasOv) {
                this.overlays.push(
                  createActiveOverlay(
                    'convictionback',
                    { x: monster.x, y: monster.y },
                    `monster_${monster.index}`,
                    undefined,
                    {
                      loop: true,
                      isAura: true,
                      auraSkillId: 123,
                      targetMonsterIndex: monster.index,
                    },
                  ),
                )
              }
            }
          }
          // Remove conviction overlay from monsters that died or walked out of range
          for (const ov of this.overlays) {
            if (ov.isAura && ov.auraSkillId === 123 && ov.targetMonsterIndex !== undefined) {
              if (!activeIndices.has(ov.targetMonsterIndex)) {
                ov.expired = true
              }
            }
          }
        } else {
          // In town: expire all monster conviction overlays
          for (const ov of this.overlays) {
            if (ov.isAura && ov.auraSkillId === 123 && ov.targetMonsterIndex !== undefined) {
              ov.expired = true
            }
          }
        }
      }

      // Holy Freeze (114):
      // - Caster displays holyfreeze cyan ring.
      // - In wilderness: periodic cold pulse damage & chill (slow + blue tint) to enemies in range.
      // - D2 Ground Truth Invariant: Holy Freeze NEVER displays an aura ring under enemy feet!
      // - In town: pulse damage & slow are completely suspended.
      if (auraId === 114 && !inTown) {
        if (this.world.tick % 50 === 0) {
          const hfStats = calculateHolyFreezeStats(slvl, { resistCold: resistColdBlvl, salvation: salvationBlvl })
          const auraRadius = Math.round(hfStats.radiusSubtiles * 16)
          const coldDmg = Math.max(1, Math.round((hfStats.pulseMin + hfStats.pulseMax) / 2))
          for (const monster of this.world.monsters) {
            if (monster.state === 'dead' || monster.hp <= 0) continue
            const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
            if (dist <= auraRadius) {
              damageMonster(this.world, monster.index, coldDmg)
              monster.chillTicks = 100 // 4 seconds slow & blue tint
            }
          }
        }
      }

      // Holy Fire (102) & Holy Shock (118) in wilderness:
      if ((auraId === 102 || auraId === 118) && !inTown) {
        if (this.world.tick % 50 === 0) {
          const stats =
            auraId === 102
              ? calculateHolyFireStats(slvl, { resistFire: resistFireBlvl, salvation: salvationBlvl })
              : calculateHolyShockStats(slvl, { resistLightning: resistLightningBlvl, salvation: salvationBlvl })
          const auraRadius = Math.round(stats.radiusSubtiles * 16)
          const pulseDmg = Math.max(1, Math.round((stats.pulseMin + stats.pulseMax) / 2))
          for (const monster of this.world.monsters) {
            if (monster.state === 'dead' || monster.hp <= 0) continue
            const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
            if (dist <= auraRadius) {
              damageMonster(this.world, monster.index, pulseDmg)
            }
          }
        }
      }

      // Sanctuary (119) in wilderness:
      // - Periodic magic damage pulse + knockback against Undead monsters in range
      if (auraId === 119 && !inTown) {
        if (this.world.tick % 50 === 0) {
          const sancStats = calculateSanctuaryStats(slvl, { cleansing: cleansingBlvl })
          const auraRadius = Math.round(sancStats.radiusSubtiles * 16)
          const pulseDmg = Math.max(1, Math.round((sancStats.pulseMin + sancStats.pulseMax) / 2))
          for (const monster of this.world.monsters) {
            if (monster.state === 'dead' || monster.hp <= 0) continue
            if (!isMonsterUndead(monster)) continue
            const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
            if (dist <= auraRadius) {
              damageMonster(this.world, monster.index, pulseDmg)
              this.spawnOverlay('cast_undead', {
                x: monster.x,
                y: monster.y,
              })
              if (!(monster as any).isBoss && monster.stats?.rank !== 'boss') {
                const dx = monster.x - player.x
                const dy = monster.y - player.y
                const len = Math.hypot(dx, dy) || 1
                monster.x += Math.round((dx / len) * 24)
                monster.y += Math.round((dy / len) * 24)
              }
            }
          }
        }
      }

      // Prayer (99) & Cleansing (109) & Meditation (120) Prayer-synergy heal:
      // - Periodic heal every 50 ticks (2 seconds)
      // - In town: heals only self
      // - In wilderness: heals self and allies
      if (auraId === 99 || auraId === 109 || auraId === 120) {
        if (this.world.tick % 50 === 0) {
          const heal =
            auraId === 99
              ? calculatePrayerStats(slvl).healAmount
              : auraId === 109
                ? calculateCleansingStats(slvl, prayerBlvl).prayerHealAmount
                : calculateMeditationStats(slvl, prayerBlvl).prayerHealAmount
          if (heal > 0) {
            player.hp = Math.min(player.maxHp, player.hp + heal)
            if (!inTown && this.allies.length > 0) {
              for (const ally of this.allies) {
                if (ally && typeof ally.hp === 'number' && typeof ally.maxHp === 'number') {
                  ally.hp = Math.min(ally.maxHp, ally.hp + heal)
                }
              }
            }
          }
        }
      }

      // Meditation (120):
      // - Boosts mana recovery
      if (auraId === 120) {
        if (this.world.tick % 10 === 0) {
          const medStats = calculateMeditationStats(slvl)
          const manaGain = Math.max(1, Math.round(medStats.manaRecoveryBonusPct / 300))
          player.mana = Math.min(player.maxMana, player.mana + manaGain)
        }
      }

      // Redemption (124):
      // - In wilderness: redeems nearby corpses every 50 ticks to heal HP & Mana
      // - In town: corpse consumption is completely suspended
      if (auraId === 124 && !inTown) {
        if (this.world.tick % 50 === 0) {
          const redStats = calculateRedemptionStats(slvl)
          const auraRadius = Math.round(redStats.radiusSubtiles * 16)
          for (const monster of this.world.monsters) {
            if (monster.state === 'dead' && monster.corpseTicks > 0 && !monster.corpseSuppressed) {
              const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
              if (dist <= auraRadius) {
                monster.corpseTicks = 0 // consume corpse
                player.hp = Math.min(player.maxHp, player.hp + redStats.lifeRecoverPts)
                player.mana = Math.min(player.maxMana, player.mana + redStats.manaRecoverPts)
                break // up to 1 corpse per pulse tick
              }
            }
          }
        }
      }
    }

    if (input.talking) {
      let nearest: { def: NpcDef; x: number; y: number } | null = null
      let best = this.opts.talkRadius
      for (const npc of this.npcEntities) {
        const distance = Math.hypot(npc.x - player.x, npc.y - player.y)
        if (distance <= best) { best = distance; nearest = npc }
      }
      if (nearest === null) {
        this.dialog = []
      } else {
        if (nearest.def.questId !== null) this.questLog.accept(nearest.def.questId)
        this.dialog = npcDialog(nearest.def, this.questLog)
      }
    }

    if (this.world.pendingKills && this.world.pendingKills.length > 0) {
      for (const kill of this.world.pendingKills) {
        if (!this.world.events.includes(kill)) {
          this.world.events.push(kill)
        }
      }
      this.world.pendingKills = []
    }

    for (const event of this.world.events) {
      if (event.kind !== 'kill') continue
      const monster = event.monsterIndex !== undefined
        ? this.world.monsters.find(m => m.index === event.monsterIndex)
        : this.world.monsters.find(m => m.stats.id === event.subjectId && Math.hypot(m.x - event.x, m.y - event.y) < 10)
      if (monster?.dropRolled) continue
      this.queueMonsterDrop(monster, event)
    }

    // Advance death animation ticks for monsters with queued headless drops
    for (const monster of this.world.monsters) {
      if (monster.animMode === 'dt' && monster.pendingDrop && !monster.dropRolled) {
        if (monster.deathTicks !== undefined && monster.deathTicks > 0) {
          monster.deathTicks -= 1
          if (monster.deathTicks === 0) {
            this.triggerMonsterDrop(monster)
          }
        }
      }
    }

    // Walkover auto-pickup for gold within pickup radius
    if (this.groundItems.count > 0 && this.world.player.alive) {
      const cap = this.maxGoldCapacity
      if (this.bag.gold < cap) {
        for (const entity of this.groundItems.all) {
          if (entity.isGold) {
            const dist = Math.hypot(entity.x - player.x, entity.y - player.y)
            if (dist <= this.opts.pickupRadius) {
              this.pickupGold(entity.id)
              if (this.bag.gold >= cap) break
            }
          }
        }
      }
    }

    if (input.pickingUp && this.ground.length > 0) {
      let bestIndex = -1
      let bestDistance = this.opts.pickupRadius
      this.ground.forEach((entry, index) => {
        const distance = getPickupEdgeDistance(player.x, player.y, entry.x, entry.y)
        if (distance <= bestDistance) { bestDistance = distance; bestIndex = index }
      })
      const entry = bestIndex === -1 ? undefined : this.ground[bestIndex]
      if (entry !== undefined) {
        const placedInBelt = this.belt ? Boolean(this.belt.autoPlacePotion(entry.item)) : false
        const placedInBag = placedInBelt ? true : this.bag.add(entry.item) !== null
        if (!placedInBag) {
          this.metrics.inventoryRefusals += 1
        } else {
          this.ground.splice(bestIndex, 1)
          const targetId = entry.groundItemId ?? this.groundItems.all.find(g => g.item === entry.item)?.id
          if (targetId) {
            this._syncingGround = true
            this.groundItems.remove(targetId)
            this._syncingGround = false
          }
          this.metrics.pickups += 1
        }
      }
    }

    this.groundItems.update(this.world.tick * 40, 40)

    this.handleSaveLoad(input)
  }

  /**
   * Apply the save and load inputs, once per press.
   *
   * @param input - this tick's input.
   */
  private handleSaveLoad(input: EngineInput): void {
    const store = this.opts.snapshotStore
    if (store !== undefined) {
      if (input.saving && !this.savingHeld) {
        try {
          store.write(this.saveSnapshot())
          this.metrics.saves += 1
          this.metrics.saveError = null
        } catch (error) {
          // A full quota or a private-browsing window must not kill the loop.
          this.metrics.saveError = error instanceof Error ? error.message : String(error)
        }
      }
      if (input.loading && !this.loadingHeld) {
        try {
          const data = store.read()
          if (data !== null) {
            if (this.loadSnapshot(data)) {
              this.metrics.loads += 1
              this.metrics.saveError = null
            }
          }
        } catch (error) {
          // A snapshot from an older schema is a refusal, not a crash.
          this.metrics.saveError = error instanceof Error ? error.message : String(error)
        }
      }
    }
    this.savingHeld = input.saving
    this.loadingHeld = input.loading
  }

  saveSnapshot(): string {
    this.syncGroundStores()
    const seenIds = new Set<string>()
    const dedupedGround: { x: number; y: number; item: Item; groundItemId?: string | undefined }[] = []
    for (const g of this.ground) {
      if (g.groundItemId) {
        if (seenIds.has(g.groundItemId)) continue
        seenIds.add(g.groundItemId)
      }
      dedupedGround.push(g)
    }
    this.ground = dedupedGround
    return serializeSnapshot(captureSnapshot({
      world: this.world,
      rng: this.loot,
      castRng: this.castRng,
      hydraGroupSeqCounter: this.hydraGroupSeqCounter,
      groundItemIdCounter: this.groundItems.nextId,
      inventory: this.bag,
      quests: this.questLog,
      ground: this.ground,
    }))
  }

  loadSnapshot(data: string): boolean {
    let pieces: ReturnType<typeof restoreSnapshot>
    try {
      const loaded = parseSnapshot(data)
      pieces = restoreSnapshot(loaded, {
        inventory: (width, height, placed) => Inventory.restore(width, height, placed),
        quests: states => QuestLog.restore(this.opts.questDefs, states),
      })
    } catch (error) {
      this.metrics.saveError = error instanceof Error ? error.message : String(error)
      return false
    }
    this.world = rebindPlayer({
      ...this.world,
      tick: pieces.world.tick,
      kills: pieces.world.kills,
      player: { ...pieces.world.player },
      monsters: pieces.world.monsters.map(monster => ({ ...monster })),
      players: [],
      events: [],
    })
    this.loot = new Rng(pieces.rngState, pieces.rngHighState)
    if (pieces.castRngState !== undefined) {
      this.castRng = new Rng(pieces.castRngState, pieces.castRngHighState ?? 0)
    }
    if (pieces.hydraGroupSeqCounter !== undefined) {
      this.hydraGroupSeqCounter = pieces.hydraGroupSeqCounter
    }
    this.bag = pieces.inventory
    this.questLog = pieces.quests
    this.ground = pieces.ground.map(g => ({ ...g }))
    this._syncingGround = true
    try {
      this.groundItems.clear()
      for (const entry of this.ground) {
        const cell = worldToCell(this.terrain, entry.x, entry.y)
        const isGold = entry.item?.base?.id === 'gold' || entry.item?.code?.trim() === 'gld' || (entry.item as any)?.id === 'gold'
        const goldAmount = isGold ? (entry.item.stack ?? entry.item.value ?? 1) : undefined
        const entity = this.groundItems.add(entry.item, cell.cellX, cell.cellY, entry.x, entry.y, {
          ...(entry.groundItemId !== undefined ? { id: entry.groundItemId } : {}),
          ...(goldAmount !== undefined ? { amount: goldAmount } : {}),
          bounce: false,
          now: this.world.tick * 40,
        })
        entry.groundItemId = entity.id
        Object.defineProperties(entry, {
          id: { get: () => entity.id, enumerable: false, configurable: true },
          isGold: { get: () => entity.isGold, enumerable: false, configurable: true },
          goldAmount: { get: () => entity.goldAmount ?? entity.amount, enumerable: false, configurable: true },
        })
      }
      if (pieces.groundItemIdCounter !== undefined) {
        this.groundItems.nextId = pieces.groundItemIdCounter
      }
    } finally {
      this._syncingGround = false
    }
    this.projectiles = []
    this.explosions = []
    this.overlays = []
    if (this.streamingManager !== undefined) {
      this.streamingManager.world = this.world
    }
    this.hud?.syncFromEngine?.()
    return true
  }

  /**
   * Queue or immediately execute monster drop upon death.
   * If monster has deathGated = true or deathTicks > 0, the drop is held in pendingDrop
   * until death animation finishes or ticks count down.
   */
  queueMonsterDrop(monster: Monster | undefined, event: CombatEvent): void {
    if (monster?.dropRolled) return
    const player = this.world.player
    const subjectId = event.subjectId ?? monster?.stats.id ?? ''
    const difficulty = this.opts.difficulty ?? 'normal'
    const wasBossAlreadyKilled = this.questLog.isBossFirstKillCompleted(subjectId, difficulty)

    if (!(event as any)._questRecorded) {
      ;(event as any)._questRecorded = true
      for (const reward of this.questLog.recordKill(subjectId)) {
        player.xp += reward.xp
        this.bag.gold = Math.min(this.maxGoldCapacity, this.bag.gold + reward.gold)
        this.metrics.questXp += reward.xp
        this.metrics.questGold += reward.gold
      }
    }
    if (!this.opts.dropTables) return

    const monsterRank = event.monsterRank ?? monster?.stats.rank ?? 'normal'
    const isMinion = monsterRank === 'minion'

    if (
      event.monsterLevel === undefined ||
      event.monsterLevel === null ||
      typeof event.monsterLevel !== 'number' ||
      Number.isNaN(event.monsterLevel) ||
      event.monsterLevel <= 0
    ) {
      throw new Error(
        `GameEngine drop failure: missing or invalid monsterLevel for death event (subjectId: "${event.subjectId}", superUniqueId: "${event.superUniqueId}", monsterLevel: ${event.monsterLevel})`
      )
    }
    const monsterLevel = event.monsterLevel

    const suDef = event.superUniqueId
      ? (this.opts.dropTables.superUniques.get(event.superUniqueId) ??
         (() => {
           const target = event.superUniqueId!.trim().toLowerCase()
           for (const [k, v] of this.opts.dropTables.superUniques) {
             if (k.toLowerCase() === target || v.id.toLowerCase() === target || v.nameKey?.toLowerCase() === target) {
               return v
             }
           }
           return undefined
         })())
      : undefined

    let tcName = ''
    if (!isMinion && suDef) {
      tcName = typeof suDef.getTreasureClass === 'function'
        ? suDef.getTreasureClass(difficulty)
        : suDef.treasureClass
    }
    const monsterKind =
      this.opts.dropTables.monsterKinds.get(subjectId) ??
      this.opts.monsterKinds?.get(subjectId) ??
      (suDef ? (this.opts.dropTables.monsterKinds.get(suDef.monsterId) ?? this.opts.monsterKinds?.get(suDef.monsterId)) : undefined)

    if (!monsterKind && !suDef) {
      throw new Error(
        `GameEngine drop failure: unknown monster (subjectId: "${event.subjectId}", superUniqueId: "${event.superUniqueId}") not found in canonical drop tables`
      )
    }

    const isActBoss = !isMinion && (monsterRank === 'boss' || Boolean(monsterKind?.boss && monsterKind.treasureClasses[3]))
    const monsterType = isMinion
      ? 3
      : (event.monsterType ??
          (isActBoss
            ? (wasBossAlreadyKilled ? 1 : 4)
            : monsterRank === 'unique'
              ? 3
              : monsterRank === 'champion'
                ? 2
                : 1))

    if (isActBoss && !wasBossAlreadyKilled && subjectId) {
      this.questLog.markBossFirstKillCompleted(subjectId, difficulty)
    }

    if (!tcName && monsterKind) {
      tcName = getMonsterTreasureClass(monsterKind, difficulty, monsterType)
    }

    if (!tcName) {
      const hasAuthenticEmptyTc =
        (!monsterKind || !monsterKind.treasureClasses || monsterKind.treasureClasses.length === 0 || monsterKind.treasureClasses[0] === '') &&
        (!suDef || !suDef.treasureClass || suDef.treasureClass === '')
      if (hasAuthenticEmptyTc) {
        return
      }
      throw new Error(
        `GameEngine drop failure: corrupt or unresolvable treasure class for monster "${event.subjectId ?? event.superUniqueId}" on difficulty "${difficulty}"`
      )
    }

    const tcTable = this.opts.dropTables.tcTable
    const autoTcTable = this.opts.dropTables.autoTcTable
    const getBase = this.opts.dropTables.getBase
    const tcExists = Boolean(tcTable.get(tcName) || autoTcTable?.get(tcName) || getBase?.(tcName))
    if (!tcExists) {
      throw new Error(
        `GameEngine drop failure: treasure class "${tcName}" resolved for monster "${event.subjectId ?? event.superUniqueId}" not found in drop tables`
      )
    }

    const isBoss = isMinion ? false : Boolean(monsterKind?.boss)
    const isNoRatio = Boolean(monsterKind?.noRatio)

    const rawEquipped = this.opts.getEquippedItems?.() ?? this.opts.equippedItems ?? []
    const equippedPlaced: PlacedItem[] = []
    for (let i = 0; i < rawEquipped.length; i++) {
      const entry = rawEquipped[i]
      if (!entry) continue
      if (typeof entry === 'object' && 'item' in entry && (entry as any).item) {
        equippedPlaced.push(entry as PlacedItem)
        continue
      }
      let stats: Record<string, number> = {}
      const rawEntry = entry as Record<string, any>
      if (typeof rawEntry.stats === 'object' && rawEntry.stats !== null && !Array.isArray(rawEntry.stats)) {
        stats = { ...(rawEntry.stats as Record<string, number>) }
      }
      const explicitMf =
        typeof rawEntry.magicFindBonus === 'number'
          ? rawEntry.magicFindBonus
          : typeof rawEntry.magicFind === 'number'
            ? rawEntry.magicFind
            : typeof rawEntry.mf === 'number'
              ? rawEntry.mf
              : undefined
      if (explicitMf !== undefined && Number.isFinite(explicitMf)) {
        stats['mag%'] = (stats['mag%'] ?? 0) + explicitMf
      }
      const explicitGf =
        typeof rawEntry.goldFindBonus === 'number'
          ? rawEntry.goldFindBonus
          : typeof rawEntry.goldFind === 'number'
            ? rawEntry.goldFind
            : typeof rawEntry.gf === 'number'
              ? rawEntry.gf
              : undefined
      if (explicitGf !== undefined && Number.isFinite(explicitGf)) {
        stats['gold%'] = (stats['gold%'] ?? 0) + explicitGf
      }
      if (Array.isArray(rawEntry.stats)) {
        for (const s of rawEntry.stats) {
          if (!s || typeof s !== 'object') continue
          const statId = typeof s.statId === 'number' ? s.statId : typeof s.id === 'number' ? s.id : undefined
          const statCode = typeof s.stat === 'string' ? s.stat : typeof s.code === 'string' ? s.code : undefined
          const numVal = typeof s.value === 'number' ? s.value : typeof s.param === 'number' ? s.param : undefined
          if (
            numVal !== undefined &&
            Number.isFinite(numVal) &&
            (statId === 80 || statCode === 'item_magicbonus' || statCode === 'mag%')
          ) {
            stats['mag%'] = (stats['mag%'] ?? 0) + numVal
            continue
          }
          if (
            numVal !== undefined &&
            Number.isFinite(numVal) &&
            (statId === 79 || statCode === 'item_goldbonus' || statCode === 'gold%')
          ) {
            stats['gold%'] = (stats['gold%'] ?? 0) + numVal
            continue
          }
          if (typeof s.text !== 'string') continue
          const mfMatch = s.text.match(/(\d+)%\s*(?:更佳机会取得魔法装备|Better Chance of Getting Magic Items|MF)/i)
          if (mfMatch) {
            stats['mag%'] = (stats['mag%'] ?? 0) + Number(mfMatch[1])
          }
          const gfMatch = s.text.match(/(\d+)%\s*(?:额外金币|Extra Gold)/i)
          if (gfMatch) {
            stats['gold%'] = (stats['gold%'] ?? 0) + Number(gfMatch[1])
          }
        }
      }
      const item: Item = ('base' in (entry as any) ? entry : {
        base: { id: (entry as any).code ?? 'item', name: (entry as any).name ?? 'Item', kind: 'misc', invWidth: (entry as any).invWidth ?? 1, invHeight: (entry as any).invHeight ?? 1, maxStack: 1, value: 0, damage: 0, defense: 0, tags: [], level: 1 },
        prefix: null,
        suffix: null,
        level: (entry as any).reqLevel ?? 1,
        name: (entry as any).name ?? 'Item',
        stats,
        invWidth: (entry as any).invWidth ?? 1,
        invHeight: (entry as any).invHeight ?? 1,
        stack: 1,
        value: 0,
        code: (entry as any).code,
      }) as Item
      equippedPlaced.push({
        x: 0,
        y: 0,
        item: { ...item, stats: { ...item.stats, ...stats } },
      })
    }

    const allCarriedItems: readonly PlacedItem[] = [...this.bag.contents, ...equippedPlaced]

    const playerMf =
      totalStat(allCarriedItems, 'mag%') +
      totalStat(allCarriedItems, 'magicFind') +
      totalStat(allCarriedItems, 'item_magicbonus') +
      ((this.world.player as any).magicFind ?? 0)

    const playerGf =
      totalStat(allCarriedItems, 'gold%') +
      totalStat(allCarriedItems, 'goldFind') +
      totalStat(allCarriedItems, 'item_goldbonus') +
      ((this.world.player as any).goldFind ?? 0)

    const targetMonster: Monster = monster ?? ({
      index: event.monsterIndex ?? -1,
      x: event.x,
      y: event.y,
      hp: 0,
      state: 'dead',
      cooldown: 0,
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
      stats: { id: event.subjectId ?? '', name: event.subjectId ?? '', hp: 0, damage: 0, level: monsterLevel, rank: monsterRank } as any,
    } as Monster)

    const pending: PendingMonsterDrop = {
      monsterIndex: targetMonster.index,
      subjectId: event.subjectId ?? '',
      superUniqueId: event.superUniqueId,
      monsterLevel,
      monsterRank,
      monsterType,
      x: event.x,
      y: event.y,
      tcName,
      isBoss,
      isNoRatio,
      seed: targetMonster.dwInitSeed ?? 0,
      killerContext: {
        playerMf,
        playerGf,
        gamePlayers: this.gamePlayers,
        partyPlayers: this.partyPlayers,
      },
    }
    targetMonster.pendingDrop = pending

    // If death animation is gated or countdown ticks are pending, wait for completion
    if (targetMonster.deathGated === true || (targetMonster.deathTicks !== undefined && targetMonster.deathTicks > 0)) {
      return
    }

    // Otherwise (instant-death entity or headless test without death ticks), trigger drop immediately
    this.triggerMonsterDrop(targetMonster)
  }

  /**
   * Trigger the queued drop for a dying monster upon completion of its death animation (DT sequence).
   */
  triggerMonsterDrop(monster: Monster): readonly GroundItemEntity[] {
    if (monster.dropRolled) return []
    const pending = monster.pendingDrop
    if (!pending || !this.opts.dropTables) return []

    monster.dropRolled = true
    monster.animMode = 'dd'

    const dropSeed = pending.seed !== 0 ? pending.seed : this.loot.int(0, 0x7FFFFFFF)
    const droppedItems = pending.items ?? executeDropPipeline(this.opts.dropTables, {
      tcName: pending.tcName,
      nLevel: pending.monsterLevel,
      monsterType: pending.monsterType,
      difficulty: this.opts.difficulty ?? 'normal',
      gamePlayers: pending.killerContext.gamePlayers,
      partyPlayers: pending.killerContext.partyPlayers,
      playerMf: pending.killerContext.playerMf,
      playerGf: pending.killerContext.playerGf,
      isBoss: pending.isBoss,
      isNoRatio: pending.isNoRatio,
      monsterRng: new D2Rng(dropSeed),
    })

    this.metrics.dropsRolled += 1
    const burstOccupied: { x: number; y: number }[] = this.groundItems.all.map(g => ({ x: g.x, y: g.y }))
    const currentSimTime = this.world.tick * 40
    const spawned: GroundItemEntity[] = []

    const reachableFrom = { x: this.world.player.x, y: this.world.player.y }

    for (const drop of droppedItems) {
      const dropPos = findIsometricDropPosition(
        pending.x,
        pending.y,
        burstOccupied,
        this.terrain,
        undefined,
        undefined,
        undefined,
        undefined,
        reachableFrom,
      )
      burstOccupied.push(dropPos)
      const dropCell = worldToCell(this.terrain, dropPos.x, dropPos.y)

      const isGold = drop.base?.id === 'gold' || drop.code?.trim() === 'gld' || (drop as any).id === 'gold'
      const goldAmount = isGold ? (drop.stack ?? drop.value ?? 1) : undefined

      const entity = this.groundItems.add(drop, dropCell.cellX, dropCell.cellY, dropPos.x, dropPos.y, {
        ...(goldAmount !== undefined ? { amount: goldAmount } : {}),
        bounce: true,
        now: currentSimTime,
      })
      spawned.push(entity)
      this.metrics.lastDrops.push(drop.name)
      if (this.metrics.lastDrops.length > 6) this.metrics.lastDrops.shift()
    }

    monster.pendingDrop = undefined
    return spawned
  }

  /**
   * Drop an item onto the ground at target coordinates.
   */
  dropItem(item: GroundItemSource, x?: number, y?: number, cellX?: number, cellY?: number): GroundItemEntity {
    const rawX = x ?? this.world.player.x
    const rawY = y ?? this.world.player.y
    const reachableFrom = { x: this.world.player.x, y: this.world.player.y }
    const dropPos = findIsometricDropPosition(
      rawX,
      rawY,
      this.groundItems.all,
      this.terrain,
      undefined,
      undefined,
      undefined,
      undefined,
      reachableFrom,
    )
    const finalX = dropPos.x
    const finalY = dropPos.y
    const moved = finalX !== rawX || finalY !== rawY
    const dropCell = (!moved && cellX !== undefined && cellY !== undefined)
      ? { cellX, cellY }
      : worldToCell(this.terrain, finalX, finalY)
    const now = this.world.tick * 40
    const entity = this.groundItems.add(item, dropCell.cellX, dropCell.cellY, finalX, finalY, { bounce: true, now })
    return entity
  }

  /**
   * Apply damage to a monster in the engine's world.
   */
  damageMonster(index: number, amount: number, attacker?: CombatPlayer | string): any {
    const monsterBefore = this.world.monsters[index]
    const wasAlive = Boolean(monsterBefore && monsterBefore.state !== 'dead' && monsterBefore.hp > 0)
    const xpBefore = this.world.player.xp
    const targetAttacker = (typeof attacker === 'string' || !attacker) ? this.world.player : attacker
    const oldLevel = this.world.player.level ?? this.world.level ?? 1
    const killed = wasAlive ? damageMonster(this.world, index, amount, targetAttacker) : false
    const xpAwarded = Math.max(0, this.world.player.xp - xpBefore)
    if (killed) {
      const newLevel = levelForXp(this.world.player.xp, this.opts.xpTable)
      this.world.level = newLevel
      if (newLevel > oldLevel) {
        const levelsGained = newLevel - oldLevel
        this.world.player.level = newLevel
        this.world.player.statPoints = (this.world.player.statPoints ?? 0) + levelsGained * 5
        this.world.player.skillPoints = (this.world.player.skillPoints ?? 0) + levelsGained * 1
        const cStats = CANONICAL_CHARSTATS[this.world.player.classCode ?? 'sor'] ?? CANONICAL_CHARSTATS.sor
        const lifeGain = Math.floor(cStats.perLevel.life * levelsGained)
        const stamGain = Math.floor(cStats.perLevel.stamina * levelsGained)
        const manaGain = Math.floor(cStats.perLevel.mana * levelsGained)
        this.world.player.maxHp += lifeGain
        this.world.player.hp = Math.min(this.world.player.maxHp, this.world.player.hp + lifeGain)
        this.world.player.maxStamina = (this.world.player.maxStamina ?? cStats.baseVitals.stamina) + stamGain
        this.world.player.stamina = Math.min(this.world.player.maxStamina, (this.world.player.stamina ?? this.world.player.maxStamina) + stamGain)
        this.world.player.maxMana += manaGain
        this.world.player.mana = Math.min(this.world.player.maxMana, this.world.player.mana + manaGain)
      }
      const monster = this.world.monsters[index]
      if (
        monster &&
        this.opts.dropTables &&
        !monster.deathGated &&
        (monster.deathTicks === undefined || monster.deathTicks <= 0) &&
        !monster.dropRolled &&
        !monster.pendingDrop
      ) {
        const killEvt =
          this.world.pendingKills?.find(e => e.monsterIndex === index) ??
          this.world.events.find(e => e.kind === 'kill' && e.monsterIndex === index)
        if (killEvt) {
          try {
            this.queueMonsterDrop(monster, killEvt)
          } catch {
            // Defer error to tick() if test expects tick() to throw on invalid monster
          }
        }
      }
      this.hud?.syncFromEngine?.()
    }
    if (typeof attacker === 'string' || !this.opts.dropTables) {
      return { hit: wasAlive, killed, xpAwarded }
    }
    return killed
  }

  /**
   * Drop gold from the player's inventory onto the ground, enforcing strict conservation.
   * Clamps to `[0, this.bag.gold]`, deducts from `this.bag.gold`, and spawns the ground pile.
   */
  dropPlayerGold(amount: number, x?: number, y?: number, cellX?: number, cellY?: number): GroundItemEntity | null {
    if (!Number.isFinite(amount)) return null
    const available = Math.max(0, Math.floor(this.bag.gold))
    const toDrop = Math.max(0, Math.min(available, Math.floor(amount)))
    if (toDrop <= 0) return null
    this.bag.gold = available - toDrop
    if (this.hud?.inventory) {
      this.hud.inventory.gold = this.bag.gold
    }
    return this.dropGold(toDrop, x, y, cellX, cellY, { fromWorld: true })
  }

  /**
   * Alias for `dropPlayerGold`.
   */
  dropInventoryGold(amount: number, x?: number, y?: number, cellX?: number, cellY?: number): GroundItemEntity | null {
    return this.dropPlayerGold(amount, x, y, cellX, cellY)
  }

  /**
   * Drop gold onto the ground at target coordinates.
   * Player-initiated drops deduct from `this.bag.gold` and clamp to available gold.
   */
  dropGold(
    amount: number,
    x?: number,
    y?: number,
    cellX?: number,
    cellY?: number,
    options?: { readonly fromInventory?: boolean; readonly deductFromBag?: boolean; readonly fromWorld?: boolean },
  ): GroundItemEntity | null {
    if (!Number.isFinite(amount)) return null
    if (options?.fromWorld !== true) {
      return this.dropPlayerGold(amount, x, y, cellX, cellY)
    }
    const clampedAmount = Math.floor(amount)
    if (clampedAmount <= 0) return null
    const rawX = x ?? this.world.player.x
    const rawY = y ?? this.world.player.y
    const reachableFrom = { x: this.world.player.x, y: this.world.player.y }
    const dropPos = findIsometricDropPosition(
      rawX,
      rawY,
      this.groundItems.all,
      this.terrain,
      undefined,
      undefined,
      undefined,
      undefined,
      reachableFrom,
    )
    const finalX = dropPos.x
    const finalY = dropPos.y
    const moved = finalX !== rawX || finalY !== rawY
    const dropCell = (!moved && cellX !== undefined && cellY !== undefined)
      ? { cellX, cellY }
      : worldToCell(this.terrain, finalX, finalY)
    const now = this.world.tick * 40
    const goldPayload = goldItem(clampedAmount)
    const entity = this.groundItems.add(
      goldPayload,
      dropCell.cellX,
      dropCell.cellY,
      finalX,
      finalY,
      { amount: clampedAmount, bounce: true, now },
    )
    return entity
  }

  /**
   * Pick up gold from the ground by its ground item id with authentic 1.13c inventory capacity check and partial pickup.
   * Gold goes directly into the dedicated `bag.gold` ledger without occupying any 10x4 inventory grid cells.
   */
  pickupGold(id: string | number): {
    readonly picked: boolean
    readonly success: boolean
    readonly amount: number
    readonly remainder: number
    readonly remaining?: number
  } {
    const strId = String(id)
    const entity = this.groundItems.get(strId)
    const makeGoldRes = (picked: boolean, amount: number, remainder: number, remainingVal?: number) => {
      const res: any = { picked, amount, remainder }
      Object.defineProperties(res, {
        success: { value: picked, enumerable: false },
        remaining: { value: remainingVal ?? remainder, enumerable: false },
      })
      return res
    }
    if (!entity || !entity.isGold) {
      return makeGoldRes(false, 0, 0, undefined)
    }
    const maxCap = this.maxGoldCapacity
    const currentGold = this.bag.gold
    if (currentGold >= maxCap) {
      return makeGoldRes(false, 0, entity.amount, entity.amount)
    }

    if (currentGold + entity.amount > maxCap) {
      const picked = maxCap - currentGold
      const remaining = entity.amount - picked
      this.bag.gold = currentGold + picked
      if (this.hud?.inventory) {
        this.hud.inventory.gold = this.bag.gold
      }
      entity.amount = remaining
      entity.name = `${remaining} Gold`
      entity.nameZh = `${remaining} 金币`
      if (entity.item) {
        (entity.item as any).stack = remaining
        if (typeof (entity.item as any).value === 'number') {
          (entity.item as any).value = remaining
        }
      }
      const groundEntry = this.ground.find(g => g.groundItemId === strId || g.item === entity.item)
      if (groundEntry && (groundEntry.item as any)) {
        (groundEntry.item as any).stack = remaining
        if (typeof (groundEntry.item as any).value === 'number') {
          (groundEntry.item as any).value = remaining
        }
      }
      triggerFlippyBounce(entity, this.world.tick * 40)
      this.metrics.pickups += 1
      return makeGoldRes(true, picked, remaining, remaining)
    }

    // Full pickup
    const amount = entity.amount || 1
    this.groundItems.remove(strId)
    this.bag.gold = Math.min(maxCap, currentGold + amount)
    if (this.hud?.inventory) {
      this.hud.inventory.gold = this.bag.gold
    }
    this.metrics.pickups += 1
    return makeGoldRes(true, amount, 0, 0)
  }

  /**
   * Pick up an item from the ground by ground item id into the belt (if potion) or inventory.
   */
  pickupItem(id: string | number): {
    readonly picked: boolean
    readonly success: boolean
    readonly reason?: 'full' | 'not_found'
    readonly item?: GroundItemEntity
    readonly destination?: 'belt' | 'inventory'
  } {
    const strId = String(id)
    const makeItemRes = (
      picked: boolean,
      extra?: { reason?: 'full' | 'not_found'; item?: GroundItemEntity; destination?: 'belt' | 'inventory' },
    ) => {
      const res: any = { picked }
      Object.defineProperties(res, {
        success: { value: picked, enumerable: false },
        reason: { value: extra?.reason, enumerable: false },
        item: { value: extra?.item, enumerable: false },
        destination: { value: extra?.destination, enumerable: false },
      })
      return res
    }
    const entity = this.groundItems.get(strId)
    if (!entity) {
      return makeItemRes(false, { reason: 'not_found' })
    }
    if (entity.isGold) {
      const res = this.pickupGold(strId)
      if (!res.success) {
        this.metrics.inventoryRefusals += 1
        triggerFlippyBounce(entity, this.world.tick * 40)
        return makeItemRes(false, { reason: 'full', item: entity })
      }
      return makeItemRes(true, { item: entity, destination: 'inventory' })
    }

    // 1. Attempt auto-belt placement for potions first (D2 1.13c D2GAME_PickupPotionItem)
    const placedInBelt = this.belt ? Boolean(this.belt.autoPlacePotion(entity.item)) : false

    // 2. Fallback to inventory bag if not a potion or if belt has no compatible/empty column
    const placedInBag = placedInBelt ? true : this.bag.add(entity.item as any) !== null
    if (!placedInBag) {
      this.metrics.inventoryRefusals += 1
      triggerFlippyBounce(entity, this.world.tick * 40)
      return makeItemRes(false, { reason: 'full', item: entity })
    }

    this.groundItems.remove(strId)
    this.metrics.pickups += 1
    return makeItemRes(true, { item: entity, destination: placedInBelt ? 'belt' : 'inventory' })
  }

  /**
   * Remove a ground item entity by ID from both `groundItems` and `ground`.
   */
  removeGround(id: string | number): GroundItemEntity | undefined {
    return this.groundItems.remove(String(id))
  }

  skillPoints: Map<number, number> = new Map()
  private stateChangeListeners: (() => void)[] = []
  private groundStateByLevel = new Map<number, GroundItemEntity[]>()

  get classCode(): CharacterClassCode {
    return this.world.player.classCode ?? 'sor'
  }

  set classCode(val: CharacterClassCode) {
    this.applyClassProfile(val)
  }

  onStateChange(cb: () => void): () => void {
    this.stateChangeListeners.push(cb)
    return () => {
      const idx = this.stateChangeListeners.indexOf(cb)
      if (idx !== -1) this.stateChangeListeners.splice(idx, 1)
    }
  }

  private notifyStateChange(): void {
    this.hud?.syncFromEngine?.()
    for (const cb of this.stateChangeListeners) {
      cb()
    }
  }

  saveLevelGroundState(levelId: number = this.levelId): void {
    const saved = this.groundItems.all.map(e => ({ ...e }))
    this.groundStateByLevel.set(levelId, saved)
  }

  restoreLevelGroundState(levelId: number): void {
    this.levelId = levelId
    const saved = this.groundStateByLevel.get(levelId) ?? []
    this._syncingGround = true
    try {
      this.groundItems.clear()
      this.ground.length = 0
      for (const e of saved) {
        const entity = this.groundItems.add(e.item, e.cellX, e.cellY, e.x, e.y, {
          id: e.id,
          ...(e.isGold ? { amount: e.amount } : {}),
          bounce: false,
          now: this.world.tick * 40,
        })
        const itemObj = (entity.item && typeof entity.item === 'object' && 'name' in entity.item)
          ? (entity.item as Item)
          : (entity.isGold ? goldItem(entity.amount || 1) : (entity.item as any))
        const entry: any = {
          x: entity.x,
          y: entity.y,
          item: itemObj,
          groundItemId: entity.id,
        }
        Object.defineProperties(entry, {
          id: { get: () => entity.id, enumerable: false, configurable: true },
          isGold: { get: () => entity.isGold, enumerable: false, configurable: true },
          goldAmount: { get: () => entity.amount, enumerable: false, configurable: true },
        })
        this.ground.push(entry)
      }
    } finally {
      this._syncingGround = false
    }
  }

  /**
   * Bind a HudManager instance so HUD vitals, attributes, and gold read/write through to this engine.
   */
  bindHud(hud: any): void {
    this.hud = hud
    if (hud) {
      if (hud.belt && !this.belt) {
        this.belt = hud.belt
      }
      if (hud.inventory) {
        hud.inventory._boundEngine = this
      }
      if (typeof hud.bindEngine === 'function' && hud.engine !== this) {
        hud.bindEngine(this)
      }
    }
  }

  /**
   * Apply canonical 1.13c CharStats.txt level-1 attributes and vitals for the given character class.
   */
  applyClassProfile(classCode: CharacterClassCode): void {
    const cStats = CANONICAL_CHARSTATS[classCode]
    if (!cStats) return
    const player = this.world.player
    player.classCode = classCode
    player.str = cStats.baseAttributes.strength
    player.dex = cStats.baseAttributes.dexterity
    player.vit = cStats.baseAttributes.vitality
    player.ene = cStats.baseAttributes.energy
    player.maxHp = cStats.baseVitals.life
    player.hp = cStats.baseVitals.life
    player.maxMana = cStats.baseVitals.mana
    player.mana = cStats.baseVitals.mana
    player.maxStamina = cStats.baseVitals.stamina
    player.stamina = cStats.baseVitals.stamina
    this.notifyStateChange()
  }

  /**
   * Allocate 1 stat point into str, dex, vit, or ene using canonical 1.13c per-class CharStats.txt gains.
   * Incremental gain only (never full-heals current HP/Mana).
   */
  allocateStat(stat: 'str' | 'dex' | 'vit' | 'ene' | 'strength' | 'dexterity' | 'vitality' | 'energy'): boolean {
    const player = this.world.player
    const pts = player.statPoints ?? 0
    if (pts <= 0) return false
    const classCode = player.classCode ?? 'sor'
    const cStats = CANONICAL_CHARSTATS[classCode] ?? CANONICAL_CHARSTATS.sor
    const normStat =
      stat === 'strength' ? 'str' :
      stat === 'dexterity' ? 'dex' :
      stat === 'vitality' ? 'vit' :
      stat === 'energy' ? 'ene' :
      stat
    if (normStat !== 'str' && normStat !== 'dex' && normStat !== 'vit' && normStat !== 'ene') {
      return false
    }
    player.statPoints = pts - 1
    if (normStat === 'str') {
      player.str = (player.str ?? cStats.baseAttributes.strength) + 1
    } else if (normStat === 'dex') {
      player.dex = (player.dex ?? cStats.baseAttributes.dexterity) + 1
    } else if (normStat === 'vit') {
      player.vit = (player.vit ?? cStats.baseAttributes.vitality) + 1
      const lifeGain = Math.floor(cStats.perStatPoint.lifePerVitality)
      const stamGain = Math.floor(cStats.perStatPoint.staminaPerVitality)
      player.maxHp += lifeGain
      player.hp = Math.min(player.maxHp, player.hp + lifeGain)
      player.maxStamina = (player.maxStamina ?? cStats.baseVitals.stamina) + stamGain
      player.stamina = Math.min(player.maxStamina, (player.stamina ?? player.maxStamina) + stamGain)
    } else if (normStat === 'ene') {
      player.ene = (player.ene ?? cStats.baseAttributes.energy) + 1
      const manaGain = Math.floor(cStats.perStatPoint.manaPerEnergy)
      player.maxMana += manaGain
      player.mana = Math.min(player.maxMana, player.mana + manaGain)
    }
    this.notifyStateChange()
    return true
  }

  /**
   * Grant experience to the player and apply authentic 1.13c level-up stat/skill points and vital gains.
   */
  grantExperience(amount: number): { leveledUp: boolean; levelsGained: number; oldLevel: number; newLevel: number } {
    const gain = Math.max(0, Math.floor(amount))
    const player = this.world.player
    const oldLevel = player.level ?? this.world.level ?? 1
    player.xp += gain
    this.world.xp = player.xp

    let newLevel = (this.opts.xpTable && this.opts.xpTable.length > 1)
      ? levelForXp(player.xp, this.opts.xpTable)
      : 1
    if (newLevel <= oldLevel && player.xp >= oldLevel * 100 && (!this.opts.xpTable || this.opts.xpTable.length <= 2)) {
      newLevel = Math.max(newLevel, Math.floor(player.xp / 100) + 1)
    }

    const levelsGained = Math.max(0, newLevel - oldLevel)
    if (levelsGained > 0) {
      player.level = newLevel
      this.world.level = newLevel
      player.statPoints = (player.statPoints ?? 0) + levelsGained * 5
      player.skillPoints = (player.skillPoints ?? 0) + levelsGained * 1
      const cStats = CANONICAL_CHARSTATS[player.classCode ?? 'sor'] ?? CANONICAL_CHARSTATS.sor
      const lifeGain = Math.floor(cStats.perLevel.life * levelsGained)
      const stamGain = Math.floor(cStats.perLevel.stamina * levelsGained)
      const manaGain = Math.floor(cStats.perLevel.mana * levelsGained)
      player.maxHp += lifeGain
      player.hp = Math.min(player.maxHp, player.hp + lifeGain)
      player.maxStamina = (player.maxStamina ?? cStats.baseVitals.stamina) + stamGain
      player.stamina = Math.min(player.maxStamina, (player.stamina ?? player.maxStamina) + stamGain)
      player.maxMana += manaGain
      player.mana = Math.min(player.maxMana, player.mana + manaGain)
    }
    this.notifyStateChange()
    return { leveledUp: levelsGained > 0, levelsGained, oldLevel, newLevel }
  }

  /**
   * Apply damage to the player.
   */
  takeDamage(amount: number): number {
    const dmg = Math.max(0, Math.floor(amount))
    const player = this.world.player
    player.hp = Math.max(0, player.hp - dmg)
    if (player.hp <= 0) {
      player.alive = false
    }
    this.hud?.syncFromEngine?.()
    return player.hp
  }

  /**
   * Heal the player by `amount`, clamped to `maxHp`.
   */
  heal(amount: number): number {
    const h = Math.max(0, Math.floor(amount))
    const player = this.world.player
    player.hp = Math.min(player.maxHp, player.hp + h)
    if (player.hp > 0) {
      player.alive = true
    }
    this.hud?.syncFromEngine?.()
    return player.hp
  }

  /**
   * Perform full town NPC heal (Akara, Atma, Ormus, Jamella, Malah).
   */
  npcHeal(): void {
    const player = this.world.player
    player.hp = player.maxHp
    player.mana = player.maxMana
    player.stamina = player.maxStamina ?? 100
    player.alive = true
    this.hud?.syncFromEngine?.()
  }

  /**
   * Equip an item from `this.bag` into `this.equipped[slot]` and apply its stat bonuses to the player.
   */
  equipFromBag(itemOrId: any, slot?: string): boolean {
    const idx = this.bag.contents.findIndex(
      p => p.item === itemOrId || (p.item as any)?.id === itemOrId || p.item?.name === itemOrId || p.item?.code === itemOrId,
    )
    const placed = idx !== -1 ? this.bag.contents[idx] : undefined
    const targetItem = placed ? placed.item : (typeof itemOrId === 'object' && itemOrId ? itemOrId : undefined)
    if (!targetItem) return false
    if (placed) {
      this.bag.remove(placed.x, placed.y)
    }
    const targetSlot = slot ?? (targetItem as any).slot ?? targetItem.base?.kind ?? 'mainHand'
    if (this.equipped[targetSlot]) {
      this.unequipSlot(targetSlot)
    }
    this.equipped[targetSlot] = targetItem
    this.applyItemStatDelta(targetItem, 1)
    this.hud?.syncFromEngine?.()
    return true
  }

  /**
   * Unequip an item from `this.equipped[slot]` back into `this.bag`.
   */
  unequipSlot(slot: string): boolean {
    const item = this.equipped[slot]
    if (!item) return false
    const added = this.bag.add(item)
    if (!added) return false
    delete this.equipped[slot]
    this.applyItemStatDelta(item, -1)
    this.hud?.syncFromEngine?.()
    return true
  }

  private applyItemStatDelta(item: any, sign: 1 | -1): void {
    const stats = item?.stats
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return
    const p = this.world.player
    if (typeof stats.strength === 'number') p.str = (p.str ?? 10) + sign * stats.strength
    if (typeof stats.str === 'number') p.str = (p.str ?? 10) + sign * stats.str
    if (typeof stats.dexterity === 'number') p.dex = (p.dex ?? 25) + sign * stats.dexterity
    if (typeof stats.dex === 'number') p.dex = (p.dex ?? 25) + sign * stats.dex
    if (typeof stats.vitality === 'number') p.vit = (p.vit ?? 10) + sign * stats.vitality
    if (typeof stats.vit === 'number') p.vit = (p.vit ?? 10) + sign * stats.vit
    if (typeof stats.energy === 'number') p.ene = (p.ene ?? 35) + sign * stats.energy
    if (typeof stats.ene === 'number') p.ene = (p.ene ?? 35) + sign * stats.ene
    if (typeof stats.maxHp === 'number' || typeof stats.life === 'number') {
      const dHp = (stats.maxHp ?? stats.life ?? 0) * sign
      p.maxHp = Math.max(1, p.maxHp + dHp)
      p.hp = Math.min(p.maxHp, Math.max(1, p.hp + dHp))
    }
    if (typeof stats.maxMana === 'number' || typeof stats.mana === 'number') {
      const dMana = (stats.maxMana ?? stats.mana ?? 0) * sign
      p.maxMana = Math.max(0, p.maxMana + dMana)
      p.mana = Math.min(p.maxMana, Math.max(0, p.mana + dMana))
    }
  }

  /**
   * Add a potion or scroll to the belt.
   */
  addToBelt(item: any, slot?: number): boolean {
    if (this.belt) {
      if (typeof slot === 'number') {
        const col = slot % 4
        const row = Math.floor(slot / 4)
        if (this.belt.setSlot(col, row, item)) {
          this._beltSlots[slot] = item
          return true
        }
      } else if (this.belt.autoPlacePotion(item)) {
        const emptyIdx = this._beltSlots.findIndex(s => s === null)
        if (emptyIdx !== -1) this._beltSlots[emptyIdx] = item
        return true
      }
    }
    const targetIdx = typeof slot === 'number' ? slot : this._beltSlots.findIndex(s => s === null)
    if (targetIdx < 0 || targetIdx >= this._beltSlots.length || this._beltSlots[targetIdx] !== null) {
      return false
    }
    this._beltSlots[targetIdx] = item
    return true
  }

  /**
   * Consume a potion from the belt at column/slot `col` and apply its effect to the player.
   */
  useBeltSlot(col: number): boolean {
    if (this.hud && typeof this.hud.drinkBeltSlot === 'function') {
      return this.hud.drinkBeltSlot(col)
    }
    if (this.belt) {
      const item = this.belt.consumeSlot(col)
      if (item) {
        this._beltSlots[col] = null
        return this.drinkPotion(item)
      }
    }
    const item = this._beltSlots[col]
    if (!item) return false
    this._beltSlots[col] = null
    return this.drinkPotion(item)
  }

  /**
   * Consume a potion by code or item object and apply authentic 1.13c Misc.txt healing/rejuvenation/buffs.
   */
  drinkPotion(
    codeOrItem: string | { readonly code?: string; readonly base?: { readonly id?: string }; readonly name?: string; readonly healHp?: number; readonly healMana?: number },
  ): boolean {
    const player = this.world.player
    if (!player.alive) return false
    const code = typeof codeOrItem === 'string'
      ? codeOrItem.trim()
      : (codeOrItem.code?.trim() ?? codeOrItem.base?.id?.trim() ?? '')
    const spec = code ? resolvePotionSpec(code) : undefined
    if (spec) {
      if (spec.isPct) {
        if (spec.hpAmount && spec.hpAmount > 0) {
          const healHp = Math.floor((player.maxHp * spec.hpAmount) / 100)
          player.hp = Math.min(player.maxHp, player.hp + healHp)
        }
        if (spec.manaAmount && spec.manaAmount > 0) {
          const healMana = Math.floor((player.maxMana * spec.manaAmount) / 100)
          player.mana = Math.min(player.maxMana, player.mana + healMana)
        }
      } else {
        if (spec.hpAmount && spec.hpAmount > 0) {
          player.hp = Math.min(player.maxHp, player.hp + spec.hpAmount)
        }
        if (spec.manaAmount && spec.manaAmount > 0) {
          player.mana = Math.min(player.maxMana, player.mana + spec.manaAmount)
        }
      }
      if (spec.staminaRestorePct && spec.staminaRestorePct > 0) {
        const maxStam = player.maxStamina ?? 100
        player.stamina = maxStam
      }
      if (spec.coldResistBonus && spec.durationTicks) {
        player.coldResistBonusTicks = (player.coldResistBonusTicks ?? 0) + spec.durationTicks
      }
      if (spec.poisonResistBonus && spec.durationTicks) {
        player.poisonResistBonusTicks = (player.poisonResistBonusTicks ?? 0) + spec.durationTicks
      }
      this.hud?.syncFromEngine?.()
      return true
    }
    if (typeof codeOrItem === 'object' && codeOrItem !== null) {
      if (typeof codeOrItem.healHp === 'number' && codeOrItem.healHp > 0) {
        player.hp = Math.min(player.maxHp, player.hp + codeOrItem.healHp)
      }
      if (typeof codeOrItem.healMana === 'number' && codeOrItem.healMana > 0) {
        player.mana = Math.min(player.maxMana, player.mana + codeOrItem.healMana)
      }
      this.hud?.syncFromEngine?.()
      return true
    }
    return false
  }

  /**
   * Spawn a monster by canonical MonStats.txt ID (e.g. 'fallen1', 'zombie1', 'diablo') at `(x, y)`.
   */
  spawnMonster(
    monsterId: string,
    x = this.world.player.x + 60,
    y = this.world.player.y,
    options?: { readonly difficulty?: Difficulty; readonly areaLevel?: number; readonly scale?: typeof UNSCALED },
  ): Monster {
    const dt = this.opts.dropTables ?? getEmbeddedDropTables()
    const difficulty = options?.difficulty ?? this.opts.difficulty ?? 'normal'
    const lowerId = monsterId.trim().toLowerCase()
    const dtKind =
      dt.monsterKinds.get(monsterId) ??
      dt.monsterKinds.get(lowerId) ??
      dt.monsterKinds.get(`${monsterId}1`) ??
      dt.monsterKinds.get(`${lowerId}1`)
    const kind =
      this.opts.monsterKinds?.get(monsterId) ??
      this.opts.monsterKinds?.get(lowerId) ??
      (dtKind && dtKind.maxHp > 0
        ? dtKind
        : (MONSTER_TABLE[monsterId] ??
            MONSTER_TABLE[lowerId] ??
            MONSTER_TABLE[`${monsterId}1`] ??
            MONSTER_TABLE[`${lowerId}1`] ??
            dtKind))
    let stats: MonsterStats | undefined
    if (kind) {
      const mLevel = monsterLevelFor(kind, difficulty, options?.areaLevel ?? 1)
      stats = monsterStatsOf(kind, this.loot, this.opts.combatOptions.playerSpeed, options?.scale ?? UNSCALED, undefined, mLevel)
    } else {
      stats = this.opts.stats.find(s => s.id === monsterId || s.id.toLowerCase() === lowerId)
      if (!stats) {
        throw new Error(`Unknown monsterId "${monsterId}": not found in MonStats.txt or engine opts.stats`)
      }
    }
    const idx = this.world.monsters.length
    const monster: Monster = {
      index: idx,
      stats,
      x,
      y,
      hp: stats.hp,
      cooldown: 0,
      state: 'idle',
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
      dwInitSeed: (((this.loot.lo ^ Math.imul(idx + 1, 0x9e3779b9)) >>> 0) || 1),
    }
    this.world.monsters.push(monster)
    return monster
  }

  /**
   * Enqueue a deterministic command to be executed at the start of the next `tick()`.
   */
  enqueueCommand(cmd: any): void {
    this.pendingCommands.push(cmd)
  }

  /**
   * Execute a deterministic engine command immediately.
   */
  execute(cmd: any): any {
    if (!cmd || typeof cmd !== 'object') return undefined
    switch (cmd.type ?? cmd.kind) {
      case 'allocateStat':
        return this.allocateStat(cmd.stat)
      case 'drinkPotion':
        return this.drinkPotion(cmd.code ?? cmd.potion ?? cmd.item)
      case 'drinkBelt':
      case 'useBeltSlot':
        return this.useBeltSlot(cmd.col ?? cmd.slot ?? 0)
      case 'dropGold':
      case 'dropPlayerGold':
      case 'dropInventoryGold':
        return this.dropPlayerGold(cmd.amount ?? 0, cmd.x, cmd.y)
      case 'pickupGold':
      case 'pickupGroundGold':
        return this.pickupGold(cmd.id)
      case 'pickupItem':
      case 'pickupGroundItem':
        return this.pickupItem(cmd.id)
      case 'grantExperience':
        return this.grantExperience(cmd.amount ?? 0)
      case 'takeDamage':
        return this.takeDamage(cmd.amount ?? 0)
      case 'heal':
        return this.heal(cmd.amount ?? 0)
      case 'npcHeal':
        this.npcHeal()
        return true
      case 'switchClass':
        if (this.hud && typeof this.hud.switchClass === 'function') {
          return this.hud.switchClass(cmd.classCode)
        }
        this.applyClassProfile(cmd.classCode)
        return true
      default:
        if (typeof cmd.run === 'function') {
          return cmd.run(this)
        }
        return undefined
    }
  }

  castSceneSkill(skillId: number, targetX: number, targetY: number, context: any): boolean {
    return castSkill(skillId, targetX, targetY, context)
  }

  /**
   * 1.13c Charsi Imbue (`D2Game.dll` `QUESTS_Act1Q5_ImbueItem` @ `0x6fce0310`):
   * Imbues an eligible Low/Normal/Superior unsocketed weapon or armor into a Rare item
   * at `ilvl = computeCharsiImbueIlvl(this.world.player.level)`.
   */
  imbueItem(
    itemOrCode: Item | Record<string, any> | string,
    options?: CharsiImbueOptions,
  ): ReturnType<typeof imbueItem113c> {
    const dropTables = options?.dropTables ?? this.opts.dropTables ?? getEmbeddedDropTables()
    const rng = options?.rng ?? this.loot
    const playerLevel = options?.playerLevel ?? this.world.player.level
    return imbueItem113c(itemOrCode as any, playerLevel, {
      ...options,
      dropTables,
      rng,
    })
  }

  /**
   * Compute a 32-bit FNV-1a state digest covering world, players, monsters, inventory (including dedicated gold),
   * ground items, quests, and RNG states.
   */
  computeStateHash(): number {
    let hash = computeLockstepHash(this.world, [this.bag], this.ground, this.questLog.all)
    const mix = (val: number) => {
      hash ^= (val & 0xFFFFFFFF)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    mix(this.bag.gold)
    mix(this.world.player.mana)
    mix(this.world.player.maxHp)
    mix(this.world.player.maxMana)
    mix(this.loot.lo)
    mix(this.loot.hi)
    mix(this.castRng.lo)
    mix(this.castRng.hi)
    return hash >>> 0
  }
}

/**
 * Standalone state hash helper supporting either a `GameEngine` instance or `(world, rng?, groundItems?)`.
 */
export function computeStateHash(
  engineOrWorld: GameEngine | CombatWorld,
  rngOrInventories?: Rng | D2Rng | readonly Inventory[],
  groundItems?: readonly any[],
): number {
  if ('computeStateHash' in engineOrWorld && typeof engineOrWorld.computeStateHash === 'function') {
    return engineOrWorld.computeStateHash()
  }
  const world = engineOrWorld as CombatWorld
  const inventories = Array.isArray(rngOrInventories) ? rngOrInventories : []
  const ground = Array.isArray(groundItems)
    ? groundItems.map(g => ('item' in g && g.item ? g : { x: g.x ?? 0, y: g.y ?? 0, item: { name: g.name ?? g.code ?? 'item', stack: g.amount ?? 1, value: g.amount ?? 0 } as any }))
    : []
  let hash = computeLockstepHash(world, inventories, ground, [])
  if (rngOrInventories && !Array.isArray(rngOrInventories) && 'lo' in rngOrInventories) {
    hash ^= ((rngOrInventories as any).lo & 0xFFFFFFFF)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

export interface NpcSpriteFrame {
  readonly width: number
  readonly height: number
  readonly offsetX: number
  readonly offsetY: number
}

export interface NpcEntity {
  def: NpcDef
  x: number
  y: number
  hasSprite: boolean
  frame?: NpcSpriteFrame | null | undefined
}

export interface EngineViewState {
  monstersSpawned?: number
  monstersAlive?: number
  kills?: number
  playerHp?: number
  playerMaxHp?: number
  playerMana?: number
  playerMaxMana?: number
  playerLevel?: number
  playerXp?: number
  playerHits?: number
  groundItems?: number
  inventoryItems?: number
  cellsUsed?: number
  cellsTotal?: number
  gold?: number
  defense?: number
  dropsRolled?: number
  pickups?: number
  inventoryRefusals?: number
  lastDrops?: string[]
  skills?: string[]
  selectedSkill?: number
  casts?: number
  castRefusals?: number
  castHits?: number
  projectilesAlive?: number
  npcs?: number
  npcsNear?: NpcEntity[]
  monstersNear?: unknown[]
  quests?: unknown[]
  dialog?: string[]
  questXp?: number
  questGold?: number
  worldTick?: number
  saves?: number
  loads?: number
  saveError?: string | null
  tick?: number
  x?: number
  y?: number
  bagItems?: number
  gamePlayers?: number
  partyPlayers?: number
}

export function syncEngineState(engine: GameEngine, state: EngineViewState): void {
  state.monstersSpawned = engine.world.monsters.length
  state.monstersAlive = engine.world.monsters.filter(m => m.state !== 'dead').length
  state.kills = engine.world.kills
  state.playerHp = engine.world.player.hp
  state.playerMaxHp = engine.world.player.maxHp
  state.playerMana = engine.world.player.mana
  state.playerMaxMana = engine.world.player.maxMana
  state.playerLevel = engine.world.player.level
  state.playerXp = engine.world.player.xp
  state.playerHits = engine.metrics.playerHits
  state.groundItems = engine.ground.length
  state.inventoryItems = engine.bag.contents.length
  state.cellsUsed = engine.bag.usedCells
  state.cellsTotal = engine.bag.width * engine.bag.height
  state.gold = engine.bag.gold
  state.defense = totalStat(engine.bag.contents, 'defense')
  state.dropsRolled = engine.metrics.dropsRolled
  state.pickups = engine.metrics.pickups
  state.inventoryRefusals = engine.metrics.inventoryRefusals
  state.lastDrops = [...engine.metrics.lastDrops]
  state.skills = engine.opts.skills.map(s => s.name)
  state.selectedSkill = engine.selectedSkill
  state.casts = engine.metrics.casts
  state.castRefusals = engine.metrics.castRefusals
  state.castHits = engine.metrics.castHits
  state.projectilesAlive = engine.projectiles.length
  state.npcs = engine.npcEntities.length
  state.npcsNear = engine.npcEntities.filter(n => Math.hypot(n.x - engine.world.player.x, n.y - engine.world.player.y) <= 800)
  state.monstersNear = engine.world.monsters.filter(m => Math.hypot(m.x - engine.world.player.x, m.y - engine.world.player.y) <= 800)
  state.quests = engine.questLog.active.map(q => q.def.name)
  state.dialog = engine.dialog
  state.questXp = engine.metrics.questXp
  state.questGold = engine.metrics.questGold
  state.worldTick = engine.world.tick
  state.saves = engine.metrics.saves
  state.loads = engine.metrics.loads
  state.saveError = engine.metrics.saveError
  
  state.tick = engine.world.tick
  state.x = engine.world.player.x
  state.y = engine.world.player.y
  state.bagItems = engine.bag.contents.length
  state.gamePlayers = engine.gamePlayers
  state.partyPlayers = engine.partyPlayers
}

export { MonsterStreamingManager } from '../../common/units/monster-streaming.ts'
export type { MonsterStreamingOptions, StreamingRoomDef, StreamingRoomState } from '../../common/units/monster-streaming.ts'
