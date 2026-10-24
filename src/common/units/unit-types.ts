/**
 * Pure unit, monster, combat world, and character attribute type definitions.
 */

import type { CharacterClassCode } from './classes.ts'

export type MonsterRank = 'normal' | 'champion' | 'unique' | 'minion' | 'boss'

export type BaseStatKey = 'str' | 'dex' | 'vit' | 'ene'

export interface CharacterAttributes {
  classCode?: CharacterClassCode | undefined
  name: string
  classNameZh: string
  classNameEn: string
  level: number
  xp: number
  nextLevelXp: number
  str: number
  dex: number
  vit: number
  ene: number
  statPoints: number
  baseMaxHp: number
  baseMaxMana: number
  baseMaxStamina: number
  defense: number
  attackRating: number
  fireRes: number
  coldRes: number
  lightRes: number
  poisRes: number
}

/** Movement request and intent for one tick. */
export interface CombatInput {
  /** Normalized movement, screen axes (y grows downward). */
  readonly movement: { readonly x: number; readonly y: number }
  /** Whether the attack control is held this tick. */
  readonly attack: boolean
}

export interface CombatTerrain {
  readonly overlap: (x: number, y: number) => number
}

/** Tuning that is not per-monster. */
export interface CombatOptions {
  /** Player walk speed in pixels per second. */
  readonly playerSpeed: number
  /** Player melee reach in pixels. */
  readonly playerReach: number
  /** Ticks between player attacks. */
  readonly playerCooldownTicks: number
  /** Player damage per hit. */
  readonly playerDamage: number
  /** Mana spent per attack (0 disables the cost). */
  readonly playerManaPerAttack: number
  /** Ticks before a dead player is restored, at full resources. */
  readonly respawnTicks: number
  /** When true, monsters ignore aggro distance and remain standing still (idle). */
  readonly disableMonsterAggro?: boolean
  /** When true, world.events is preserved across ticks instead of cleared at tick start. */
  readonly preserveEvents?: boolean | undefined
}

export interface MonsterStats113cAttack {
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly toHit: number
  readonly minDamage?: number | undefined
  readonly maxDamage?: number | undefined
  readonly move?: number | undefined
}

export interface MonsterElementalAttack {
  readonly slot?: 1 | 2 | 3 | undefined
  readonly mode: 'A1' | 'A2' | 'S1' | 'S2' | 'S3' | 'S4' | 'C' | string
  readonly type: 'fire' | 'ltng' | 'cold' | 'pois' | 'mag' | 'stamina' | 'life' | 'mana' | 'burn' | 'frze' | string
  readonly chancePct: number
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly durationFrames: number
  readonly pct?: number | undefined
  readonly minDamage?: number | undefined
  readonly maxDamage?: number | undefined
  readonly duration?: number | undefined
}

export interface MonsterSkillEntry {
  readonly slot?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | undefined
  readonly skill: string
  readonly skillId?: number | undefined
  readonly mode: 'A1' | 'A2' | 'S1' | 'S2' | 'S3' | 'S4' | 'C' | 'SC' | 'SQ' | string
  readonly level: number
}

export interface MonsterModeMissiles {
  readonly MissA1?: string | undefined
  readonly MissA2?: string | undefined
  readonly MissS1?: string | undefined
  readonly MissS2?: string | undefined
  readonly MissS3?: string | undefined
  readonly MissS4?: string | undefined
  readonly MissC?: string | undefined
  readonly MissSQ?: string | undefined
  readonly A1?: string | undefined
  readonly A2?: string | undefined
  readonly S1?: string | undefined
  readonly S2?: string | undefined
  readonly S3?: string | undefined
  readonly S4?: string | undefined
  readonly C?: string | undefined
  readonly SQ?: string | undefined
}

export interface MonsterDifficultyStats<T = number> {
  readonly normal: T
  readonly nightmare: T
  readonly hell: T
}

/** One monster's immutable numbers, read from a table row. */
export interface MonsterStats {
  /** Identifier, as written in the table. */
  readonly id: string
  /** Hardcoded 1.13c MonStats.txt row index (0..733). */
  readonly hcIdx?: number | undefined
  /** Display name. */
  readonly name: string
  /** Maximum health. */
  readonly hp: number
  /** Alias for maximum health (used by 1.13c data contract & M2/M3 callers). */
  readonly maxHp?: number | undefined
  /** Damage per hit. */
  readonly damage: number
  /** Ticks between attacks. */
  readonly cooldownTicks: number
  /** Reach in pixels. */
  readonly reach: number
  /** Distance at which the monster notices the player, in pixels. */
  readonly aggroRadius: number
  /** Speed in pixels per second. */
  readonly speed: number
  /** Experience awarded on death. */
  readonly xp: number
  /** Elite rank: normal, champion, unique, minion, or boss. */
  readonly rank?: MonsterRank
  /** Rolled elite/superunique modifiers from MonUMod.txt. */
  readonly modifiers?: readonly string[]
  /** SuperUnique identifier if this is a fixed SuperUnique boss (e.g. 'Bishibosh'). */
  readonly superUniqueId?: string
  /** Monster level for drops and scaling. */
  readonly level?: number
  /** Armor class / defense after MonLvl.txt scaling. */
  readonly armor?: number | undefined
  /** Alias for armor class / defense. */
  readonly armour?: number | undefined
  /** Primary attack rating (A1TH) after MonLvl.txt scaling. */
  readonly toHit?: number | undefined
  /** Resistances per damage type (from MonStats.txt). */
  readonly resistances?: {
    readonly physical?: number
    readonly magic?: number
    readonly fire?: number
    readonly lightning?: number
    readonly cold?: number
    readonly poison?: number
  }
  /** Explicit lightning resistance percentage. */
  readonly lightningResist?: number
  /** Generic resists bag for compatibility. */
  readonly resists?: {
    readonly physical?: number
    readonly magic?: number
    readonly lightning?: number
    readonly fire?: number
    readonly cold?: number
    readonly poison?: number
    readonly [k: string]: number | undefined
  }
  /** Canonical `.tbl` key for monster name (`MonStats.txt` `NameStr` or `SuperUniques.txt` `Name`). */
  readonly nameKey?: string | undefined
  /** Canonical `.tbl` key for monster special ability subtext (`MonStats.txt` `DescStr`). */
  readonly descKey?: string | undefined
  /** True when `MonStats.txt` `lUndead` or `hUndead` is non-zero (`0x6FD62B50`). */
  readonly isUndead?: boolean | undefined
  /** True when `MonStats.txt` `lUndead` is non-zero. */
  readonly lUndead?: boolean | undefined
  /** True when `MonStats.txt` `hUndead` is non-zero. */
  readonly hUndead?: boolean | undefined
  /** True when `MonStats.txt` `demon` is non-zero (`0x6FD62BA0`). */
  readonly isDemon?: boolean | undefined
  /** Alias for `isDemon`. */
  readonly demon?: boolean | undefined
  /** True when `MonStats.txt` `boss` is non-zero. */
  readonly isBoss?: boolean | undefined
  /** True when `MonStats.txt` `primeevil` is non-zero. */
  readonly primeevil?: boolean | undefined
  /** Alias for `primeevil`. */
  readonly isPrimeEvil?: boolean | undefined
  /** True when `MonStats.txt` `killable` is non-zero. */
  readonly killable?: boolean | undefined
  /** True when `MonStats.txt` `inTown` is non-zero. */
  readonly inTown?: boolean | undefined
  /** True when `MonStats.txt` `noRatio` is non-zero (bypasses MonLvl.txt L-* scaling). */
  readonly noRatio?: boolean | undefined
  /** True when `MonStats.txt` `rangedtype` is non-zero. */
  readonly isRanged?: boolean | undefined
  /** True when `MonStats.txt` `flying` is non-zero. */
  readonly isFlying?: boolean | undefined
  /** True when `MonStats.txt` `opendoors` is non-zero. */
  readonly canOpenDoors?: boolean | undefined
  /** True when `MonStats.txt` `neverCount` is non-zero. */
  readonly neverCount?: boolean | undefined
  /** True when `MonStats.txt` `petIgnore` is non-zero. */
  readonly petIgnore?: boolean | undefined
  /** True when `MonStats.txt` `deathDmg` is non-zero (e.g. Bone Fetish death explosion). */
  readonly deathDmg?: boolean | undefined
  /** AI behavior name from MonStats.txt `AI` column (`MonAi.txt`). */
  readonly ai?: string | undefined
  /** AI frame delay between decisions for active difficulty (`aidel`). */
  readonly aiDelay?: number | undefined
  /** AI leash/aggro distance in sub-tiles (`aidist`). */
  readonly aiDistance?: number | undefined
  /** AI parameters `aip1..aip8` for active difficulty. */
  readonly aiParams?: readonly number[] | undefined
  /** Attack 1 (`A1MinD`, `A1MaxD`, `A1TH`) scaled for active difficulty. */
  readonly attack1?: MonsterStats113cAttack | undefined
  /** Attack 2 (`A2MinD`, `A2MaxD`, `A2TH`) scaled for active difficulty. */
  readonly attack2?: MonsterStats113cAttack | undefined
  /** Special Attack 1 (`S1MinD`, `S1MaxD`, `S1TH`) scaled for active difficulty. */
  readonly special1?: MonsterStats113cAttack | undefined
  /** Elemental attacks `El1..El3` scaled for active difficulty. */
  readonly elementalAttacks?: readonly MonsterElementalAttack[] | undefined
  /** Monster skills `Skill1..Skill8` (`Sk1mode..Sk8mode`, `Sk1lvl..Sk8lvl`). */
  readonly skills?: readonly MonsterSkillEntry[] | undefined
  /** Mode-bound missiles (`MissA1`, `MissA2`, `MissS1..S4`, `MissC`, `MissSQ`). */
  readonly modeMissiles?: MonsterModeMissiles | undefined
  /** Life/mana steal drain effectiveness percentage (`Drain`). */
  readonly drain?: number | undefined
  /** Cold chill effectiveness percentage (`coldeffect`, typically negative). */
  readonly coldEffect?: number | undefined
  /** Health regeneration rate (`DamageRegen`). */
  readonly damageRegen?: number | undefined
  /** Block chance percentage (`ToBlock`). */
  readonly toBlock?: number | undefined
  /** Critical hit percentage (`Crit`). */
  readonly crit?: number | undefined
  /** Alignment (`0` = evil/hostile, `1` = aligned/friendly, `2` = neutral). */
  readonly align?: 0 | 1 | 2 | number | undefined
  /** Melee sub-tile range (`MeleeRng`). */
  readonly meleeRng?: number | undefined
}

export interface MonsterCurseState {
  name: string
  slvl: number
  curseType: number
  ticksRemaining: number
  overlayName?: string | undefined
  casterX?: number | undefined
  casterY?: number | undefined
  fleeTarget?: { x: number; y: number } | undefined
  returnPct?: number | undefined
}

/** One monster's mutable state. */
export interface Monster {
  /** Stable index, for events and debugging. */
  readonly index: number
  /** Its table numbers. */
  readonly stats: MonsterStats
  /** World x. */
  x: number
  /** World y. */
  y: number
  /** Current health. */
  hp: number
  /** Ticks until it may attack again. */
  cooldown: number
  /** What it is doing. */
  state: 'idle' | 'chase' | 'attack' | 'dead'
  /** Facing (0 = south, turning west), for the renderer. */
  facing: number
  /** Ticks left of the hit flash, for the renderer. */
  hitFlash: number
  /** Ticks left of the death animation. */
  corpseTicks: number
  /** Whether the monster is sleeping (inactive off-screen room). */
  sleeping?: boolean | undefined
  /** Ticks remaining frozen (cannot move or attack). */
  frozenTicks?: number | undefined
  /** Ticks remaining chilled (slowed movement). */
  chillTicks?: number | undefined
  /** Ticks remaining poisoned (damage over time). */
  poisonTicks?: number | undefined
  /** Ticks remaining stunned (e.g. Twister 10f stun). */
  stunTicks?: number | undefined
  /** Active Necromancer curse debuff state. */
  curse?: MonsterCurseState | undefined
  /** Whether drops have already been rolled for this monster instance. */
  dropRolled?: boolean | undefined
  /** Authentic animation mode ('dt' during death sequence, 'dd' once dead/corpse). */
  animMode?: 'dt' | 'dd' | string | undefined
  /** Remaining ticks of death animation before drop triggers (for headless/simulated drops). */
  deathTicks?: number | undefined
  /** Explicit flag indicating drop execution is gated on death animation completion. */
  deathGated?: boolean | undefined
  /** Queued pending drop data prepared upon lethal hit, awaiting DT sequence completion. */
  pendingDrop?: any | undefined
  /** Deterministic per-unit seed derived from world/level seed and spawn index (D2 1.13c pUnit->dwInitSeed). */
  dwInitSeed?: number | undefined
  /** Rendered world-space sprite bounding box for mouse hover/click hit-testing (`D2Client.dll` `0x6FB01A80`). */
  drawBounds?: { x: number; y: number; w: number; h: number } | undefined
  /** True when corpse is suppressed on death (freeze shatter, Bone Fetish explosion, Suicide Minion). */
  corpseSuppressed?: boolean | undefined
  /** Active Inner Sight (#8) remaining ticks and flat defense reduction. */
  innerSightTicks?: number | undefined
  innerSightDefReduction?: number | undefined
  /** Active Slow Missiles (#17) remaining ticks and projectile velocity multiplier (0.33). */
  slowMissilesTicks?: number | undefined
  slowMissilesMult?: number | undefined
  /** Light radius bonus applied by Inner Sight (#8) or Slow Missiles (#17). */
  lightRadiusBonus?: number | undefined
  /** Optional monster defense value for hit-chance calculations. */
  defense?: number | undefined
  /** Ticks remaining in pack morale / terror retreat state (R2.2). */
  fleeTicks?: number | undefined
  /** Ticks remaining before special AI skill / resurrect / curse can fire again (R2.3-R2.7). */
  aiCooldownTicks?: number | undefined
  /** Ticks remaining in a boss or elite sub-phase (R2.7). */
  aiPhaseTicks?: number | undefined
  /** Current Frenzy stack count for Frenzy/MoonLord monsters (R2.1). */
  frenzyStacks?: number | undefined
  /** True when corpse has been consumed by resurrection, Corpse Explosion, or Vine (R2.3/R2.7). */
  corpseConsumed?: boolean | undefined
  /** True when monster shattered on death while frozen/chilled (R2.6). */
  shattered?: boolean | undefined
  /** Optional runtime alignment override (`0` = hostile, `1` = allied/revived, `2` = neutral). */
  align?: 0 | 1 | 2 | undefined
  /** Optional pack leader monster index for minion morale routing (R2.2). */
  leaderId?: number | undefined
}

/** The player's combat-relevant state. */
export interface CombatPlayer {
  /** World x. */
  x: number
  /** World y. */
  y: number
  /** Current health. */
  hp: number
  /** Maximum health. */
  maxHp: number
  /** Current mana. */
  mana: number
  /** Maximum mana. */
  maxMana: number
  /** Character level. */
  level: number
  /** Experience accumulated. */
  xp: number
  /** Ticks until the next attack. */
  cooldown: number
  /** Facing (0 = south, turning west). */
  facing: number
  /** Whether the player is alive. */
  alive: boolean
  /** Ticks left until respawn while dead. */
  respawnIn: number
  /** Ticks left of the swing animation, for the renderer. */
  swingTicks: number
  /** Thunder Storm active remaining ticks. */
  thunderstormTicks?: number
  thunderstormInterval?: number
  thunderstormNextStrike?: number
  thunderstormDamage?: number
  thunderstormDamageRange?: { readonly min: number; readonly max: number } | undefined
  thunderstormSlvl?: number
  /** Energy Shield active remaining ticks. */
  energyshieldTicks?: number
  energyshieldPct?: number
  energyshieldSlvl?: number
  /** Cold Armor active remaining ticks and type ('frozenarmor' | 'shiverarmor' | 'chillingarmor'). */
  coldArmorType?: 'frozenarmor' | 'shiverarmor' | 'chillingarmor' | undefined
  coldArmorTicks?: number | undefined
  coldArmorSlvl?: number | undefined
  /** Blaze active remaining ticks and patch config. */
  blazeTicks?: number | undefined
  blazeSlvl?: number | undefined
  blazeDamage?: number | undefined
  blazePatchDuration?: number | undefined
  lastBlazeX?: number | undefined
  lastBlazeY?: number | undefined
  /** Inferno continuous channeling state and sub-mana fractional accumulator (256ths). */
  infernoChanneling?: boolean | undefined
  infernoManaRemainder256?: number | undefined
  /** Enchant active remaining ticks, added fire damage, and attack rating % bonus. */
  enchantTicks?: number | undefined
  enchantDamage?: { min: number; max: number } | undefined
  enchantAttackRatingPercent?: number | undefined
  fireMasterySlvl?: number | undefined
  isSorceress?: boolean | undefined
  isRanged?: boolean | undefined
  /** Canonical character class code ('ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass'). */
  classCode?: CharacterClassCode | undefined
  /** Canonical primary attributes. */
  str?: number | undefined
  dex?: number | undefined
  vit?: number | undefined
  ene?: number | undefined
  strength?: number | undefined
  dexterity?: number | undefined
  vitality?: number | undefined
  energy?: number | undefined
  experience?: number | undefined
  nextLevelExp?: number | undefined
  /** Unallocated stat and skill points. */
  statPoints?: number | undefined
  skillPoints?: number | undefined
  /** Stamina and running state. */
  stamina?: number | undefined
  maxStamina?: number | undefined
  isRunning?: boolean | undefined
  /** Sub-mana fractional accumulator in 256ths for 1.13c mana regeneration. */
  manaRemainder256?: number | undefined
  /** Over-time healing/mana potion and resistance potion timers. */
  hpRegenTicksRemaining?: number | undefined
  hpRegenRatePerTick?: number | undefined
  manaRegenTicksRemaining?: number | undefined
  manaRegenRatePerTick?: number | undefined
  coldResistBonusTicks?: number | undefined
  poisonResistBonusTicks?: number | undefined
  /** Amazon passive skill levels when active in CombatWorld. */
  dodgeSlvl?: number | undefined
  avoidSlvl?: number | undefined
  evadeSlvl?: number | undefined
  criticalStrikeSlvl?: number | undefined
  penetrateSlvl?: number | undefined
  /** Optional deterministic roll override (0-99) for avoidance/crit testing. */
  passiveRollOverride?: number | undefined
  /** Whether the player moved during the current tick (for Evade vs Dodge/Avoid selection). */
  isMovingThisTick?: boolean | undefined
  /** Druid form ('human' | 'wolf' | 'bear') and Elemental active states (#235 Cyclone Armor, #249 Armageddon, #250 Hurricane). */
  druidForm?: 'human' | 'wolf' | 'bear' | undefined
  cycloneArmorHp?: number | undefined
  cycloneArmorMaxHp?: number | undefined
  cycloneArmorSlvl?: number | undefined
  armageddonTicks?: number | undefined
  armageddonDamage?: number | undefined
  armageddonResidualDamage?: number | undefined
  armageddonSlvl?: number | undefined
  hurricaneTicks?: number | undefined
  hurricaneDamage?: number | undefined
  hurricaneSlvl?: number | undefined
  /** Active curse applied to the player by Oblivion Knights, Succubi, or Cursed elites (R2.5/R2.6). */
  curse?:
    | {
        id?: string | undefined
        name?: string | undefined
        slvl?: number | undefined
        sourceId?: number | undefined
        sourceUnitId?: number | undefined
        expiresTick?: number | undefined
        remainingTicks?: number | undefined
        ticksRemaining?: number | undefined
      }
    | undefined
  /** Active chill duration ticks on the player from Cold Enchanted / Frost Nova (R2.6). */
  chillTicks?: number | undefined
  /** Active freeze duration ticks on the player from Freeze UMod (#43) (R2.6). */
  frozenTicks?: number | undefined
}

/** Something worth telling the player (and the renderer) about. */
export interface CombatEvent {
  /** Event kind. */
  readonly kind:
    | 'playerHit'
    | 'monsterHit'
    | 'kill'
    | 'levelUp'
    | 'playerDeath'
    | 'respawn'
    | 'noMana'
    | 'missileHit'
    | 'missileExplode'
    | 'unitSkillEvent'
    | 'unitOverlay'
  /** World x the event happened at. */
  readonly x: number
  /** World y the event happened at. */
  readonly y: number
  /** Magnitude (damage), when meaningful. */
  readonly amount?: number
  /** Text to float above the point, when meaningful. */
  readonly text?: string
  /** Subject identity (a monster's table id on a kill, for quest counters). */
  readonly subjectId?: string
  /** Stable monster index for kill and hit events. */
  readonly monsterIndex?: number | undefined
  /** Monster level when event is 'kill'. */
  readonly monsterLevel?: number | undefined
  /** Monster rank when event is 'kill'. */
  readonly monsterRank?: MonsterRank | undefined
  /** Monster type code (1=normal, 2=champion, 3=unique, 4=boss). */
  readonly monsterType?: number | undefined
  /** SuperUnique ID if applicable. */
  readonly superUniqueId?: string | undefined
  /** Missile type identifier if applicable (e.g. 'firebolt', 'fireexplode'). */
  readonly missileType?: string | undefined
  /** Source skill ID if applicable. */
  readonly skillId?: string | undefined
  /** S2C 0xA3 24-byte packet emitted for unitSkillEvent (D2Game 0x6fc9a190 + 0x6fcaba90). */
  readonly packet0xA3?: Uint8Array | undefined
  /** Decoded UnitSkillEvent payload for S2C 0xA3. */
  readonly unitSkillEvent?: {
    readonly type: 'UnitSkillEvent'
    readonly flag: number
    readonly skill: number
    readonly level: number
    readonly caster: { readonly rawUnitType: number; readonly id: number }
    readonly target: { readonly rawUnitType: number; readonly id: number }
    readonly x: number
    readonly y: number
  } | undefined
  /** Overlay.txt token name when kind === 'unitOverlay' (e.g. 'frozenarmor_hit', 'shiverarmor_hit', 'energyshieldhit3'). */
  readonly overlayToken?: string | undefined
  /** Overlay.txt row index when kind === 'unitOverlay' (e.g. 42, 43, 87..94). */
  readonly overlayIndex?: number | undefined
  /** Target raw unit type for S2C 0x11 UnitOverlay (0=player, 1=monster). */
  readonly targetUnitType?: number | undefined
  /** Target unit GUID for S2C 0x11 UnitOverlay. */
  readonly targetUnitId?: number | undefined
  /** S2C 0x11 8-byte packet emitted for unitOverlay (D2Game STAT_UNIT_DOOVERLAY). */
  readonly packet0x11?: Uint8Array | undefined
  /** Decoded UnitOverlay payload for S2C 0x11. */
  readonly unitOverlay?: {
    readonly type: 'UnitOverlay'
    readonly rawUnitType: number
    readonly id: number
    readonly overlayIndex: number
  } | undefined
}

/** The whole simulation state. */
export interface CombatWorld {
  player: CombatPlayer
  players: CombatPlayer[]
  monsters: Monster[]
  tick: number
  events: CombatEvent[]
  pendingKills?: CombatEvent[] | undefined
  kills: number
  level?: number | undefined
  xp?: number | undefined
}

/** A circular exclusion zone where ordinary monster camps must not spawn. */
export interface SafeZone {
  readonly x: number
  readonly y: number
  readonly radius: number
}

/** A group of monsters that belongs together on the ground. */
export interface MonsterPack {
  readonly members: readonly MonsterStats[]
  readonly fixedPosition?: { readonly x: number; readonly y: number }
  readonly landmarkTile?: { readonly tileX: number; readonly tileY: number }
  readonly superUniqueId?: string
}

import type { NpcDef } from '../world/npc.ts'
import { totalStat } from '../items/items.ts'

export interface AnimClipMeta {
  readonly group: number
  readonly directions?: number
  readonly frames: number
  readonly speed: number
  readonly loop: boolean
  readonly events: readonly { readonly f: number; readonly c: number }[]
}

export interface ActorAnimatorLike {
  readonly mode: string | null
  readonly clip: AnimClipMeta | null
  readonly frameIndex: number
  readonly finished: boolean
  setLoop(mode: string, clip: AnimClipMeta): void
  triggerOneShot(mode: string, clip: AnimClipMeta): void
  play(mode: string, clip: AnimClipMeta, options?: { readonly restart?: boolean }): void
  tick(): readonly { readonly frame: number; readonly code: number }[]
}

export interface ActiveExplosion {
  readonly x: number
  readonly y: number
  readonly missileType: string
  frame: number
  readonly maxFrames: number
  readonly radius?: number | undefined
  readonly isSmoke?: boolean | undefined
  readonly tint?: 'fire' | 'cold' | 'lightning' | 'poison' | 'magic' | undefined
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

export function syncEngineState(engine: any, state: EngineViewState): void {
  state.monstersSpawned = engine.world.monsters.length
  state.monstersAlive = engine.world.monsters.filter((m: any) => m.state !== 'dead').length
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
  state.skills = engine.opts.skills.map((s: any) => s.name)
  state.selectedSkill = engine.selectedSkill
  state.casts = engine.metrics.casts
  state.castRefusals = engine.metrics.castRefusals
  state.castHits = engine.metrics.castHits
  state.projectilesAlive = engine.projectiles.length
  state.npcs = engine.npcEntities.length
  state.npcsNear = engine.npcEntities.filter((n: any) => Math.hypot(n.x - engine.world.player.x, n.y - engine.world.player.y) <= 800)
  state.monstersNear = engine.world.monsters.filter((m: any) => Math.hypot(m.x - engine.world.player.x, m.y - engine.world.player.y) <= 800)
  state.quests = engine.questLog.active.map((q: any) => q.def.name)
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

export interface KillerDropContext {
  readonly playerMf: number
  readonly playerGf: number
  readonly gamePlayers: number
  readonly partyPlayers: number
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
  readonly killerContext: KillerDropContext
  items?: readonly any[] | undefined
}

export interface ActiveHydra {
  readonly id?: string | number | undefined
  x: number
  y: number
  slvl: number
  ticksRemaining: number
  cooldownTicks?: number | undefined
  fireMasterySlvl?: number | undefined
  fireBoltBlvl?: number | undefined
  fireBallBlvl?: number | undefined
}

export interface ActiveTrap {
  readonly id?: string | number | undefined
  skillId: number
  x: number
  y: number
  slvl: number
  shotsRemaining: number
  ticksRemaining: number
  cooldownTicks?: number | undefined
}

export type SceneEngineLike = any

