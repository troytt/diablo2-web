/**
 * Server-authoritative 25Hz monster & mercenary AI state machine (`src/server/ai/monster-ai.ts`).
 *
 * Extracted from `src/server/engine/combat.ts` and unified with `src/common/units/unit-types.ts`.
 * Zero DOM or Node dependencies, and zero wall-clock or Math.random() calls.
 *
 * Decision for #1341: the authoritative monster runtime is
 * `GameInstance.stepMonsterAi`. This file is kept as the `GameEngine` compatibility
 * harness (legacy tests still exercise it); `GameInstance` only imports the
 * mercenary tick. Both paths consume `src/common/units/monai-113c.ts` for the
 * 148-row dispatch families and `aip1..aip8` parameter layout, so the mapping
 * itself has a single source of truth.
 */

import { numberCell, textCell } from '../../common/items/tables.ts'
import type { DataTable } from '../../common/items/tables.ts'
import {
  OVERLAY_INDEX_FROZEN_ARMOR_HIT,
  OVERLAY_INDEX_SHIVER_ARMOR_HIT,
  computeEnergyShieldHitOverlay113c,
} from '../../common/path/direction.ts'
import {
  calculateAvoidStats,
  calculateCriticalStrikeStats,
  calculateDodgeStats,
  calculateEvadeStats,
  calculatePenetrateStats,
} from '../../common/skills/amazon-passive.ts'
import { CANONICAL_CHARSTATS, type CharacterClassCode } from '../../common/units/classes.ts'
import { findMonaiProfile113c } from '../../common/units/monai-113c.ts'
import {
  HIRELING_RECORDS,
  resolveHirelingStatsAtLevel,
  type HirelingRecord,
} from '../../common/units/hireling-table.ts'
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
  getBossDeathFxSpec,
  hasMonsterUMod,
  isBoneFetishMonster,
  isPoisonDeadMonster,
  isScarabMonster,
  isSuicideMinionMonster,
  resolveSuicideExplodeMissileKey,
} from '../../common/units/monster-death-fx.ts'
import {
  PACK_RADIUS_PX,
  allocatePacksToRooms,
  partitionMapIntoRooms,
  spawnMonsterPacksByRooms,
  spawnPacksInRoom,
  type MapRoom,
} from '../../common/units/monster-rooms.ts'
import {
  getMonsterModeMissile113c,
  monsterStatsOf,
} from '../../common/units/monsters-data.ts'
import type {
  ActiveExplosion,
  ActorAnimatorLike,
  AnimClipMeta,
  BaseStatKey,
  CharacterAttributes,
  CombatEvent,
  CombatInput,
  CombatOptions,
  CombatPlayer,
  CombatTerrain,
  CombatWorld,
  EngineViewState,
  Monster,
  MonsterCurseState,
  MonsterPack,
  MonsterRank,
  MonsterStats,
  NpcEntity,
  NpcSpriteFrame,
  SafeZone,
  SceneEngineLike,
} from '../../common/units/unit-types.ts'
import { syncEngineState } from '../../common/units/unit-types.ts'
import { encode0x11UnitOverlay } from '../../netproto/index.ts'
import { computeEffectiveResistance } from '../engine/combat-pipeline.ts'
import {
  calculateChillingArmorChillLength,
  calculateChillingArmorDamage,
  calculateEnchantAttackDamage,
  calculateEnchantAttackRating,
  calculateEnchantDamage,
  calculateEnchantDuration,
  calculateFireMasteryBonus,
  calculateFrozenArmorFreezeLength,
  calculateShiverArmorChillLength,
  calculateShiverArmorDamage,
} from '../engine/missile-engine.ts'

export {
  CANONICAL_CHARSTATS,
  MON_UMOD,
  PACK_RADIUS_PX,
  allocatePacksToRooms,
  calculateAvoidStats,
  calculateCriticalStrikeStats,
  calculateDodgeStats,
  calculateEnchantAttackDamage,
  calculateEnchantAttackRating,
  calculateEnchantDamage,
  calculateEnchantDuration,
  calculateEvadeStats,
  calculateFireMasteryBonus,
  calculatePenetrateStats,
  hasMonsterUMod,
  isBoneFetishMonster,
  isSuicideMinionMonster,
  partitionMapIntoRooms,
  spawnMonsterPacksByRooms,
  spawnPacksInRoom,
  syncEngineState,
  type ActiveExplosion,
  type ActorAnimatorLike,
  type AnimClipMeta,
  type BaseStatKey,
  type CharacterAttributes,
  type CharacterClassCode,
  type CombatEvent,
  type CombatInput,
  type CombatOptions,
  type CombatPlayer,
  type CombatTerrain,
  type CombatWorld,
  type EngineViewState,
  type MapRoom,
  type Monster,
  type MonsterCurseState,
  type MonsterPack,
  type MonsterRank,
  type MonsterStats,
  type NpcEntity,
  type NpcSpriteFrame,
  type SafeZone,
  type SceneEngineLike,
}
export type {
  ActiveHydra,
  ActiveTrap,
  KillerDropContext,
  PendingMonsterDrop,
} from '../../common/units/unit-types.ts'
export * from '../../common/units/monster-death-fx.ts'
export * from '../../common/units/monsters-data.ts'

/** Defaults that keep the sandbox playable when a table is thin. */
const DEFAULTS = {
  hp: 20,
  damage: 3,
  cooldownTicks: 25,
  reach: 40,
  aggroRadius: 220,
  speed: 90,
  xp: 10,
} as const

/**
 * Read one monster's numbers from a table row.
 */
export function monsterStatsFromRow(row: Readonly<Record<string, string>>, rowIndex: number): MonsterStats {
  const ltngRaw = row['ResLi'] ?? row['ResistLightning'] ?? row['ResLi(N)'] ?? row['ResLi(H)']
  const ltngRes = ltngRaw !== undefined && ltngRaw.trim() !== '' ? Number(ltngRaw) : undefined
  return {
    id: textCell(row, 'Id', `monster${String(rowIndex)}`),
    name: textCell(row, 'Name', textCell(row, 'Id', `Monster ${String(rowIndex)}`)),
    hp: numberCell(row, 'HP', DEFAULTS.hp),
    damage: numberCell(row, 'Damage', DEFAULTS.damage),
    cooldownTicks: numberCell(row, 'CooldownTicks', DEFAULTS.cooldownTicks),
    reach: numberCell(row, 'Reach', DEFAULTS.reach),
    aggroRadius: numberCell(row, 'AggroRadius', DEFAULTS.aggroRadius),
    speed: numberCell(row, 'Speed', DEFAULTS.speed),
    xp: numberCell(row, 'XP', DEFAULTS.xp),
    ...(ltngRes !== undefined
      ? { lightningResist: ltngRes, resists: { lightning: ltngRes }, resistances: { lightning: ltngRes } }
      : {}),
  }
}

/**
 * Read every monster definition in a table.
 */
export function monsterStatsFromTable(table: DataTable): MonsterStats[] {
  return table.rows.map((row, index) => monsterStatsFromRow(row, index))
}

/**
 * Read the experience required per level.
 */
export function experienceTable(table: DataTable): number[] {
  const levels: number[] = [0, 0]
  for (const row of table.rows) {
    const level = numberCell(row, 'Level', 0)
    if (level < 1) continue
    levels[level] = numberCell(row, 'XP', 0)
  }
  for (let level = 2; level < levels.length; level += 1) {
    levels[level] = Math.max(levels[level] ?? 0, levels[level - 1] ?? 0)
  }
  return levels
}

const DEFAULT_XP_TABLE: readonly number[] = [
  0, 0, 500, 1500, 3750, 7875, 14175, 22680, 32886, 44396, 57715, 72144, 90180,
]

/**
 * Compute character level for a cumulative XP total against an experience table.
 */
export function levelForXp(xp: number, xpTable: readonly number[] = DEFAULT_XP_TABLE): number {
  if (!xpTable || xpTable.length === 0) return 1
  const oneIndexed = xpTable.length > 2 && (xpTable[1] ?? 0) === 0
  let level = 1
  if (oneIndexed) {
    for (let i = 2; i < xpTable.length; i += 1) {
      if (xp >= (xpTable[i] ?? Number.POSITIVE_INFINITY)) level = i
      else break
    }
  } else {
    for (let i = 1; i < xpTable.length; i += 1) {
      if (xp >= (xpTable[i] ?? Number.POSITIVE_INFINITY)) level = i + 1
      else break
    }
  }
  return level
}

/**
 * Create a world with a player at a position.
 */
export function createWorld(
  x: number,
  y: number,
  maxHp?: number,
  maxMana?: number,
  classCode?: CharacterClassCode,
): CombatWorld {
  const player = createPlayer(x, y, maxHp, maxMana, classCode)
  return {
    player,
    players: [player],
    monsters: [],
    tick: 0,
    events: [],
    pendingKills: [],
    kills: 0,
  }
}

/**
 * Create one player body.
 */
export function createPlayer(
  x: number,
  y: number,
  maxHp?: number,
  maxMana?: number,
  classCode?: CharacterClassCode,
): CombatPlayer {
  const resolvedClass: CharacterClassCode = classCode ?? 'sor'
  const cStats = CANONICAL_CHARSTATS[resolvedClass]
  const resolvedMaxHp = maxHp ?? cStats.baseVitals.life
  const resolvedMaxMana = maxMana ?? cStats.baseVitals.mana
  const resolvedMaxStamina = cStats.baseVitals.stamina
  const p: CombatPlayer = {
    x,
    y,
    hp: resolvedMaxHp,
    maxHp: resolvedMaxHp,
    mana: resolvedMaxMana,
    maxMana: resolvedMaxMana,
    level: 1,
    xp: 0,
    cooldown: 0,
    facing: 0,
    alive: true,
    respawnIn: 0,
    swingTicks: 0,
    classCode: resolvedClass,
    str: cStats.baseAttributes.strength,
    dex: cStats.baseAttributes.dexterity,
    vit: cStats.baseAttributes.vitality,
    ene: cStats.baseAttributes.energy,
    statPoints: 0,
    skillPoints: 0,
    stamina: resolvedMaxStamina,
    maxStamina: resolvedMaxStamina,
    isRunning: true,
    manaRemainder256: 0,
  }
  Object.defineProperties(p, {
    strength: {
      get() {
        return p.str ?? cStats.baseAttributes.strength
      },
      set(v: number) {
        p.str = v
      },
      enumerable: false,
      configurable: true,
    },
    dexterity: {
      get() {
        return p.dex ?? cStats.baseAttributes.dexterity
      },
      set(v: number) {
        p.dex = v
      },
      enumerable: false,
      configurable: true,
    },
    vitality: {
      get() {
        return p.vit ?? cStats.baseAttributes.vitality
      },
      set(v: number) {
        p.vit = v
      },
      enumerable: false,
      configurable: true,
    },
    energy: {
      get() {
        return p.ene ?? cStats.baseAttributes.energy
      },
      set(v: number) {
        p.ene = v
      },
      enumerable: false,
      configurable: true,
    },
    experience: {
      get() {
        return p.xp
      },
      set(v: number) {
        p.xp = v
      },
      enumerable: false,
      configurable: true,
    },
    nextLevelExp: {
      get() {
        return DEFAULT_XP_TABLE[Math.min(p.level + 1, DEFAULT_XP_TABLE.length - 1)] ?? 500
      },
      set(_v: number) {},
      enumerable: false,
      configurable: true,
    },
  })
  return p
}

/**
 * Re-establish the invariant that the local player is in the player list.
 */
export function rebindPlayer(world: CombatWorld): CombatWorld {
  world.players = [world.player]
  return world
}

function nearestTarget(monster: Monster, targets: readonly CombatPlayer[]): CombatPlayer | null {
  let best: CombatPlayer | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of targets) {
    if (candidate.alive === false || candidate.hp <= 0) continue
    const distance = Math.hypot(candidate.x - monster.x, candidate.y - monster.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

/**
 * Place monsters around a point, skipping unwalkable spots.
 */
export function spawnMonsters(
  world: CombatWorld,
  stats: readonly MonsterStats[],
  count: number,
  around: { readonly x: number; readonly y: number },
  spread: number,
  terrain: CombatTerrain,
  seed = 0x6ac690c5,
): number {
  if (stats.length === 0) return 0
  let placed = 0
  let attempt = 0
  while (placed < count && attempt < count * 24) {
    attempt += 1
    const angle = attempt * 2.399963
    const radius = spread * Math.sqrt(attempt / (count * 24))
    const x = around.x + Math.cos(angle) * radius
    const y = around.y + Math.sin(angle) * radius
    if (terrain.overlap(x, y) > 0) continue
    const definition = stats[placed % stats.length]!
    const idx = world.monsters.length
    world.monsters.push({
      index: idx,
      stats: definition,
      x,
      y,
      hp: definition.hp,
      cooldown: 0,
      state: 'idle',
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
      dwInitSeed: (seed ^ Math.imul(idx + 1, 0x9e3779b9)) >>> 0 || 1,
    })
    placed += 1
  }
  return placed
}

function isInsideSafeZone(x: number, y: number, safeZones: readonly SafeZone[] | undefined): boolean {
  if (safeZones === undefined || safeZones.length === 0) return false
  for (const sz of safeZones) {
    if (Math.hypot(x - sz.x, y - sz.y) < sz.radius) return true
  }
  return false
}

/**
 * Place packs, keeping each pack's members together.
 */
export function spawnMonsterPacks(
  world: CombatWorld,
  packs: readonly MonsterPack[],
  around: { readonly x: number; readonly y: number },
  spread: number,
  terrain: CombatTerrain,
  safeZones?: readonly SafeZone[],
  rooms?: readonly MapRoom[],
  seed = 0x6ac690c5,
): number {
  if (rooms !== undefined && rooms.length > 0) {
    const count = spawnMonsterPacksByRooms(
      world,
      packs,
      rooms,
      terrain,
      safeZones !== undefined ? { safeZones } : undefined,
    )
    for (const m of world.monsters) {
      if (m.dwInitSeed === undefined) {
        m.dwInitSeed = (seed ^ Math.imul(m.index + 1, 0x9e3779b9)) >>> 0 || 1
      }
    }
    return count
  }
  if (packs.length === 0) return 0
  let placed = 0
  let campIndex = 0
  let attempt = 0
  const attemptLimit = packs.length * 32
  while (campIndex < packs.length && attempt < attemptLimit) {
    const pack = packs[campIndex]!
    let campX: number
    let campY: number
    let angle: number

    if (pack.fixedPosition !== undefined) {
      campX = pack.fixedPosition.x
      campY = pack.fixedPosition.y
      angle = campIndex * 2.399963
      if (terrain.overlap(campX, campY) > 0) {
        let foundClear = false
        for (let searchStep = 1; searchStep <= 16; searchStep += 1) {
          const sAngle = searchStep * 2.399963
          const sx = campX + Math.cos(sAngle) * (searchStep * 12)
          const sy = campY + Math.sin(sAngle) * (searchStep * 12)
          if (terrain.overlap(sx, sy) === 0) {
            campX = sx
            campY = sy
            foundClear = true
            break
          }
        }
        if (!foundClear) {
          campIndex += 1
          continue
        }
      }
    } else {
      attempt += 1
      angle = attempt * 2.399963
      const radius = spread * Math.sqrt(attempt / (packs.length * 24))
      campX = around.x + Math.cos(angle) * radius
      campY = around.y + Math.sin(angle) * radius
      if (isInsideSafeZone(campX, campY, safeZones)) continue
      if (terrain.overlap(campX, campY) > 0) continue
    }

    campIndex += 1
    let memberAttempt = 0
    let memberPlaced = 0
    while (memberPlaced < pack.members.length && memberAttempt < pack.members.length * 16) {
      const memberAngle = angle + memberAttempt * 2.399963
      const memberRadius =
        memberAttempt === 0 ? 0 : PACK_RADIUS_PX * Math.sqrt(memberAttempt / (pack.members.length * 12))
      memberAttempt += 1
      const x = campX + Math.cos(memberAngle) * memberRadius
      const y = campY + Math.sin(memberAngle) * memberRadius
      if (pack.fixedPosition === undefined && isInsideSafeZone(x, y, safeZones)) continue
      if (terrain.overlap(x, y) > 0) continue
      const definition = pack.members[memberPlaced]!
      const idx = world.monsters.length
      world.monsters.push({
        index: idx,
        stats: definition,
        x,
        y,
        hp: definition.hp,
        cooldown: 0,
        state: 'idle',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
        dwInitSeed: (seed ^ Math.imul(idx + 1, 0x9e3779b9)) >>> 0 || 1,
      })
      memberPlaced += 1
      placed += 1
    }
  }
  return placed
}

/**
 * Direction index (0 = south, turning west) for a vector.
 */
export function facingOf(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0
  const angle = Math.atan2(-dx, dy)
  return Math.round(angle / (Math.PI / 4) + 8) % 8
}

/**
 * Move a body one tick, sliding along blocked axes.
 */
function moveWithCollision(
  from: { readonly x: number; readonly y: number },
  dx: number,
  dy: number,
  terrain: CombatTerrain,
): { x: number; y: number } {
  let { x, y } = from
  const current = terrain.overlap(x, y)
  if (dx !== 0 && terrain.overlap(x + dx, y) <= current) x += dx
  if (dy !== 0 && terrain.overlap(x, y + dy) <= current) y += dy
  return { x, y }
}

function buildKillEvent(monster: Monster): CombatEvent {
  const rank = monster.stats.rank ?? 'normal'
  const monsterType =
    rank === 'boss' ? 4 : rank === 'unique' || rank === 'minion' ? 3 : rank === 'champion' ? 2 : 1
  return {
    kind: 'kill',
    x: monster.x,
    y: monster.y,
    text: monster.stats.name,
    subjectId: monster.stats.id,
    monsterIndex: monster.index,
    monsterLevel: monster.stats.level,
    monsterRank: monster.stats.rank,
    monsterType,
    superUniqueId: monster.stats.superUniqueId,
  }
}

function collectRawMonsterMods(monster: Monster): (number | string)[] {
  const rawMods: (number | string)[] = []
  const extraUmods = monster as unknown as {
    readonly umods?: readonly (number | string)[]
    readonly modifiers?: readonly (number | string)[]
    readonly mods?: readonly (number | string)[]
    readonly bossMods?: readonly (number | string)[]
    readonly monUMods?: readonly (number | string)[]
    readonly stats?: {
      readonly umods?: readonly (number | string)[]
      readonly modifiers?: readonly (number | string)[]
      readonly mods?: readonly (number | string)[]
      readonly bossMods?: readonly (number | string)[]
      readonly monUMods?: readonly (number | string)[]
    }
  }
  const lists = [
    monster.stats?.modifiers,
    extraUmods.stats?.umods,
    extraUmods.stats?.mods,
    extraUmods.stats?.bossMods,
    extraUmods.stats?.monUMods,
    extraUmods.umods,
    extraUmods.modifiers,
    extraUmods.mods,
    extraUmods.bossMods,
    extraUmods.monUMods,
  ]
  for (const list of lists) {
    if (!list) continue
    for (const m of list) {
      rawMods.push(typeof m === 'string' ? m.replace(/_/g, ' ') : m)
    }
  }
  return rawMods
}

export function damageMonster(
  world: CombatWorld,
  monsterIndexOrMonster: number | Monster,
  amount: number,
  attacker: CombatPlayer | string = world.player,
): boolean {
  const realAttacker = typeof attacker === 'object' && attacker !== null ? attacker : world.player
  const monster =
    typeof monsterIndexOrMonster === 'number'
      ? (world.monsters.find((m) => m.index === monsterIndexOrMonster) ??
          world.monsters[monsterIndexOrMonster])
      : monsterIndexOrMonster
  if (monster === undefined || monster.state === 'dead') return false
  monster.hp -= amount
  monster.hitFlash = 4
  world.events.push({ kind: 'monsterHit', x: monster.x, y: monster.y, amount })
  if (monster.curse?.name === 'lifetap' && amount > 0 && realAttacker) {
    const heal = Math.floor(amount * 0.5)
    realAttacker.hp = Math.min(realAttacker.maxHp ?? 1000, realAttacker.hp + heal)
  }

  const hcIdx = monster.stats?.hcIdx ?? 0
  const rawMods = collectRawMonsterMods(monster)
  if (
    amount > 0 &&
    (hasMonsterUMod(rawMods, MON_UMOD.LIGHTNING) ||
      hasMonsterUMod(rawMods, MON_UMOD.SCARAB) ||
      isScarabMonster(hcIdx, monster.stats?.id ?? ''))
  ) {
    const bolts = computeChargedBolt8WayVectors(monster.x, monster.y, 12)
    const mlvl = Math.max(1, monster.stats?.level ?? 1)
    const boltDmg = Math.max(1, Math.floor(mlvl * 1.5))
    world.events.push({
      kind: 'unitSkillEvent',
      x: monster.x,
      y: monster.y,
      skillId: 'ChargedBolt',
      monsterIndex: monster.index,
      amount: boltDmg,
      text: '8-way ChargedBolt',
      unitSkillEvent: {
        type: 'UnitSkillEvent',
        flag: 1,
        skill: 38,
        level: Math.max(1, Math.floor(mlvl / 3)),
        caster: { rawUnitType: 1, id: monster.index >>> 0 },
        target: { rawUnitType: 0, id: 1 },
        x: Math.round(bolts[0]?.targetX ?? monster.x),
        y: Math.round(bolts[0]?.targetY ?? monster.y),
      },
    })
    world.events.push({
      kind: 'unitOverlay',
      x: monster.x,
      y: monster.y,
      skillId: '38',
      monsterIndex: monster.index,
      overlayToken: 'chargedbolt_onhit',
      overlayIndex: 38,
      targetUnitType: 1,
      targetUnitId: monster.index >>> 0,
    })
    if (realAttacker && Math.hypot(realAttacker.x - monster.x, realAttacker.y - monster.y) <= 144) {
      const ltngRes = (realAttacker as unknown as { lightningResist?: number }).lightningResist ?? 0
      const effBoltDmg =
        ltngRes >= 100 ? 0 : Math.max(1, Math.round((boltDmg * (100 - ltngRes)) / 100))
      if (effBoltDmg > 0) {
        realAttacker.hp = Math.max(1, realAttacker.hp - effBoltDmg)
      }
    }
  }

  if (monster.hp > 0) return false
  monster.state = 'dead'
  monster.animMode = 'dt'
  monster.corpseTicks = 100
  if ((monster.frozenTicks ?? 0) > 0) {
    monster.shattered = true
    monster.corpseConsumed = true
    monster.corpseSuppressed = true
    monster.corpseTicks = 0
  } else if (
    isBoneFetishMonster(hcIdx, monster.stats.id) ||
    isSuicideMinionMonster(hcIdx, monster.stats.id) ||
    hasMonsterUMod(rawMods, MON_UMOD.GOBOOM) ||
    hasMonsterUMod(rawMods, MON_UMOD.SUICIDE)
  ) {
    monster.corpseSuppressed = true
    monster.corpseConsumed = true
  }
  triggerMonsterDeathAffixes113c(world, monster, realAttacker)
  monster.dropRolled = monster.dropRolled ?? false
  world.kills += 1
  const killEvent = buildKillEvent(monster)
  world.events.push(killEvent)
  if (world.pendingKills !== undefined) {
    world.pendingKills.push(killEvent)
  }
  if (realAttacker) {
    realAttacker.xp += monster.stats.xp
  }
  return true
}

/**
 * Advance the simulation one tick for one player.
 */
export function tickCombat(
  world: CombatWorld,
  input: CombatInput,
  options: CombatOptions,
  terrain: CombatTerrain,
  xpTable: readonly number[],
): void {
  tickCombatMulti(world, [input], options, terrain, xpTable)
}

/**
 * Advance the simulation one tick for several players at once.
 */
export function tickCombatMulti(
  world: CombatWorld,
  inputs: readonly CombatInput[],
  options: CombatOptions,
  terrain: CombatTerrain,
  xpTable: readonly number[],
): void {
  world.tick += 1
  if (!options.preserveEvents) {
    world.events = []
  }
  const targets = world.players.filter((player) => player.alive)
  for (let index = 0; index < inputs.length; index += 1) {
    const player = world.players[index]
    if (player === undefined) continue
    tickPlayer(world, player, inputs[index]!, options, terrain, xpTable)
  }
  if (targets.length > 0) tickMonsters(world, options, terrain, targets)
}

function tickPlayer(
  world: CombatWorld,
  player: CombatPlayer,
  input: CombatInput,
  options: CombatOptions,
  terrain: CombatTerrain,
  xpTable: readonly number[],
): void {
  if (!player.alive) {
    player.respawnIn -= 1
    if (player.respawnIn <= 0) {
      player.alive = true
      player.hp = player.maxHp
      player.mana = player.maxMana
      world.events.push({ kind: 'respawn', x: player.x, y: player.y })
    }
    return
  }

  if (player.cooldown > 0) player.cooldown -= 1
  if (player.swingTicks > 0) player.swingTicks -= 1
  if (player.enchantTicks && player.enchantTicks > 0) {
    player.enchantTicks -= 1
    if (player.enchantTicks <= 0) {
      player.enchantTicks = 0
      player.enchantDamage = undefined
      player.enchantAttackRatingPercent = undefined
    }
  }

  if (player.hpRegenTicksRemaining !== undefined && player.hpRegenTicksRemaining > 0) {
    player.hpRegenTicksRemaining -= 1
    const rate = player.hpRegenRatePerTick ?? 0
    if (rate > 0 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + rate)
    }
    if (player.hpRegenTicksRemaining <= 0) {
      player.hpRegenTicksRemaining = 0
      player.hpRegenRatePerTick = 0
    }
  }
  if (player.manaRegenTicksRemaining !== undefined && player.manaRegenTicksRemaining > 0) {
    player.manaRegenTicksRemaining -= 1
    const rate = player.manaRegenRatePerTick ?? 0
    if (rate > 0 && player.mana < player.maxMana) {
      player.mana = Math.min(player.maxMana, player.mana + rate)
    }
    if (player.manaRegenTicksRemaining <= 0) {
      player.manaRegenTicksRemaining = 0
      player.manaRegenRatePerTick = 0
    }
  }
  if (player.coldResistBonusTicks !== undefined && player.coldResistBonusTicks > 0) {
    player.coldResistBonusTicks -= 1
  }
  if (player.poisonResistBonusTicks !== undefined && player.poisonResistBonusTicks > 0) {
    player.poisonResistBonusTicks -= 1
  }

  if (player.stamina !== undefined && player.maxStamina !== undefined && player.stamina <= 0) {
    player.isRunning = false
  }
  const frwMultiplier = player.blazeTicks && player.blazeTicks > 0 ? 1.3 : 1.0
  const speed = (options.playerSpeed / 25) * frwMultiplier
  const mx = Number.isFinite(input.movement.x) ? input.movement.x : 0
  const my = Number.isFinite(input.movement.y) ? input.movement.y : 0
  const moved = moveWithCollision(player, mx * speed, my * speed, terrain)
  player.x = moved.x
  player.y = moved.y
  const isMoving = mx !== 0 || my !== 0
  player.isMovingThisTick = isMoving
  if (isMoving) {
    player.facing = facingOf(mx, my)
  }
  if (player.stamina !== undefined && player.maxStamina !== undefined) {
    if (isMoving && player.isRunning) {
      player.stamina = Math.max(0, player.stamina - 0.2)
      if (player.stamina <= 0) {
        player.isRunning = false
      }
    } else {
      player.stamina = Math.min(player.maxStamina, player.stamina + (isMoving ? 0.15 : 0.4))
    }
  }

  if (input.attack && player.cooldown === 0) {
    const cost = options.playerManaPerAttack
    if (cost > 0 && player.mana < cost) {
      world.events.push({ kind: 'noMana', x: player.x, y: player.y, text: 'no mana' })
    } else {
      player.mana = Math.max(0, player.mana - cost)
      player.cooldown = options.playerCooldownTicks
      player.swingTicks = Math.max(1, Math.floor(options.playerCooldownTicks / 2))
      let target: Monster | null = null
      let bestDistance = Number.POSITIVE_INFINITY
      for (const monster of world.monsters) {
        if (monster.state === 'dead') continue
        const distance = Math.hypot(monster.x - player.x, monster.y - player.y)
        if (distance <= options.playerReach && distance < bestDistance) {
          bestDistance = distance
          target = monster
        }
      }
      if (target === null) {
        world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
      } else {
        player.facing = facingOf(target.x - player.x, target.y - player.y)
        const basePhysRes =
          (target.stats as any).resistances?.physical ?? (target.stats as any).resists?.physical ?? 0
        let physPierce = 0
        if (target.curse?.name === 'amplifydamage') physPierce = 100
        else if (target.curse?.name === 'decrepify') physPierce = 50
        const physRes = computeEffectiveResistance({ baseRes: basePhysRes, convictionPierce: physPierce, isDefenderPlayer: false })
        let rawPhysDmg = options.playerDamage
        if ((player.criticalStrikeSlvl ?? 0) > 0) {
          const csChancePct = calculateCriticalStrikeStats(player.criticalStrikeSlvl!).chancePct
          const roll = player.passiveRollOverride ?? (world.tick * 37 + target.index * 17) % 100
          if (roll < csChancePct) {
            rawPhysDmg *= 2
          }
        }
        let totalDamage = physRes.isImmune
          ? 0
          : Math.max(0, Math.round((rawPhysDmg * (100 - physRes.effectiveRes)) / 100))
        if (player.enchantTicks && player.enchantTicks > 0 && player.enchantDamage) {
          const enchantRes = calculateEnchantAttackDamage({
            enchantDamage: player.enchantDamage,
            isRanged: player.isRanged,
            isSorceress: player.isSorceress,
            fireMasterySlvl: player.fireMasterySlvl,
            targetFireResist: (target as any).fireResist ?? (target.stats as any).fireResist,
          })
          totalDamage += Math.round(enchantRes.average)
        }
        target.hp -= totalDamage
        target.hitFlash = 4
        world.events.push({ kind: 'monsterHit', x: target.x, y: target.y, amount: totalDamage })
        if (target.curse?.name === 'lifetap' && totalDamage > 0) {
          const heal = Math.floor(totalDamage * 0.5)
          player.hp = Math.min(player.maxHp, player.hp + heal)
        }
        if (target.hp <= 0) {
          const targetHcIdx = target.stats?.hcIdx ?? 0
          target.state = 'dead'
          target.animMode = 'dt'
          target.corpseTicks = 100
          if ((target.frozenTicks ?? 0) > 0) {
            target.shattered = true
            target.corpseConsumed = true
            target.corpseSuppressed = true
            target.corpseTicks = 0
          } else if (
            isBoneFetishMonster(targetHcIdx, target.stats.id) ||
            isSuicideMinionMonster(targetHcIdx, target.stats.id) ||
            hasMonsterUMod(target.stats.modifiers, MON_UMOD.GOBOOM) ||
            hasMonsterUMod(target.stats.modifiers, MON_UMOD.SUICIDE)
          ) {
            target.corpseSuppressed = true
            target.corpseConsumed = true
          }
          triggerMonsterDeathAffixes113c(world, target, player)
          target.dropRolled = target.dropRolled ?? false
          world.kills += 1
          const killEvent = buildKillEvent(target)
          world.events.push(killEvent)
          if (world.pendingKills !== undefined) {
            world.pendingKills.push(killEvent)
          }
          player.xp += target.stats.xp
        }
      }
    }
  }

  while (
    xpTable &&
    player.level + 1 < xpTable.length &&
    player.xp >= (xpTable[player.level + 1] ?? Number.POSITIVE_INFINITY)
  ) {
    player.level += 1
    const cStats = CANONICAL_CHARSTATS[player.classCode ?? 'sor']
    const hpGain = Math.floor(cStats.perLevel.life)
    const manaGain = Math.floor(cStats.perLevel.mana)
    const staminaGain = Math.floor(cStats.perLevel.stamina)
    const statPtsGain = cStats.perLevel.statPoints
    player.maxHp += hpGain
    player.maxMana += manaGain
    player.maxStamina = (player.maxStamina ?? cStats.baseVitals.stamina) + staminaGain
    player.stamina = player.maxStamina
    player.statPoints = (player.statPoints ?? 0) + statPtsGain
    player.skillPoints = (player.skillPoints ?? 0) + 1
    player.hp = player.maxHp
    player.mana = player.maxMana
    world.events.push({ kind: 'levelUp', x: player.x, y: player.y, text: `level ${String(player.level)}` })
  }
}

const STATIONARY_AI_SET: ReadonlySet<string> = new Set([
  'GargoyleTrap',
  'BloodHawkNest',
  'FoulCrowNest',
  'SuckerNest',
  'MaggotQueen',
  'EvilHut',
  'Trap',
  'LightningSpire',
  'FireTower',
  'BonePrison',
  'BoneWall',
  'Idle',
  'Nest',
  'MosquitoNest',
  'MaggotEgg',
  'Sarcophagus',
  'Catapult',
  'FrozenHorror',
  'Tower',
  'ArcaneTower',
  'SiegeTower',
  'Tentacle',
  'TentacleHead',
  'PutridDefiler',
  'PainWorm',
  'BaalTentacle',
  'StaticTraps',
  'Turret',
  'Window',
])

const STATIONARY_VELOCITY_ZERO_HCIDX: ReadonlySet<number> = new Set([
  190, 217, 228, 258, 259, 260, 261, 262, 263, 320, 321, 322, 323, 324, 325,
  334, 335, 336, 337, 351, 352, 353, 369, 370, 371, 372, 410, 411, 412, 413,
  414, 415, 416, 432, 433, 434, 435, 497, 498, 499, 500, 524, 525, 527, 534,
  551, 552, 553, 554, 555, 562, 563, 564, 565, 566,
])

const NON_AGGRESSIVE_AI_SET: ReadonlySet<string> = new Set([
  'Idle',
  'Npc',
  'TownNpc',
  'Vendor',
  'NpcOutOfTown',
  'NpcStationary',
  'NpcBarb',
  'GoodNpcRanged',
  'Navi',
  'CagedWussie',
  'AncientStatue',
  'BonePrison',
])

const RANGED_KITER_AI_SET: ReadonlySet<string> = new Set([
  'SkeletonBow',
  'SkeletonArcher',
  'RogueArcher',
  'CorruptRogueArcher',
  'QuillRat',
  'GoatArcher',
  'GoatmanArcher',
  'Slinger',
  'Blowpiper',
  'FetishBlow',
  'BigHead',
])

const AURA_ENCHANTED_PALADIN_AURAS = [
  'might',
  'holyfire',
  'thorns',
  'holyfreeze',
  'holyshock',
  'conviction',
  'fanaticism',
] as const

function isStationaryMonster(monster: Monster): boolean {
  const ai = (monster.stats?.ai ?? '').trim()
  // Shared MonAi profile table (#1341): every MonAi row has one authoritative
  // family. Fall through to the legacy alias/hcIdx rules for harness-only names.
  if (findMonaiProfile113c(ai)?.family === 'stationary') return true
  if (STATIONARY_AI_SET.has(ai)) return true
  if (ai === 'Frenzy' || ai === 'Minotaur' || ai === 'DeathLord' || ai === 'BloodLord') return false
  const hc = monster.stats?.hcIdx
  if (hc !== undefined && STATIONARY_VELOCITY_ZERO_HCIDX.has(hc)) return true
  if (monster.stats?.speed === 0) return true
  return false
}

function isRangedKiterMonster(monster: Monster): boolean {
  const ai = (monster.stats?.ai ?? '').trim()
  if (findMonaiProfile113c(ai)?.family === 'kiter') return true
  if (RANGED_KITER_AI_SET.has(ai)) return true
  if (monster.stats?.isRanged === true && !isStationaryMonster(monster)) {
    const nonKiterCasters = new Set([
      'FallenShaman',
      'FetishShaman',
      'GreaterMummy',
      'Unraveler',
      'ZakarumPriest',
      'OblivionKnight',
      'Vampire',
      'WillOWisp',
      'Willowisp',
      'Succubus',
      'CouncilMember',
      'Andariel',
      'Duriel',
      'Mephisto',
      'Diablo',
      'Baal',
      'Radament',
      'BloodRaven',
      'Summoner',
      'Izual',
      'Nihlathak',
    ])
    if (!nonKiterCasters.has(ai)) return true
  }
  const hc = monster.stats?.hcIdx
  if (hc !== undefined) {
    if (
      (hc >= 10 && hc <= 14) ||
      (hc >= 43 && hc <= 51 && hc !== 45) ||
      (hc >= 63 && hc <= 67) ||
      (hc >= 122 && hc <= 125) ||
      (hc >= 141 && hc <= 145)
    ) {
      return true
    }
  }
  return false
}

export function isActBossMonster(monster: Monster): boolean {
  const monAny = monster as unknown as {
    readonly id?: string | number
    readonly name?: string
    readonly ai?: string
    readonly hcIdx?: number
    readonly classId?: number
    readonly superUniqueId?: string
  }
  const hc = monster.stats?.hcIdx ?? monAny.hcIdx ?? monAny.classId ?? -1
  if (
    hc === 2 ||
    hc === 39 ||
    hc === 45 ||
    hc === 156 ||
    hc === 211 ||
    hc === 229 ||
    hc === 242 ||
    hc === 243 ||
    hc === 250 ||
    hc === 256 ||
    hc === 267 ||
    hc === 345 ||
    hc === 346 ||
    hc === 347 ||
    hc === 402 ||
    hc === 409 ||
    hc === 479 ||
    hc === 526 ||
    hc === 540 ||
    hc === 541 ||
    hc === 542 ||
    hc === 544 ||
    hc === 706
  ) {
    return true
  }
  const combined = `${monster.stats?.ai ?? ''} ${monAny.ai ?? ''} ${monster.stats?.id ?? ''} ${monAny.id ?? ''} ${monster.stats?.name ?? ''} ${monAny.name ?? ''} ${monster.stats?.superUniqueId ?? ''} ${monAny.superUniqueId ?? ''}`
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (
    combined.includes('andariel') ||
    combined.includes('duriel') ||
    combined.includes('mephisto') ||
    combined.includes('diablo') ||
    combined.includes('baal') ||
    combined.includes('radament') ||
    combined.includes('bloodraven') ||
    combined.includes('summoner') ||
    combined.includes('izual') ||
    combined.includes('nihlathak') ||
    combined.includes('countess') ||
    combined.includes('corruptrogue3') ||
    combined.includes('smith') ||
    combined.includes('council') ||
    combined.includes('ismail') ||
    combined.includes('geleb') ||
    combined.includes('toorc') ||
    combined.includes('bremm') ||
    combined.includes('wyand') ||
    combined.includes('maffer') ||
    combined.includes('hephasto') ||
    combined.includes('shenk') ||
    combined.includes('overseer') ||
    combined.includes('talic') ||
    combined.includes('madawc') ||
    combined.includes('korlic') ||
    combined.includes('ancientbarb') ||
    combined.includes('cowking') ||
    combined.includes('hellbovine')
  ) {
    return true
  }
  return false
}

function stepMonsterVector(
  monster: Monster,
  vx: number,
  vy: number,
  vlen: number,
  terrain: CombatTerrain,
  rawMods: readonly (number | string)[],
  speedMultiplier = 1,
): void {
  if (isStationaryMonster(monster) || vlen <= 0) return
  const chillFactor = monster.chillTicks !== undefined && monster.chillTicks > 0 ? 0.5 : 1
  const decrepFactor = monster.curse?.name === 'decrepify' ? 0.5 : 1
  const extraFastFactor = hasMonsterUMod(rawMods, MON_UMOD.FAST) ? 1.5 : 1
  const frenzyFactor =
    (monster.frenzyStacks ?? 0) > 0 ? 1 + Math.min(8, monster.frenzyStacks!) * 0.08 : 1
  const step =
    (monster.stats.speed / 25) *
    chillFactor *
    decrepFactor *
    extraFastFactor *
    frenzyFactor *
    speedMultiplier
  const moved = moveWithCollision(monster, (vx / vlen) * step, (vy / vlen) * step, terrain)
  monster.x = moved.x
  monster.y = moved.y
}

function applyMonsterAttackToPlayer(
  world: CombatWorld,
  monster: Monster,
  player: CombatPlayer,
  options: Partial<CombatOptions>,
  isRanged: boolean,
  rawMods: readonly (number | string)[],
  overrideBaseDamage?: number,
): void {
  let dmg = overrideBaseDamage ?? monster.stats.damage
  const frenzyStacks = Math.min(8, Math.max(0, monster.frenzyStacks ?? 0))
  if (frenzyStacks > 0 && dmg > 0) {
    dmg = Math.max(dmg + frenzyStacks, Math.floor(dmg * (1 + frenzyStacks * 0.1)))
  }
  if (monster.curse?.name === 'weaken') dmg = Math.floor(dmg * 0.67)
  if (monster.curse?.name === 'decrepify') dmg = Math.floor(dmg * 0.5)

  if (player.isMovingThisTick && (player.evadeSlvl ?? 0) > 0) {
    const evadeChance = calculateEvadeStats(player.evadeSlvl!).chancePct
    const roll = player.passiveRollOverride ?? (world.tick * 37 + monster.index * 17) % 100
    if (roll < evadeChance) {
      world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'evade' })
      return
    }
  } else if (!player.isMovingThisTick) {
    if (!isRanged && (player.dodgeSlvl ?? 0) > 0) {
      const dodgeChance = calculateDodgeStats(player.dodgeSlvl!).chancePct
      const roll = player.passiveRollOverride ?? (world.tick * 37 + monster.index * 17) % 100
      if (roll < dodgeChance) {
        player.swingTicks = Math.max(player.swingTicks ?? 0, 8)
        world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'dodge' })
        return
      }
    } else if (isRanged && (player.avoidSlvl ?? 0) > 0) {
      const avoidChance = calculateAvoidStats(player.avoidSlvl!).chancePct
      const roll = player.passiveRollOverride ?? (world.tick * 37 + monster.index * 17) % 100
      if (roll < avoidChance) {
        player.swingTicks = Math.max(player.swingTicks ?? 0, 8)
        world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'avoid' })
        return
      }
    }
  }

  if (monster.curse?.name === 'ironmaiden' && !isRanged && dmg > 0) {
    const returnPct = monster.curse.returnPct ?? 200 + (monster.curse.slvl - 1) * 25
    const physRes = monster.stats.resistances?.physical ?? monster.stats.resists?.physical ?? 0
    const rawReflect = Math.floor((dmg * returnPct) / 100)
    const effReflect = physRes >= 100 ? 0 : Math.max(0, Math.floor((rawReflect * (100 - physRes)) / 100))
    if (effReflect > 0) {
      damageMonster(world, monster.index, effReflect, player)
    }
  }

  if (!isRanged && player.coldArmorType === 'shiverarmor') {
    const slvl = player.coldArmorSlvl ?? 1
    const dmgRange = calculateShiverArmorDamage(slvl)
    const coldDmg = Math.round((dmgRange.min + dmgRange.max) / 2)
    damageMonster(world, monster.index, coldDmg, player)
    const chillFrames = calculateShiverArmorChillLength(slvl)
    monster.chillTicks = Math.max(monster.chillTicks ?? 0, chillFrames)
    const unitOverlayPayload = {
      type: 'UnitOverlay' as const,
      rawUnitType: 1,
      id: monster.index >>> 0,
      overlayIndex: OVERLAY_INDEX_SHIVER_ARMOR_HIT,
    }
    world.events.push({
      kind: 'unitOverlay',
      x: monster.x,
      y: monster.y,
      skillId: '50',
      monsterIndex: monster.index,
      overlayToken: 'shiverarmor_hit',
      overlayIndex: OVERLAY_INDEX_SHIVER_ARMOR_HIT,
      targetUnitType: 1,
      targetUnitId: monster.index >>> 0,
      packet0x11: encode0x11UnitOverlay(unitOverlayPayload),
      unitOverlay: unitOverlayPayload,
    })
  }

  if (isRanged && player.coldArmorType === 'chillingarmor') {
    const slvl = player.coldArmorSlvl ?? 1
    const dmgRange = calculateChillingArmorDamage(slvl)
    const boltDmg = Math.round((dmgRange.min + dmgRange.max) / 2)
    world.events.push({
      kind: 'missileHit',
      x: player.x,
      y: player.y,
      missileType: 'chillingarmorbolt',
      skillId: '60',
      amount: boltDmg,
      monsterIndex: monster.index,
    })
    damageMonster(world, monster.index, boltDmg, player)
    const chillFrames = calculateChillingArmorChillLength(slvl)
    monster.chillTicks = Math.max(monster.chillTicks ?? 0, chillFrames)
  }

  if (monster.hp <= 0) {
    return
  }

  // On-hit MonUMod effects: Cursed (#7), ManaBurn (#25), ColdEnchanted (#18), Freeze (#43), PoisonHit (#23), SpectralHit (#27)
  if (hasMonsterUMod(rawMods, MON_UMOD.CURSE)) {
    player.curse = {
      id: 'amplify_damage',
      name: 'amplifydamage',
      slvl: Math.max(1, Math.floor((monster.stats?.level ?? 1) / 5)),
      sourceUnitId: monster.index,
      remainingTicks: 250,
      ticksRemaining: 250,
    }
    world.events.push({
      kind: 'unitOverlay',
      x: player.x,
      y: player.y,
      skillId: '66',
      monsterIndex: monster.index,
      overlayIndex: 58,
      text: 'amplifydamage',
    })
  }
  if (hasMonsterUMod(rawMods, MON_UMOD.COLD)) {
    player.chillTicks = Math.max(player.chillTicks ?? 0, 75)
  }
  if (hasMonsterUMod(rawMods, MON_UMOD.FREEZE)) {
    player.frozenTicks = Math.max(player.frozenTicks ?? 0, 50)
  }
  if (hasMonsterUMod(rawMods, MON_UMOD.MANahit)) {
    const manaDrain = Math.max(4, dmg * 4)
    player.mana = Math.max(0, player.mana - manaDrain)
  }
  if (hasMonsterUMod(rawMods, MON_UMOD.SPECTRALHIT)) {
    const spectralElements = ['fire', 'lightning', 'cold', 'poison', 'magic'] as const
    const elem = spectralElements[Math.abs((world.tick >>> 0) + (monster.index >>> 0)) % spectralElements.length]!
    const spectralBonus = Math.max(2, Math.floor(dmg * 0.66))
    dmg += spectralBonus
    if (elem === 'cold') {
      player.chillTicks = Math.max(player.chillTicks ?? 0, 50)
    }
  }

  // Innate elemental/drain on-hit effects (Swarm stamina drain, BatDemon/Vampire life/mana drain, WillOWisp mana drain)
  const ai = (monster.stats?.ai ?? '').trim()
  if (ai === 'Swarm' && player.stamina !== undefined) {
    player.stamina = Math.max(0, player.stamina - Math.max(2, Math.floor(dmg * 0.5)))
  } else if (ai === 'WillOWisp' || ai === 'Willowisp') {
    player.mana = Math.max(0, player.mana - Math.max(2, Math.floor(dmg * 0.5)))
  } else if (ai === 'Vampire' || ai === 'BatDemon') {
    monster.hp = Math.min(monster.stats.hp, monster.hp + Math.max(1, Math.floor(dmg * 0.5)))
  }

  if (player.energyshieldTicks && player.energyshieldTicks > 0 && player.mana > 0) {
    const absorbPct = player.energyshieldPct ?? 20
    const absorbed = Math.floor((dmg * absorbPct) / 100)
    const ratio = 2.0
    const manaNeeded = Math.ceil(absorbed * ratio)
    let actualAbsorbed = 0
    if (player.mana >= manaNeeded) {
      player.mana -= manaNeeded
      dmg -= absorbed
      actualAbsorbed = absorbed
    } else {
      actualAbsorbed = Math.floor(player.mana / ratio)
      player.mana = 0
      dmg -= actualAbsorbed
      player.energyshieldTicks = 0
    }
    if (actualAbsorbed > 0) {
      const esHit = computeEnergyShieldHitOverlay113c(player.x, player.y, monster.x, monster.y)
      const playerId = Number((player as unknown as { id?: number }).id ?? 1) >>> 0
      const unitOverlayPayload = {
        type: 'UnitOverlay' as const,
        rawUnitType: 0,
        id: playerId,
        overlayIndex: esHit.overlayIndex,
      }
      world.events.push({
        kind: 'unitOverlay',
        x: player.x,
        y: player.y,
        skillId: '58',
        monsterIndex: monster.index,
        overlayToken: esHit.overlayToken,
        overlayIndex: esHit.overlayIndex,
        targetUnitType: 0,
        targetUnitId: playerId,
        packet0x11: encode0x11UnitOverlay(unitOverlayPayload),
        unitOverlay: unitOverlayPayload,
      })
    }
  }
  player.hp -= dmg
  world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: dmg })

  if (!isRanged && player.coldArmorType === 'frozenarmor' && dmg > 0) {
    const slvl = player.coldArmorSlvl ?? 1
    const freezeFrames = calculateFrozenArmorFreezeLength(slvl)
    monster.frozenTicks = Math.max(monster.frozenTicks ?? 0, freezeFrames)
    const unitOverlayPayload = {
      type: 'UnitOverlay' as const,
      rawUnitType: 1,
      id: monster.index >>> 0,
      overlayIndex: OVERLAY_INDEX_FROZEN_ARMOR_HIT,
    }
    world.events.push({
      kind: 'unitOverlay',
      x: monster.x,
      y: monster.y,
      skillId: '40',
      monsterIndex: monster.index,
      overlayToken: 'frozenarmor_hit',
      overlayIndex: OVERLAY_INDEX_FROZEN_ARMOR_HIT,
      targetUnitType: 1,
      targetUnitId: monster.index >>> 0,
      packet0x11: encode0x11UnitOverlay(unitOverlayPayload),
      unitOverlay: unitOverlayPayload,
    })
  }

  if (player.hp <= 0) {
    player.hp = 0
    player.alive = false
    player.respawnIn = options.respawnTicks ?? 50
    world.events.push({ kind: 'playerDeath', x: player.x, y: player.y, text: 'you died' })
  }
}

/**
 * The monsters' turn: notice, close in, strike. Corpses decay.
 */
export function tickMonsters(
  world: CombatWorld,
  optionsOrTerrain: Partial<CombatOptions> | CombatTerrain = {},
  maybeTerrain?: CombatTerrain,
  maybeTargets?: readonly CombatPlayer[],
): void {
  const isSecondArgTerrain =
    typeof (optionsOrTerrain as CombatTerrain)?.overlap === 'function'
  const options: Partial<CombatOptions> = isSecondArgTerrain ? {} : (optionsOrTerrain as Partial<CombatOptions>)
  const terrain: CombatTerrain = isSecondArgTerrain
    ? (optionsOrTerrain as CombatTerrain)
    : (maybeTerrain ?? { overlap: () => 0 })
  const targets: readonly CombatPlayer[] =
    maybeTargets ?? (world.players && world.players.length > 0 ? world.players : [world.player])
  for (const monster of world.monsters) {
    if (monster.sleeping) continue
    if (monster.state === 'dead' || monster.hp <= 0) {
      monster.state = 'dead'
      if (monster.corpseTicks > 0) monster.corpseTicks -= 1
      continue
    }

    const effectiveAlign = monster.align ?? monster.stats?.align ?? 0
    const aiName = (monster.stats?.ai ?? '').trim()
    if (
      effectiveAlign !== 0 ||
      NON_AGGRESSIVE_AI_SET.has(aiName) ||
      monster.stats?.inTown === true ||
      (monster as { inTown?: boolean }).inTown === true ||
      monster.stats?.killable === false
    ) {
      ;(monster as { targetPlayerId?: number | undefined }).targetPlayerId = undefined
      monster.state = 'idle'
      ;(monster as { mode?: number }).mode = 1
      monster.animMode = 'nu'
      continue
    }

    if (monster.hitFlash > 0) monster.hitFlash -= 1
    if (monster.cooldown > 0) monster.cooldown -= 1
    if (monster.aiCooldownTicks !== undefined && monster.aiCooldownTicks > 0) {
      monster.aiCooldownTicks -= 1
    }
    if (monster.aiPhaseTicks !== undefined && monster.aiPhaseTicks > 0) {
      monster.aiPhaseTicks -= 1
    }
    if (monster.innerSightTicks !== undefined && monster.innerSightTicks > 0) {
      monster.innerSightTicks -= 1
      if (monster.innerSightTicks <= 0) {
        monster.innerSightTicks = 0
        monster.innerSightDefReduction = undefined
      }
    }
    if (monster.slowMissilesTicks !== undefined && monster.slowMissilesTicks > 0) {
      monster.slowMissilesTicks -= 1
      if (monster.slowMissilesTicks <= 0) {
        monster.slowMissilesTicks = 0
        monster.slowMissilesMult = undefined
      }
    }
    if (monster.frozenTicks !== undefined && monster.frozenTicks > 0) {
      monster.frozenTicks -= 1
      monster.state = 'idle'
      continue
    }
    if (monster.stunTicks !== undefined && monster.stunTicks > 0) {
      monster.stunTicks -= 1
      monster.state = 'idle'
      continue
    }
    if (monster.chillTicks !== undefined && monster.chillTicks > 0) {
      monster.chillTicks -= 1
    }
    if (monster.poisonTicks !== undefined && monster.poisonTicks > 0) {
      monster.poisonTicks -= 1
      if (world.tick % 5 === 0 && monster.hp > 1) {
        monster.hp -= 1
      }
    } else if (
      monster.stats?.damageRegen !== undefined &&
      monster.stats.damageRegen > 0 &&
      monster.hp > 0 &&
      monster.hp < monster.stats.hp &&
      world.tick > 0 &&
      world.tick % 25 === 0
    ) {
      const regenStep = Math.max(1, Math.floor((monster.stats.hp * monster.stats.damageRegen) / 4096))
      monster.hp = Math.min(monster.stats.hp, monster.hp + regenStep)
    }

    if (monster.curse !== undefined && monster.curse.ticksRemaining > 0) {
      monster.curse.ticksRemaining -= 1
      if (monster.curse.ticksRemaining <= 0) {
        monster.curse = undefined
      }
    }

    const rawMods = collectRawMonsterMods(monster)
    if (hasMonsterUMod(rawMods, MON_UMOD.AURA)) {
      const auraName =
        AURA_ENCHANTED_PALADIN_AURAS[((monster.dwInitSeed ?? monster.index) >>> 0) % AURA_ENCHANTED_PALADIN_AURAS.length]!
      const monAuraState = monster as unknown as {
        activeAura?: string
        aura?: string
        _auraEmitted?: boolean
      }
      monAuraState.activeAura = auraName
      monAuraState.aura = auraName
      if (world.tick % 50 === 0 || !monAuraState._auraEmitted) {
        monAuraState._auraEmitted = true
        world.events.push({
          kind: 'unitOverlay',
          x: monster.x,
          y: monster.y,
          monsterIndex: monster.index,
          overlayIndex: 100,
          text: auraName,
        })
      }
    }
    if (
      hasMonsterUMod(rawMods, MON_UMOD.TELEPORT) &&
      monster.hp < monster.stats.hp * 0.33 &&
      (monster.aiCooldownTicks ?? 0) === 0
    ) {
      const blinkX = monster.x + 48
      const blinkY = monster.y - 32
      if (terrain.overlap(blinkX, blinkY) === 0) {
        monster.x = blinkX
        monster.y = blinkY
      }
      monster.hp = Math.min(monster.stats.hp, monster.hp + Math.max(1, Math.floor(monster.stats.hp * 0.2)))
      monster.aiCooldownTicks = 75
      world.events.push({
        kind: 'unitSkillEvent',
        x: monster.x,
        y: monster.y,
        skillId: 'Teleport',
        monsterIndex: monster.index,
      })
    }

    if (options.disableMonsterAggro) {
      monster.state = 'idle'
      continue
    }

    const player = nearestTarget(monster, targets)
    if (player === null) {
      monster.state = 'idle'
      monster.animMode = 'nu'
      continue
    }

    const stationary = isStationaryMonster(monster)

    if (monster.curse?.name === 'terror') {
      const fleeFromX = monster.curse.casterX ?? player.x
      const fleeFromY = monster.curse.casterY ?? player.y
      const fdx = monster.x - fleeFromX
      const fdy = monster.y - fleeFromY
      const flen = Math.hypot(fdx, fdy) || 1
      monster.facing = facingOf(fdx, fdy)
      stepMonsterVector(monster, fdx, fdy, flen, terrain, rawMods, 1)
      monster.state = 'chase'
      monster.animMode = 'wl'
      continue
    }

    if (monster.fleeTicks !== undefined && monster.fleeTicks > 0) {
      monster.fleeTicks -= 1
      const fdx = monster.x - player.x
      const fdy = monster.y - player.y
      const flen = Math.hypot(fdx, fdy) || 1
      monster.facing = facingOf(fdx, fdy)
      stepMonsterVector(monster, fdx, fdy, flen, terrain, rawMods, 1)
      monster.state = 'chase'
      monster.animMode = 'wl'
      continue
    }

    const sightRadius = monster.curse?.name === 'dimvision' ? 40 : monster.stats.aggroRadius

    let targetMonster: Monster | null = null
    let bestTargetDist = sightRadius
    for (const other of world.monsters) {
      if (other.index === monster.index || other.state === 'dead' || other.hp <= 0) continue
      if (other.curse?.name === 'attract') {
        const d = Math.hypot(other.x - monster.x, other.y - monster.y)
        if (d <= bestTargetDist) {
          bestTargetDist = d
          targetMonster = other
        }
      }
    }
    if (monster.curse?.name === 'confuse' && targetMonster === null) {
      for (const other of world.monsters) {
        if (other.index === monster.index || other.state === 'dead' || other.hp <= 0) continue
        const d = Math.hypot(other.x - monster.x, other.y - monster.y)
        if (d <= bestTargetDist) {
          bestTargetDist = d
          targetMonster = other
        }
      }
    }

    if (targetMonster !== null) {
      const mdx = targetMonster.x - monster.x
      const mdy = targetMonster.y - monster.y
      const mdist = Math.hypot(mdx, mdy)
      monster.facing = facingOf(mdx, mdy)
      if (mdist <= monster.stats.reach) {
        monster.state = 'attack'
        if (monster.cooldown === 0) {
          monster.cooldown =
            monster.curse?.name === 'decrepify' ? monster.stats.cooldownTicks * 2 : monster.stats.cooldownTicks
          let dmg = monster.stats.damage
          if (monster.curse?.name === 'weaken') dmg = Math.floor(dmg * 0.67)
          if (monster.curse?.name === 'decrepify') dmg = Math.floor(dmg * 0.5)
          damageMonster(world, targetMonster.index, dmg, player)
        }
        continue
      }
      monster.state = 'chase'
      stepMonsterVector(monster, mdx, mdy, mdist || 1, terrain, rawMods, 1)
      continue
    }

    const dx = player.x - monster.x
    const dy = player.y - monster.y
    const distance = Math.hypot(dx, dy)

    if (distance > sightRadius) {
      monster.state = 'idle'
      continue
    }
    if (monster.curse?.name === 'dimvision' && (monster.stats.reach > 40 || monster.stats.isRanged)) {
      monster.state = 'idle'
      continue
    }
    monster.facing = facingOf(dx, dy)

    const hcIdx = monster.stats?.hcIdx ?? -1
    const idLower = (monster.stats?.id ?? '').toLowerCase()

    // --- R2.5 SuicideMinion sprint & 0-XP self-detonation ---
    if (aiName === 'SuicideMinion' || isSuicideMinionMonster(hcIdx >= 0 ? hcIdx : 0, monster.stats.id)) {
      const detonateReach = Math.max(monster.stats.reach, 18)
      if (distance <= detonateReach) {
        monster.hp = 0
        monster.state = 'dead'
        monster.animMode = 'dt'
        monster.corpseTicks = 0
        monster.corpseSuppressed = true
        monster.corpseConsumed = true
        triggerMonsterDeathAffixes113c(world, monster, player)
        continue
      }
      monster.state = 'chase'
      monster.animMode = 'rn'
      stepMonsterVector(monster, dx, dy, distance || 1, terrain, rawMods, 1.5)
      continue
    }

    // --- R2.3 Resurrectors & Healers (FallenShaman, FetishShaman, GreaterMummy, ZakarumPriest) ---
    if (aiName === 'FallenShaman' || /fallenshaman/i.test(idLower)) {
      if (monster.cooldown === 0) {
        const revived = executeShamanResurrect113c(world, monster, sightRadius)
        if (revived !== null) {
          continue
        }
        monster.state = 'attack'
        monster.animMode = 'a2'
        monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
        world.events.push({
          kind: 'missileHit',
          x: player.x,
          y: player.y,
          missileType: 'fireball',
          skillId: '47',
          amount: monster.stats.damage,
          monsterIndex: monster.index,
        })
        applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
      } else {
        monster.state = 'attack'
      }
      continue
    }

    if (aiName === 'FetishShaman' || /fetishshaman/i.test(idLower) || (hcIdx >= 136 && hcIdx <= 140)) {
      if (monster.cooldown === 0) {
        const revived = executeShamanResurrect113c(world, monster, sightRadius)
        if (revived !== null) {
          continue
        }
        monster.state = 'attack'
        monster.animMode = 's1'
        monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
        world.events.push({
          kind: 'missileHit',
          x: player.x,
          y: player.y,
          missileType: 'infernoflame1',
          skillId: '41',
          amount: monster.stats.damage,
          monsterIndex: monster.index,
        })
        applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
      } else {
        monster.state = 'attack'
      }
      continue
    }

    if (aiName === 'GreaterMummy' || aiName === 'Unraveler' || /unraveler|greatermummy/i.test(idLower)) {
      if (monster.cooldown === 0) {
        const revived = executeShamanResurrect113c(world, monster, sightRadius)
        if (revived !== null) {
          continue
        }
        let healedAlly = false
        for (const ally of world.monsters) {
          if (ally.index === monster.index || ally.state === 'dead' || ally.hp <= 0) continue
          if (ally.hp < ally.stats.hp && Math.hypot(ally.x - monster.x, ally.y - monster.y) <= 320) {
            ally.hp = Math.min(ally.stats.hp, ally.hp + Math.max(10, Math.floor(ally.stats.hp * 0.25)))
            monster.state = 'attack'
            monster.animMode = 's1'
            monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
            world.events.push({
              kind: 'unitSkillEvent',
              x: ally.x,
              y: ally.y,
              skillId: 'HealOther',
              monsterIndex: monster.index,
            })
            healedAlly = true
            break
          }
        }
        if (healedAlly) continue

        monster.state = 'attack'
        monster.animMode = 'a2'
        monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
        world.events.push({
          kind: 'missileHit',
          x: player.x,
          y: player.y,
          missileType: 'unholybolt1',
          skillId: 'unholybolt',
          amount: monster.stats.damage,
          monsterIndex: monster.index,
        })
        applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
      } else {
        monster.state = 'attack'
      }
      continue
    }

    if (aiName === 'ZakarumPriest' || /zakarumpriest|cantor/i.test(idLower)) {
      if ((distance < 64 || monster.hp < monster.stats.hp * 0.5) && !stationary) {
        stepMonsterVector(monster, -dx, -dy, distance || 1, terrain, rawMods, 1.2)
        monster.hp = Math.min(monster.stats.hp, monster.hp + Math.max(4, Math.floor(monster.stats.hp * 0.1)))
      }
      if (monster.cooldown === 0) {
        let healedAlly = false
        for (const ally of world.monsters) {
          if (ally.index === monster.index || ally.state === 'dead' || ally.hp <= 0) continue
          if (ally.hp < ally.stats.hp && Math.hypot(ally.x - monster.x, ally.y - monster.y) <= 320) {
            ally.hp = Math.min(ally.stats.hp, ally.hp + Math.max(12, Math.floor(ally.stats.hp * 0.3)))
            monster.state = 'attack'
            monster.animMode = 's1'
            monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
            world.events.push({
              kind: 'unitSkillEvent',
              x: ally.x,
              y: ally.y,
              skillId: 'HealOther',
              monsterIndex: monster.index,
            })
            healedAlly = true
            break
          }
        }
        if (healedAlly) continue

        monster.state = 'attack'
        monster.animMode = 's1'
        monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
        const priestSkill = (world.tick + monster.index) % 2 === 0 ? 'lightning' : 'blizzard'
        world.events.push({
          kind: 'unitSkillEvent',
          x: player.x,
          y: player.y,
          skillId: priestSkill,
          monsterIndex: monster.index,
        })
        applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
      } else {
        monster.state = 'attack'
      }
      continue
    }

    // --- R2.5 Casters & Cursers (OblivionKnight, Vampire, WillOWisp, Succubus, CouncilMember, Overseer) ---
    if (aiName === 'OblivionKnight' || /oblivionknight/i.test(idLower)) {
      if (distance < 56 && !stationary) {
        stepMonsterVector(monster, -dx, -dy, distance || 1, terrain, rawMods, 1)
      }
      if (monster.cooldown === 0) {
        if (!player.curse || (world.tick + monster.index) % 2 === 0) {
          executeOblivionKnightCurse113c(world, monster, player, Math.max(1, Math.floor((monster.stats.level ?? 1) / 4)))
        } else {
          monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
          world.events.push({
            kind: 'missileHit',
            x: player.x,
            y: player.y,
            missileType: 'bonespirit',
            skillId: '93',
            amount: monster.stats.damage,
            monsterIndex: monster.index,
          })
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        }
      }
      monster.state = 'attack'
      continue
    }

    if (aiName === 'Vampire' || /vampire|ghoullord|nightlord|darklord|bloodlord/i.test(idLower)) {
      if (distance > monster.stats.reach) {
        if (distance < 60 && !stationary) {
          stepMonsterVector(monster, -dx, -dy, distance || 1, terrain, rawMods, 1)
        }
        if (monster.cooldown === 0) {
          monster.state = 'attack'
          monster.animMode = 's1'
          monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
          const vampSpell = ['fireball', 'firewall', 'meteor'][(world.tick + monster.index) % 3]!
          world.events.push({
            kind: 'missileHit',
            x: player.x,
            y: player.y,
            missileType: vampSpell,
            skillId: vampSpell,
            amount: monster.stats.damage,
            monsterIndex: monster.index,
          })
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        } else {
          monster.state = 'attack'
        }
        continue
      }
    }

    if (aiName === 'WillOWisp' || aiName === 'Willowisp' || /willowisp|gloam|burningsoul|blacksoul/i.test(idLower)) {
      if (distance > monster.stats.reach) {
        if (monster.cooldown === 0) {
          monster.state = 'attack'
          monster.animMode = 's1'
          monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
          world.events.push({
            kind: 'missileHit',
            x: player.x,
            y: player.y,
            missileType: 'lightningsparks',
            skillId: '49',
            amount: monster.stats.damage,
            monsterIndex: monster.index,
          })
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        } else {
          monster.state = 'attack'
        }
        continue
      }
    }

    if (aiName === 'Succubus' || /succubus|stygianfury|helltemptress|siren/i.test(idLower)) {
      if (distance < 48 && !stationary) {
        stepMonsterVector(monster, -dx, -dy, distance || 1, terrain, rawMods, 1)
      }
      if (monster.cooldown === 0) {
        monster.state = 'attack'
        monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
        if ((world.tick + monster.index) % 4 === 0) {
          const curseId = player.maxMana >= player.maxHp ? 'bloodmana' : 'defensecurse'
          world.events.push({
            kind: 'unitSkillEvent',
            x: player.x,
            y: player.y,
            skillId: curseId,
            monsterIndex: monster.index,
          })
        } else {
          world.events.push({
            kind: 'missileHit',
            x: player.x,
            y: player.y,
            missileType: 'succubusbolt',
            skillId: 'bloodstar',
            amount: monster.stats.damage,
            monsterIndex: monster.index,
          })
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        }
      } else {
        monster.state = 'attack'
      }
      continue
    }

    if (aiName === 'CouncilMember' || /councilmember/i.test(idLower)) {
      if (monster.cooldown === 0 && distance > monster.stats.reach) {
        monster.state = 'attack'
        monster.animMode = 's1'
        monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
        world.events.push({
          kind: 'unitSkillEvent',
          x: player.x,
          y: player.y,
          skillId: 'Hydra',
          monsterIndex: monster.index,
        })
        applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        continue
      }
    }

    if (aiName === 'Overseer' || (hcIdx >= 479 && hcIdx <= 483) || hcIdx === 724) {
      if (monster.cooldown === 0) {
        const enslavedTarget = world.monsters.find(
          (m) =>
            m.index !== monster.index &&
            m.state !== 'dead' &&
            m.hp > 0 &&
            (m.stats?.ai === 'Imp' ||
              m.stats?.ai === 'Minion' ||
              (m.stats?.hcIdx !== undefined &&
                ((m.stats.hcIdx >= 453 && m.stats.hcIdx <= 460) ||
                  (m.stats.hcIdx >= 474 && m.stats.hcIdx <= 478) ||
                  m.stats.hcIdx === 723)) ||
              /enslaved|slayer|hellspawn|iceboar|fireboar|imp|minion/i.test(m.stats?.id ?? '')) &&
            Math.hypot(m.x - monster.x, m.y - monster.y) <= 220,
        )
        if (enslavedTarget) {
          enslavedTarget.frenzyStacks = Math.min(8, (enslavedTarget.frenzyStacks ?? 0) + 1)
          monster.state = 'attack'
          monster.animMode = 's1'
          monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
          monster.facing = facingOf(enslavedTarget.x - monster.x, enslavedTarget.y - monster.y)
          world.events.push({
            kind: 'unitSkillEvent',
            x: enslavedTarget.x,
            y: enslavedTarget.y,
            skillId: 'OverseerWhip',
            monsterIndex: enslavedTarget.index,
          })
          continue
        }
      }
    }

    if (aiName === 'SandMaggot' || (hcIdx >= 68 && hcIdx <= 72) || hcIdx === 679 || hcIdx === 716) {
      if (monster.cooldown === 0) {
        const activeEggs = world.monsters.filter(
          (m) =>
            m.state !== 'dead' &&
            m.hp > 0 &&
            (m.stats?.ai === 'MaggotEgg' ||
              (m.stats?.hcIdx !== undefined &&
                ((m.stats.hcIdx >= 190 && m.stats.hcIdx <= 194) || m.stats.hcIdx === 681)) ||
              /maggotegg|sandmaggotegg/i.test(m.stats?.id ?? '')),
        )
        if (activeEggs.length < 3 && distance > monster.stats.reach) {
          const nextIdx = world.monsters.reduce((acc, m) => Math.max(acc, m.index), 0) + 1
          const eggMon: Monster = {
            index: nextIdx,
            x: monster.x + 12,
            y: monster.y + 12,
            hp: 40,
            state: 'idle',
            animMode: 'nu',
            facing: 0,
            cooldown: 10,
            hitFlash: 0,
            corpseTicks: 0,
            stats: {
              ...monster.stats,
              id: 'MaggotEgg',
              name: 'Sand Maggot Egg',
              ai: 'MaggotEgg',
              hcIdx: 190,
              hp: 40,
              speed: 0,
              damage: 0,
              cooldownTicks: 15,
            },
          }
          world.monsters.push(eggMon)
          monster.state = 'attack'
          monster.animMode = 's1'
          monster.cooldown = Math.max(25, monster.stats.cooldownTicks)
          world.events.push({
            kind: 'unitSkillEvent',
            x: eggMon.x,
            y: eggMon.y,
            skillId: 'SandMaggotEgg',
            monsterIndex: eggMon.index,
          })
          continue
        }
        if (distance > monster.stats.reach) {
          monster.state = 'attack'
          monster.animMode = 'a2'
          monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
          const spitMsl =
            (hcIdx >= 0 ? getMonsterModeMissile113c(hcIdx, 'A2') : undefined) ??
            getMonsterModeMissile113c(monster.stats.id, 'A2') ??
            'goospit1'
          world.events.push({
            kind: 'missileHit',
            x: player.x,
            y: player.y,
            missileType: spitMsl,
            skillId: 'MaggotSpit',
            amount: monster.stats.damage,
            monsterIndex: monster.index,
          })
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
          continue
        }
      }
    }

    // --- R2.7 Act Bosses ---
    if (isActBossMonster(monster) && distance > monster.stats.reach) {
      if (monster.cooldown === 0) {
        const decision = executeActBossAi113c(world, monster, player)
        if (decision.action === 'special') {
          monster.state = 'attack'
          monster.animMode = 's1'
          monster.cooldown = Math.max(15, monster.stats.cooldownTicks)
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
          continue
        }
      }
    }

    // --- Stationary Traps, Nests & Turrets ---
    if (stationary) {
      if (aiName === 'BonePrison' || hcIdx === 432) {
        monster.state = 'idle'
        continue
      }
      if (
        aiName === 'MaggotEgg' ||
        (hcIdx >= 190 && hcIdx <= 194) ||
        hcIdx === 681 ||
        /maggotegg|sandmaggotegg/i.test(idLower)
      ) {
        if (monster.cooldown === 0) {
          const baseIdx = world.monsters.reduce((acc, m) => Math.max(acc, m.index), 0)
          for (let yIdx = 0; yIdx < 2; yIdx += 1) {
            const youngMon: Monster = {
              index: baseIdx + 1 + yIdx,
              x: monster.x + (yIdx === 0 ? -8 : 8),
              y: monster.y + (yIdx === 0 ? -6 : 6),
              hp: Math.max(20, Math.floor(monster.stats.hp * 0.8)),
              state: 'chase',
              animMode: 'wl',
              facing: 0,
              cooldown: 10,
              hitFlash: 0,
              corpseTicks: 0,
              stats: {
                ...monster.stats,
                id: 'SandMaggotYoung',
                name: 'Sand Maggot Young',
                ai: 'MaggotBaby',
                hcIdx: 180,
                speed: 55,
                damage: Math.max(4, monster.stats.damage || 6),
                reach: 28,
                aggroRadius: 220,
              },
            }
            world.monsters.push(youngMon)
          }
          monster.hp = 0
          monster.state = 'dead'
          monster.animMode = 'dt'
          monster.corpseConsumed = true
          monster.corpseSuppressed = true
          world.events.push({
            kind: 'unitSkillEvent',
            x: monster.x,
            y: monster.y,
            skillId: 'MaggotEggHatch',
            monsterIndex: monster.index,
          })
        }
        continue
      }
      if (
        aiName === 'FoulCrowNest' ||
        (hcIdx >= 206 && hcIdx <= 209) ||
        (hcIdx >= 334 && hcIdx <= 337) ||
        /foulcrownest|crownest|bloodhawk|suckernest/i.test(idLower)
      ) {
        if (monster.cooldown === 0) {
          const MAX_NEST_SPAWNS = 5
          const spawnedCrows = world.monsters.filter(
            (m) =>
              m.index !== monster.index &&
              (m.stats?.ai === 'FoulCrow' ||
                (m.stats?.hcIdx !== undefined && m.stats.hcIdx >= 15 && m.stats.hcIdx <= 18) ||
                /foulcrow|bloodhawk|blackraptor|cloudstalker/i.test(m.stats?.id ?? '')),
          )
          if (spawnedCrows.length < MAX_NEST_SPAWNS) {
            const nextIdx = world.monsters.reduce((acc, m) => Math.max(acc, m.index), 0) + 1
            const crowMon: Monster = {
              index: nextIdx,
              x: monster.x + ((spawnedCrows.length % 3) - 1) * 10,
              y: monster.y + 10,
              hp: Math.max(15, Math.floor(monster.stats.hp * 0.35)),
              state: 'chase',
              animMode: 'wl',
              facing: 0,
              cooldown: 8,
              hitFlash: 0,
              corpseTicks: 0,
              stats: {
                ...monster.stats,
                id: 'FoulCrow',
                name: 'Foul Crow',
                ai: 'FoulCrow',
                hcIdx: 15,
                speed: 75,
                damage: Math.max(3, monster.stats.damage || 5),
                reach: 26,
                aggroRadius: 240,
              },
            }
            world.monsters.push(crowMon)
            monster.state = 'attack'
            monster.animMode = 's1'
            monster.cooldown = Math.max(25, monster.stats.cooldownTicks || 25)
            world.events.push({
              kind: 'unitSkillEvent',
              x: crowMon.x,
              y: crowMon.y,
              skillId: 'NestSpawn',
              monsterIndex: crowMon.index,
            })
          } else {
            monster.state = 'idle'
          }
        }
        continue
      }
      monster.state = 'attack'
      if (monster.cooldown === 0) {
        monster.cooldown = Math.max(20, monster.stats.cooldownTicks)
        const turretMsl =
          (hcIdx >= 0 ? getMonsterModeMissile113c(hcIdx, 'A1') : undefined) ??
          getMonsterModeMissile113c(monster.stats.id, 'A1') ??
          'trapfirebolt'
        const fanCount = hasMonsterUMod(rawMods, MON_UMOD.MULTISHOT) ? 3 : 1
        for (let mIdx = 0; mIdx < fanCount; mIdx += 1) {
          world.events.push({
            kind: 'missileHit',
            x: player.x + (mIdx - 1) * (fanCount > 1 ? 4 : 0),
            y: player.y + (mIdx - 1) * (fanCount > 1 ? 4 : 0),
            missileType: turretMsl,
            skillId: aiName || 'trap',
            amount: monster.stats.damage,
            monsterIndex: monster.index,
          })
        }
        if (monster.stats.damage > 0) {
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        }
      }
      continue
    }

    // --- R2.4 Ranged Archers, Throwers & Kiters ---
    if (isRangedKiterMonster(monster)) {
      const kiteDangerPx = 40
      const rangedMaxPx = Math.max(220, sightRadius * 0.85)
      const missileKey =
        (hcIdx >= 0 ? getMonsterModeMissile113c(hcIdx, 'A1') : undefined) ??
        getMonsterModeMissile113c(monster.stats.id, 'A1') ??
        monster.stats.modeMissiles?.A1 ??
        'arrow'
      const fanCount = hasMonsterUMod(rawMods, MON_UMOD.MULTISHOT) ? 3 : 1
      if (distance < kiteDangerPx) {
        monster.facing = facingOf(-dx, -dy)
        stepMonsterVector(monster, -dx, -dy, distance || 1, terrain, rawMods, 1)
        monster.state = 'chase'
        monster.animMode = 'wl'
        if (monster.cooldown === 0 && distance >= 20) {
          monster.cooldown =
            monster.curse?.name === 'decrepify' ? monster.stats.cooldownTicks * 2 : monster.stats.cooldownTicks
          for (let mIdx = 0; mIdx < fanCount; mIdx += 1) {
            world.events.push({
              kind: 'missileHit',
              x: player.x + (mIdx - 1) * (fanCount > 1 ? 4 : 0),
              y: player.y + (mIdx - 1) * (fanCount > 1 ? 4 : 0),
              missileType: missileKey,
              skillId: missileKey,
              amount: monster.stats.damage,
              monsterIndex: monster.index,
            })
          }
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        }
        continue
      }
      if (distance <= rangedMaxPx) {
        monster.state = 'attack'
        monster.animMode = 'a1'
        if (monster.cooldown === 0) {
          monster.cooldown =
            monster.curse?.name === 'decrepify' ? monster.stats.cooldownTicks * 2 : monster.stats.cooldownTicks
          for (let mIdx = 0; mIdx < fanCount; mIdx += 1) {
            world.events.push({
              kind: 'missileHit',
              x: player.x + (mIdx - 1) * (fanCount > 1 ? 4 : 0),
              y: player.y + (mIdx - 1) * (fanCount > 1 ? 4 : 0),
              missileType: missileKey,
              skillId: missileKey,
              amount: monster.stats.damage,
              monsterIndex: monster.index,
            })
          }
          applyMonsterAttackToPlayer(world, monster, player, options, true, rawMods)
        }
        continue
      }
      monster.state = 'chase'
      monster.animMode = 'wl'
      stepMonsterVector(monster, dx, dy, distance || 1, terrain, rawMods, 1)
      continue
    }

    // --- Standard Melee Attack & Chase (R2.1) ---
    if (distance <= monster.stats.reach || (hasMonsterUMod(rawMods, MON_UMOD.MULTISHOT) && distance <= Math.max(220, sightRadius * 0.85))) {
      monster.state = 'attack'
      monster.animMode = (world.tick + monster.index) % 2 === 0 || !monster.stats.attack2 ? 'a1' : 'a2'
      if (monster.cooldown === 0) {
        monster.cooldown =
          monster.curse?.name === 'decrepify' ? monster.stats.cooldownTicks * 2 : monster.stats.cooldownTicks
        if (
          aiName === 'Frenzy' ||
          aiName === 'Minotaur' ||
          aiName === 'DeathLord' ||
          aiName === 'BloodLord' ||
          /minotaur|deathlord|moonlord|frenzy/i.test(idLower)
        ) {
          monster.frenzyStacks = Math.min(8, (monster.frenzyStacks ?? 0) + 1)
        }
        const hasMultishot = hasMonsterUMod(rawMods, MON_UMOD.MULTISHOT)
        if (hasMultishot) {
          const missileKey =
            (hcIdx >= 0 ? getMonsterModeMissile113c(hcIdx, 'A1') : undefined) ??
            getMonsterModeMissile113c(monster.stats.id, 'A1') ??
            monster.stats.modeMissiles?.A1 ??
            'arrow'
          for (let mIdx = 0; mIdx < 3; mIdx += 1) {
            world.events.push({
              kind: 'missileHit',
              x: player.x + (mIdx - 1) * 4,
              y: player.y + (mIdx - 1) * 4,
              missileType: missileKey,
              skillId: missileKey,
              amount: monster.stats.damage,
              monsterIndex: monster.index,
            })
          }
        }
        const isRanged = monster.stats.reach > 40 || hasMultishot
        applyMonsterAttackToPlayer(world, monster, player, options, isRanged, rawMods)
      }
      continue
    }
    monster.state = 'chase'
    monster.animMode = 'wl'
    const swoopMult =
      aiName === 'FoulCrow' || aiName === 'VultureDemon' || aiName === 'SandLeaper' ? 1.35 : 1
    stepMonsterVector(monster, dx, dy, distance || 1, terrain, rawMods, swoopMult)
  }
}

/**
 * Compute effective monster defense after Inner Sight (#8) flat defense reduction (`armorclass -= edmn`).
 */
export function computeEffectiveMonsterDefense(monster: Monster): number {
  const baseDef = monster.defense ?? (monster.stats as any).defense ?? 0
  const reduction = (monster.innerSightTicks ?? 0) > 0 ? Math.abs(monster.innerSightDefReduction ?? 0) : 0
  return Math.max(0, baseDef - reduction)
}

/**
 * Compute effective monster projectile speed after Slow Missiles (#17) creation-time velocity scaling
 * (`D2Game.dll` `0x6FC8FA54`: reads `STAT_SKILL_HANDOFATHENA` (161) from `STATE_SLOWMISSILES` (87) stat list).
 */
export function computeEffectiveMonsterMissileSpeed(
  monster: Monster,
  baseSpeed: number,
  canSlow = true,
): number {
  if (!canSlow) return baseSpeed
  const anyMon = monster as Monster & {
    readonly stateBus?: {
      readonly getState?: (idOrName: string | number) => { readonly stats?: Record<string, number> } | undefined
      readonly hasState?: (idOrName: string | number) => boolean
    }
    readonly statList?: {
      readonly getAccruedStat?: (stat: string) => number
    }
  }
  const slowState = anyMon.stateBus?.getState?.('slowmissiles') ?? anyMon.stateBus?.getState?.(87)
  const hasSlowState =
    slowState !== undefined ||
    (anyMon.stateBus?.hasState?.('slowmissiles') ?? false) ||
    (anyMon.stateBus?.hasState?.(87) ?? false)
  if (hasSlowState) {
    const handOfAthena =
      slowState?.stats?.['skill_handofathena'] ??
      slowState?.stats?.['161'] ??
      anyMon.statList?.getAccruedStat?.('skill_handofathena') ??
      0
    return (baseSpeed * handOfAthena) / 100
  }
  if ((monster.slowMissilesTicks ?? 0) > 0 && monster.slowMissilesMult !== undefined) {
    return baseSpeed * monster.slowMissilesMult
  }
  const statListHandOfAthena = anyMon.statList?.getAccruedStat?.('skill_handofathena') ?? 0
  if (statListHandOfAthena > 0) {
    return (baseSpeed * statListHandOfAthena) / 100
  }
  return baseSpeed
}

/**
 * Apply Enchant buff to a combat player or ally/pet unit.
 */
export function applyEnchantBuff(
  target:
    | CombatPlayer
    | {
        enchantTicks?: number | undefined
        enchantDamage?: { min: number; max: number } | undefined
        enchantAttackRatingPercent?: number | undefined
      },
  slvl: number,
  options?:
    | {
        casterWarmth?: number | undefined
        casterFireMasterySlvl?: number | undefined
        isCasterSorceress?: boolean | undefined
      }
    | undefined,
): void {
  const duration = calculateEnchantDuration(slvl)
  const arBonus = calculateEnchantAttackRating(slvl)
  const dmg = calculateEnchantDamage(
    slvl,
    options?.casterWarmth !== undefined ? { warmth: options.casterWarmth } : undefined,
    options?.casterFireMasterySlvl,
  )

  target.enchantTicks = duration
  target.enchantAttackRatingPercent = arBonus
  target.enchantDamage = { min: dmg.min, max: dmg.max }
}

/**
 * Determine whether a unit can be targeted for Enchant (Skill 52).
 */
export function canCastEnchantOn(
  targetType: 'self' | 'ally' | 'pet' | 'enemy' | string,
  _inTown = true,
): boolean {
  if (targetType === 'enemy') return false
  return true
}

// --- 1.13c Special Monster & Mercenary AI Behaviors -------------------------

const FALLEN_FAMILY_PATTERN = /fallen|carver|devilkin|darkone|warped/i
const FETISH_FAMILY_PATTERN = /fetish|flayer|soulkiller|ratman/i

function isFallenFamilyForMorale(m: Monster): boolean {
  const ai = m.stats?.ai ?? ''
  const hcIdx = m.stats?.hcIdx ?? -1
  const id = m.stats?.id ?? ''
  return (
    ai === 'Fallen' ||
    hcIdx === 4 ||
    (hcIdx >= 18 && hcIdx <= 22) ||
    (FALLEN_FAMILY_PATTERN.test(id) && !/shaman/i.test(id))
  )
}

function isFetishFamilyForMorale(m: Monster): boolean {
  const ai = m.stats?.ai ?? ''
  const hcIdx = m.stats?.hcIdx ?? -1
  const id = m.stats?.id ?? ''
  return (
    ai === 'Fetish' ||
    (hcIdx >= 131 && hcIdx <= 135) ||
    (hcIdx >= 141 && hcIdx <= 145) ||
    (FETISH_FAMILY_PATTERN.test(id) && !/shaman|undead|bone/i.test(id))
  )
}

/**
 * 1.13c Pack Morale Break on Ally/Shaman/Leader Death (`D2Game.dll`):
 * When a Fallen, FallenShaman, Fetish, FetishShaman, or pack leader dies, nearby pack allies
 * enter temporary retreat (`fleeTicks > 0`) before rallying back to chase.
 */
export function triggerPackMoraleOnDeath(world: CombatWorld, deadMonster: Monster): void {
  if (!world?.monsters) return
  const deadAi = deadMonster.stats?.ai ?? ''
  const deadHc = deadMonster.stats?.hcIdx ?? -1
  const deadId = deadMonster.stats?.id ?? ''
  const isDeadFallen =
    isFallenFamilyForMorale(deadMonster) ||
    deadAi === 'FallenShaman' ||
    (deadHc >= 23 && deadHc <= 27) ||
    deadHc === 58 ||
    /fallenshaman/i.test(deadId) ||
    deadMonster.stats?.superUniqueId === 'Rakanishu'
  const isDeadFetish =
    isFetishFamilyForMorale(deadMonster) ||
    deadAi === 'FetishShaman' ||
    (deadHc >= 136 && deadHc <= 140) ||
    /fetishshaman/i.test(deadId)
  const isShamanOrBoss =
    deadAi === 'FallenShaman' ||
    deadAi === 'FetishShaman' ||
    deadMonster.stats?.rank === 'unique' ||
    deadMonster.stats?.rank === 'boss' ||
    Boolean(deadMonster.stats?.superUniqueId)

  for (const other of world.monsters) {
    if (other.index === deadMonster.index || other.state === 'dead' || other.hp <= 0) continue
    const dist = Math.hypot(other.x - deadMonster.x, other.y - deadMonster.y)
    if (dist > 320) continue
    const isLeaderDeath = other.leaderId !== undefined && other.leaderId === deadMonster.index
    const sameFallenPack = isDeadFallen && isFallenFamilyForMorale(other)
    const sameFetishPack = isDeadFetish && isFetishFamilyForMorale(other)
    if (isLeaderDeath || sameFallenPack || sameFetishPack) {
      const fleeDuration = isLeaderDeath || isShamanOrBoss ? 35 : 25
      other.fleeTicks = Math.max(other.fleeTicks ?? 0, fleeDuration)
    }
  }
}

/**
 * 1.13c Shaman & Greater Mummy (`FallenResurrect` / `FetishShaman` / `GreaterMummy`) corpse resurrection AI (`D2Game.dll`).
 * Finds the nearest valid, non-consumed, non-shattered corpse of the matching family within `maxRadiusPx`,
 * restores it to full health in `'idle'` state, sets caster cooldown, and emits `'unitSkillEvent'`.
 */
export function executeShamanResurrect113c(
  worldOrShaman: CombatWorld | Monster,
  shamanOrWorld: Monster | CombatWorld,
  maxRadiusOrRng: number | object = 320,
): Monster | null {
  const isWorldFirst = 'monsters' in worldOrShaman && Array.isArray(worldOrShaman.monsters)
  const world = (isWorldFirst ? worldOrShaman : shamanOrWorld) as CombatWorld
  const shaman = (isWorldFirst ? shamanOrWorld : worldOrShaman) as Monster
  if (!world?.monsters || !shaman || shaman.state === 'dead' || shaman.hp <= 0 || shaman.cooldown > 0) {
    return null
  }
  const maxRadiusPx = typeof maxRadiusOrRng === 'number' ? maxRadiusOrRng : 320
  const shamanAi = shaman.stats?.ai ?? ''
  const shamanHc = shaman.stats?.hcIdx ?? -1
  const shamanId = shaman.stats?.id ?? ''
  const isMummy =
    shamanAi === 'GreaterMummy' ||
    shamanAi === 'Unraveler' ||
    (shamanHc >= 101 && shamanHc <= 105) ||
    (shamanHc >= 284 && shamanHc <= 288) ||
    /unraveler|greatermummy|horadrim/i.test(shamanId)
  const isFetishShaman =
    !isMummy &&
    (shamanAi === 'FetishShaman' ||
      (shamanHc >= 136 && shamanHc <= 140) ||
      /fetishshaman/i.test(shamanId))

  let bestCorpse: Monster | null = null
  let bestDist = maxRadiusPx

  for (const candidate of world.monsters) {
    if (candidate.index === shaman.index) continue
    if (candidate.state !== 'dead') continue
    if (
      candidate.corpseSuppressed ||
      candidate.corpseConsumed ||
      candidate.shattered ||
      (candidate as { readonly revivedByShaman?: boolean }).revivedByShaman === true
    ) {
      continue
    }
    if ((candidate.frozenTicks ?? 0) > 0) continue
    if (
      candidate.stats?.rank === 'unique' ||
      candidate.stats?.rank === 'boss' ||
      candidate.stats?.isBoss ||
      Boolean(candidate.stats?.superUniqueId)
    ) {
      continue
    }

    const candAi = candidate.stats?.ai ?? ''
    const candHc = candidate.stats?.hcIdx ?? -1
    const candId = candidate.stats?.id ?? ''
    const candName = candidate.stats?.name ?? ''

    if (isMummy) {
      const isUndeadCorpse =
        Boolean(candidate.stats?.isUndead || candidate.stats?.lUndead || candidate.stats?.hUndead) ||
        candHc === 0 ||
        /skeleton|zombie|mummy|vampire|ghost|wraith|Returned|BoneWarrior/i.test(candId)
      if (!isUndeadCorpse || candAi === 'GreaterMummy' || candAi === 'Unraveler') continue
    } else if (isFetishShaman) {
      if (!isFetishFamilyForMorale(candidate)) continue
    } else {
      const isFallenCorpse =
        candAi === 'Fallen' ||
        candHc === 4 ||
        (candHc >= 18 && candHc <= 22) ||
        FALLEN_FAMILY_PATTERN.test(candId) ||
        FALLEN_FAMILY_PATTERN.test(candName)
      if (!isFallenCorpse || candHc === 1 || candAi === 'Zombie' || candAi === 'FallenShaman') {
        continue
      }
    }

    const dist = Math.hypot(candidate.x - shaman.x, candidate.y - shaman.y)
    if (dist <= bestDist) {
      bestDist = dist
      bestCorpse = candidate
    }
  }

  if (!bestCorpse) return null

  bestCorpse.hp = bestCorpse.stats.hp
  bestCorpse.state = 'idle'
  bestCorpse.animMode = 'nu'
  bestCorpse.corpseTicks = 0
  ;(bestCorpse as { revivedByShaman?: boolean }).revivedByShaman = true
  shaman.cooldown = Math.max(25, shaman.stats.cooldownTicks)
  shaman.facing = facingOf(bestCorpse.x - shaman.x, bestCorpse.y - shaman.y)

  const skillName = isMummy ? 'greatermummyresurrect' : isFetishShaman ? 'fetishresurrect' : 'fallenresurrect'
  world.events.push({
    kind: 'unitSkillEvent',
    x: bestCorpse.x,
    y: bestCorpse.y,
    skillId: skillName,
    monsterIndex: bestCorpse.index,
    unitSkillEvent: {
      type: 'UnitSkillEvent',
      flag: 1,
      skill: 171,
      level: 1,
      caster: { rawUnitType: 1, id: shaman.index >>> 0 },
      target: { rawUnitType: 1, id: bestCorpse.index >>> 0 },
      x: Math.round(bestCorpse.x),
      y: Math.round(bestCorpse.y),
    },
  })

  return bestCorpse
}

/**
 * 1.13c Oblivion Knight curse pool (1.13c patch removed Iron Maiden from Oblivion Knights).
 */
export const OBLIVION_KNIGHT_CURSES = [
  'amplifydamage',
  'decrepify',
  'weaken',
  'lifetap',
  'lowerresist',
] as const

/**
 * 1.13c Oblivion Knight curse selection AI (`D2Game.dll`).
 * Deterministically selects and emits a curse from the 5 canonical 1.13c Oblivion Knight curses (never Iron Maiden).
 */
export function executeOblivionKnightCurse113c(
  worldOrKnight: CombatWorld | Monster,
  knightOrWorld: Monster | CombatWorld,
  targetOrSeed:
    | CombatPlayer
    | number
    | { next?: () => number; int?: (min: number, max: number) => number } = 0,
  slvlOrRng:
    | number
    | { next?: () => number; int?: (min: number, max: number) => number } = 1,
): string {
  const isWorldFirst =
    typeof worldOrKnight === 'object' &&
    worldOrKnight !== null &&
    'monsters' in worldOrKnight &&
    Array.isArray((worldOrKnight as CombatWorld).monsters)
  const world = (isWorldFirst ? worldOrKnight : knightOrWorld) as CombatWorld
  const knight = (isWorldFirst ? knightOrWorld : worldOrKnight) as Monster

  const isTargetPlayer =
    typeof targetOrSeed === 'object' &&
    targetOrSeed !== null &&
    'x' in targetOrSeed &&
    'y' in targetOrSeed
  const target: CombatPlayer = isTargetPlayer
    ? (targetOrSeed as CombatPlayer)
    : (world.players && world.players.length > 0 ? world.players[0]! : world.player)

  const resolvedSlvl =
    typeof slvlOrRng === 'number'
      ? Math.max(1, slvlOrRng)
      : Math.max(1, Math.floor((knight.stats?.level ?? 1) / 4))

  let idx: number
  if (
    typeof targetOrSeed === 'object' &&
    targetOrSeed !== null &&
    !isTargetPlayer &&
    typeof targetOrSeed.int === 'function'
  ) {
    idx = Math.abs(targetOrSeed.int(0, OBLIVION_KNIGHT_CURSES.length - 1)) % OBLIVION_KNIGHT_CURSES.length
  } else if (
    typeof targetOrSeed === 'object' &&
    targetOrSeed !== null &&
    !isTargetPlayer &&
    typeof targetOrSeed.next === 'function'
  ) {
    idx = Math.floor(Math.abs(targetOrSeed.next()) * OBLIVION_KNIGHT_CURSES.length) % OBLIVION_KNIGHT_CURSES.length
  } else if (
    typeof slvlOrRng === 'object' &&
    slvlOrRng !== null &&
    typeof slvlOrRng.int === 'function'
  ) {
    idx = Math.abs(slvlOrRng.int(0, OBLIVION_KNIGHT_CURSES.length - 1)) % OBLIVION_KNIGHT_CURSES.length
  } else if (
    typeof slvlOrRng === 'object' &&
    slvlOrRng !== null &&
    typeof slvlOrRng.next === 'function'
  ) {
    idx = Math.floor(Math.abs(slvlOrRng.next()) * OBLIVION_KNIGHT_CURSES.length) % OBLIVION_KNIGHT_CURSES.length
  } else {
    const rngSeed = typeof targetOrSeed === 'number' ? targetOrSeed : resolvedSlvl
    idx =
      ((rngSeed >>> 0) + ((world.tick ?? 0) >>> 0) + ((knight.index ?? 0) >>> 0)) %
      OBLIVION_KNIGHT_CURSES.length
  }

  const curseName = OBLIVION_KNIGHT_CURSES[idx]!
  knight.cooldown = Math.max(25, knight.stats?.cooldownTicks ?? 25)

  const durationTicks = 250
  const expiresTick = (world.tick ?? 0) + durationTicks
  if (target) {
    target.curse = {
      id: curseName,
      name: curseName,
      slvl: resolvedSlvl,
      sourceId: knight.index,
      sourceUnitId: knight.index,
      expiresTick,
      remainingTicks: durationTicks,
      ticksRemaining: durationTicks,
    }
  }

  const tx = target?.x ?? knight.x
  const ty = target?.y ?? knight.y
  world.events.push({
    kind: 'unitSkillEvent',
    x: tx,
    y: ty,
    skillId: curseName,
    monsterIndex: knight.index,
    text: curseName,
    unitSkillEvent: {
      type: 'UnitSkillEvent',
      flag: 1,
      skill: 66 + idx,
      level: resolvedSlvl,
      caster: { rawUnitType: 1, id: knight.index >>> 0 },
      target: { rawUnitType: 0, id: 1 },
      x: Math.round(tx),
      y: Math.round(ty),
    },
  })

  world.events.push({
    kind: 'unitOverlay',
    x: tx,
    y: ty,
    overlayIndex: 58 + idx,
    monsterIndex: knight.index,
    text: curseName,
  })

  return curseName
}

export interface ActBossAiDecision113c {
  readonly action: 'melee' | 'special' | 'chase'
  readonly skillId?: string | undefined
  readonly skillName?: string | undefined
  readonly executed: boolean
}

/**
 * 1.13c Baal Throne Room 5 Minion Waves (`D2Game.dll` `g_aBaalWaveSuperUniques` @ `0x6FD1B688`
 * & `D2GAME_SpawnSuperUnique` @ `0x6FC451F0` / `0x6FC456CB`).
 */
export const BAAL_THRONE_WAVES_113C = [
  {
    wave: 1,
    superUniqueIndex: 61,
    superUniqueKey: 'Baal Subject 1',
    superUniqueId: 'Colenzo the Annihilator',
    leaderHcIdx: 62,
    minionHcIdx: 23,
    extraMinionHcIdx: undefined,
    extraMinionCount: 0,
  },
  {
    wave: 2,
    superUniqueIndex: 62,
    superUniqueKey: 'Baal Subject 2',
    superUniqueId: 'Achmel the Cursed',
    leaderHcIdx: 105,
    minionHcIdx: 105,
    extraMinionHcIdx: 381,
    extraMinionCount: 10,
  },
  {
    wave: 3,
    superUniqueIndex: 63,
    superUniqueKey: 'Baal Subject 3',
    superUniqueId: 'Bartuc the Bloody',
    leaderHcIdx: 557,
    minionHcIdx: 557,
    extraMinionHcIdx: undefined,
    extraMinionCount: 0,
  },
  {
    wave: 4,
    superUniqueIndex: 64,
    superUniqueKey: 'Baal Subject 4',
    superUniqueId: 'Ventar the Unholy',
    leaderHcIdx: 558,
    minionHcIdx: 558,
    extraMinionHcIdx: undefined,
    extraMinionCount: 0,
  },
  {
    wave: 5,
    superUniqueIndex: 65,
    superUniqueKey: 'Baal Subject 5',
    superUniqueId: 'Lister the Tormentor',
    leaderHcIdx: 571,
    minionHcIdx: 571,
    extraMinionHcIdx: undefined,
    extraMinionCount: 0,
  },
] as const

/**
 * Advance Baal Throne Room wave progression when all current monsters in the wave are dead.
 */
export function tickBaalThroneWave113c(
  world: CombatWorld,
  currentWave: number,
): { readonly nextWave: number; readonly waveCleared: boolean; readonly spec?: (typeof BAAL_THRONE_WAVES_113C)[number] | undefined } {
  const hasLiving = world.monsters.some((m) => m.state !== 'dead' && m.hp > 0 && !m.stats?.isPrimeEvil)
  if (hasLiving || currentWave >= 5) {
    return { nextWave: currentWave, waveCleared: false }
  }
  const nextWave = currentWave + 1
  const spec = BAAL_THRONE_WAVES_113C[nextWave - 1]
  return { nextWave, waveCleared: true, ...(spec ? { spec } : {}) }
}

export interface ActBossAiOptions113c {
  readonly difficulty?: 'normal' | 'nightmare' | 'hell' | number | undefined
  readonly forceSkill?: string | undefined
  readonly target?: CombatPlayer | undefined
  readonly player?: CombatPlayer | undefined
  readonly rng?: unknown
}

/**
 * 1.13c Act Boss & Quest Boss special skill vs melee vs chase selector
 * (`Andariel`, `Duriel`, `Mephisto`, `Diablo`, `Baal`, `BloodRaven`, `Countess`, `Smith`, `Radament`, `Summoner`,
 * `Council`, `Izual`, `Hephasto`, `Shenk`, `Nihlathak`, `Talic`, `Madawc`, `Korlic`, `CowKing`).
 * Supports both `(world, boss, targetOrOpts, rng)` and `(boss, world, targetOrOpts, rng)` call signatures.
 */
export function executeActBossAi113c(
  worldOrBoss: CombatWorld | Monster,
  bossOrWorld: Monster | CombatWorld,
  targetOrOpts?: CombatPlayer | ActBossAiOptions113c,
  _rng?: unknown,
): ActBossAiDecision113c & {
  readonly blindSpot?: boolean | undefined
  readonly corpseConsumed?: boolean | undefined
} {
  const isFirstArgWorld =
    worldOrBoss !== null &&
    typeof worldOrBoss === 'object' &&
    (Array.isArray((worldOrBoss as CombatWorld).monsters) ||
      Array.isArray((worldOrBoss as CombatWorld).events) ||
      ('player' in worldOrBoss && !('stats' in worldOrBoss)))
  const world = (isFirstArgWorld ? worldOrBoss : bossOrWorld) as CombatWorld
  const boss = (isFirstArgWorld ? bossOrWorld : worldOrBoss) as Monster

  const isTargetPlayer =
    targetOrOpts !== undefined &&
    targetOrOpts !== null &&
    typeof targetOrOpts === 'object' &&
    ('x' in targetOrOpts || 'hp' in targetOrOpts || 'alive' in targetOrOpts)
  const opts: ActBossAiOptions113c = isTargetPlayer
    ? { target: targetOrOpts as CombatPlayer }
    : ((targetOrOpts as ActBossAiOptions113c | undefined) ?? {})
  const target: CombatPlayer | undefined =
    opts.target ??
    opts.player ??
    world?.player ??
    world?.players?.[0] ??
    ({ x: (boss?.x ?? 100) + 40, y: boss?.y ?? 100, hp: 1000, maxHp: 1000, mana: 100, maxMana: 100, alive: true } as CombatPlayer)

  if (!boss || !target || target.alive === false || (target.hp !== undefined && target.hp <= 0) || boss.hp <= 0 || boss.state === 'dead') {
    return { action: 'chase', executed: false }
  }

  const bossAny = boss as unknown as {
    readonly id?: string | number
    readonly name?: string
    readonly ai?: string
    readonly hcIdx?: number
    readonly classId?: number
    readonly superUniqueId?: string
    readonly reach?: number
    readonly aggroRadius?: number
    readonly damage?: number
    _actBossLastTick?: number
    _actBossCallOffset?: number
  }
  const dist = Math.hypot((target.x ?? boss.x) - boss.x, (target.y ?? boss.y) - boss.y)
  const hcIdx = boss.stats?.hcIdx ?? bossAny.hcIdx ?? bossAny.classId ?? -1
  const reach = Number.isFinite(boss.stats?.reach) ? boss.stats.reach : (bossAny.reach ?? 28)
  const aggroRadius = Number.isFinite(boss.stats?.aggroRadius) ? boss.stats.aggroRadius : (bossAny.aggroRadius ?? 250)
  const damage = boss.stats?.damage ?? bossAny.damage ?? 25
  const idLower = `${boss.stats?.id ?? ''} ${bossAny.id ?? ''} ${boss.stats?.name ?? ''} ${bossAny.name ?? ''} ${boss.stats?.ai ?? ''} ${bossAny.ai ?? ''} ${boss.stats?.superUniqueId ?? ''} ${bossAny.superUniqueId ?? ''}`
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

  const worldTick = Number.isFinite(world?.tick) ? (world.tick >>> 0) : 0
  const bossIdx = Number.isFinite(boss.index) ? (boss.index >>> 0) : 0
  if (bossAny._actBossLastTick === worldTick) {
    bossAny._actBossCallOffset = (bossAny._actBossCallOffset ?? 0) + 1
  } else {
    bossAny._actBossLastTick = worldTick
    bossAny._actBossCallOffset = 0
  }
  const stepIdx = Math.abs(worldTick + bossIdx + (bossAny._actBossCallOffset ?? 0))

  const rawDiff =
    opts.difficulty ??
    (world as unknown as { readonly difficulty?: 'normal' | 'nightmare' | 'hell' | number })?.difficulty ??
    'normal'
  const isNmOrHell =
    rawDiff === 1 ||
    rawDiff === 2 ||
    (typeof rawDiff === 'string' &&
      (rawDiff.trim().toLowerCase() === 'nightmare' || rawDiff.trim().toLowerCase() === 'hell'))

  const isDiablo = hcIdx === 243 || idLower.includes('diablo')
  const isNihlathak = hcIdx === 526 || idLower.includes('nihlathak')

  if (dist <= Math.max(320, aggroRadius * 1.5)) {
    let skillId = 'bossattack'
    let skillName = 'BossAttack'
    let blindSpot = false
    let corpseConsumed = false

    if (opts.forceSkill && opts.forceSkill.trim() !== '') {
      skillName = opts.forceSkill.trim()
      skillId = skillName.toLowerCase().replace(/[\s_-]+/g, '')
    } else if (hcIdx === 156 || idLower.includes('andariel')) {
      skillId = dist <= 120 ? 'poisonspray' : 'poisonball'
      skillName = dist <= 120 ? 'PoisonSpray' : 'PoisonBall'
    } else if (hcIdx === 211 || idLower.includes('duriel')) {
      const durielSkills = [
        { id: 'jab', name: 'Jab' },
        { id: 'holyfreeze', name: 'HolyFreeze' },
        { id: 'smite', name: 'Smite' },
        { id: 'charge', name: 'Charge' },
      ] as const
      const pick = durielSkills[stepIdx % durielSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 242 || idLower.includes('mephisto')) {
      const mephSkills = [
        { id: 'lightning', name: 'Lightning' },
        { id: 'chargedbolt', name: 'ChargedBolt' },
        { id: 'skullmissile', name: 'SkullMissile' },
        { id: 'frostnova', name: 'FrostNova' },
        { id: 'blizzard', name: 'Blizzard' },
        { id: 'poisonnova', name: 'PoisonNova' },
      ] as const
      const pick = mephSkills[stepIdx % mephSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (isDiablo) {
      const diabloSkills = [
        { id: 'redlightninghose', name: 'RedLightningHose' },
        { id: 'firenovaboss', name: 'FireNova' },
        { id: 'firestorm', name: 'Firestorm' },
        { id: 'boneprison', name: 'BonePrison' },
        { id: 'coldtouch', name: 'ColdTouch' },
        { id: 'firewall', name: 'FireWall' },
        { id: 'charge', name: 'Charge' },
        { id: 'taunt', name: 'Taunt' },
      ] as const
      const pick = diabloSkills[stepIdx % diabloSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 544 || idLower.includes('baal')) {
      const baalSkills = [
        { id: 'baalcoldmissiles', name: 'Hoarfrost' },
        { id: 'baalnova', name: 'IncinerationNova' },
        { id: 'decrepify', name: 'Decrepify' },
        { id: 'teleport', name: 'Teleport' },
        { id: 'festeringappendages', name: 'FesteringAppendages' },
        { id: 'vileeffigy', name: 'BaalClone' },
        { id: 'baalinferno', name: 'ManaRift' },
        { id: 'defensecurse', name: 'DefenseCurse' },
        { id: 'bloodmana', name: 'BloodMana' },
      ] as const
      const pick = baalSkills[stepIdx % baalSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 267 || hcIdx === 2 || idLower.includes('bloodraven')) {
      const brSkills = [
        { id: 'firearrow', name: 'FireArrow' },
        { id: 'raiseskeleton', name: 'RaiseSkeleton' },
      ] as const
      const pick = brSkills[stepIdx % brSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 45 || idLower.includes('countess') || idLower.includes('corruptrogue3')) {
      const countessSkills = [
        { id: 'firewall', name: 'FireWall' },
        { id: 'melee', name: 'Melee' },
      ] as const
      const pick = countessSkills[stepIdx % countessSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 402 || idLower.includes('smith')) {
      const smithSkills = [
        { id: 'bash', name: 'Bash' },
        { id: 'melee', name: 'Melee' },
      ] as const
      const pick = smithSkills[stepIdx % smithSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 229 || idLower.includes('radament')) {
      const radSkills = [
        { id: 'greatermummyresurrect', name: 'RaiseSkeleton' },
        { id: 'unholybolt', name: 'UnholyBolt' },
        { id: 'raiseskeleton', name: 'RaiseSkeleton' },
      ] as const
      const pick = radSkills[stepIdx % radSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 250 || idLower.includes('summoner')) {
      const summonerSkills = [
        { id: 'glacialspike', name: 'GlacialSpike' },
        { id: 'firewall', name: 'FireWall' },
        { id: 'frostnova', name: 'FrostNova' },
        { id: 'weaken', name: 'Weaken' },
      ] as const
      const pick = summonerSkills[stepIdx % summonerSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (
      (hcIdx >= 345 && hcIdx <= 347) ||
      idLower.includes('council') ||
      idLower.includes('ismail') ||
      idLower.includes('geleb') ||
      idLower.includes('toorc') ||
      idLower.includes('bremm') ||
      idLower.includes('wyand') ||
      idLower.includes('maffer')
    ) {
      const councilSkills = [
        { id: 'hydra', name: 'Hydra' },
        { id: 'blessedhammer', name: 'BlessedHammer' },
        { id: 'healother', name: 'HealOther' },
      ] as const
      const pick = councilSkills[stepIdx % councilSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 256 || idLower.includes('izual')) {
      const izualSkills = [
        { id: 'frostnova', name: 'FrostNova' },
        { id: 'melee', name: 'Melee' },
      ] as const
      const pick = izualSkills[stepIdx % izualSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 409 || idLower.includes('hephasto')) {
      const hephSkills = [
        { id: 'bash', name: 'Bash' },
        { id: 'melee', name: 'Melee' },
      ] as const
      const pick = hephSkills[stepIdx % hephSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 479 || hcIdx === 706 || idLower.includes('shenk') || idLower.includes('overseer')) {
      const shenkSkills = [
        { id: 'whip', name: 'Whip' },
        { id: 'frenzy', name: 'Frenzy' },
      ] as const
      const pick = shenkSkills[stepIdx % shenkSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (isNihlathak) {
      const nihlSkills = [
        { id: 'corpseexplosion', name: 'CorpseExplosion' },
        { id: 'arcticblast', name: 'ArcticBlast' },
        { id: 'teleport', name: 'Teleport' },
        { id: 'summonspawn', name: 'SummonSpawn' },
      ] as const
      const pick = nihlSkills[stepIdx % nihlSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 540 || idLower.includes('talic') || idLower.includes('ancientbarb1')) {
      skillId = 'whirlwind'
      skillName = 'Whirlwind'
    } else if (hcIdx === 541 || idLower.includes('madawc') || idLower.includes('ancientbarb2')) {
      const madawcSkills = [
        { id: 'doublethrow', name: 'DoubleThrow' },
        { id: 'shout', name: 'Shout' },
      ] as const
      const pick = madawcSkills[stepIdx % madawcSkills.length]!
      skillId = pick.id
      skillName = pick.name
    } else if (hcIdx === 542 || idLower.includes('korlic') || idLower.includes('ancientbarb3')) {
      skillId = 'leapattack'
      skillName = 'LeapAttack'
    } else if (hcIdx === 39 || idLower.includes('cowking') || idLower.includes('hellbovine')) {
      const cowKingSkills = [
        { id: 'chargedbolt', name: 'ChargedBolt' },
        { id: 'staticfield', name: 'StaticField' },
        { id: 'melee', name: 'Melee' },
      ] as const
      const pick = cowKingSkills[stepIdx % cowKingSkills.length]!
      skillId = pick.id
      skillName = pick.name
    }

    // Nihlathak CorpseExplosion priority & corpse consumption when an unconsumed dead monster exists
    if (isNihlathak && Array.isArray(world?.monsters)) {
      const deadCorpse = world.monsters.find(
        (m) =>
          m !== boss &&
          (m.index === undefined || m.index !== boss.index) &&
          (m.state === 'dead' || m.hp <= 0) &&
          !m.corpseConsumed &&
          !m.corpseSuppressed &&
          !m.shattered,
      )
      if (deadCorpse && (!opts.forceSkill || skillId === 'corpseexplosion')) {
        skillId = 'corpseexplosion'
        skillName = 'CorpseExplosion'
        deadCorpse.corpseConsumed = true
        deadCorpse.corpseSuppressed = true
        corpseConsumed = true
      }
    }

    // Diablo NM/Hell close-range (< 70 px) RedLightningHose blind spot
    if (isDiablo && isNmOrHell && dist < 70 && skillId.includes('lightninghose')) {
      blindSpot = true
      skillId = 'coldtouch'
      skillName = 'ColdTouch'
    }

    if (Array.isArray(world?.events)) {
      world.events.push({
        kind: 'missileHit',
        x: target.x,
        y: target.y,
        missileType: skillId,
        skillId,
        amount: blindSpot ? 0 : damage,
        monsterIndex: boss.index ?? 0,
      })
    }

    const action = skillId === 'melee' ? 'melee' : 'special'
    return {
      action,
      skillId,
      skillName,
      executed: true,
      ...(blindSpot ? { blindSpot: true } : {}),
      ...(corpseConsumed ? { corpseConsumed: true } : {}),
    }
  }

  if (dist <= reach) {
    return { action: 'melee', skillId: 'melee', skillName: 'Melee', executed: true }
  }

  return { action: 'chase', executed: false }
}

export interface TriggerDeathAffixOptions113c {
  readonly difficulty?: 'normal' | 'nightmare' | 'hell' | number | undefined
  readonly killer?: CombatPlayer | undefined
  readonly player?: CombatPlayer | undefined
}

/**
 * 1.13c Monster death affix / UMod trigger (`MonUMod.txt`: Cold Enchanted Frost Nova, Fire Enchanted corpse explosion,
 * Lightning Enchanted bolts, Mummy poison cloud, Bone Fetish / Undead Flayer explosion, Suicide Minion explosion,
 * and pack morale break).
 * Supports both `(world, monster, killerOrOpts)` and `(monster, world, killerOrOpts)` call signatures.
 */
export function triggerMonsterDeathAffixes113c(
  worldOrMonster: CombatWorld | Monster,
  monsterOrWorld: Monster | CombatWorld,
  killerOrOpts?: CombatPlayer | TriggerDeathAffixOptions113c,
): readonly CombatEvent[] & {
  readonly fireEnchantExplosion?: boolean
  readonly coldEnchantNova?: boolean
  readonly totalDamage?: number
} {
  const isFirstArgWorld =
    worldOrMonster !== null &&
    typeof worldOrMonster === 'object' &&
    (Array.isArray((worldOrMonster as CombatWorld).monsters) ||
      Array.isArray((worldOrMonster as CombatWorld).events) ||
      ('player' in worldOrMonster && !('stats' in worldOrMonster)))
  const world = ((isFirstArgWorld ? worldOrMonster : monsterOrWorld) ?? {
    monsters: [],
    events: [],
    tick: 0,
  }) as CombatWorld
  const monster = (isFirstArgWorld ? monsterOrWorld : worldOrMonster) as Monster

  const isThirdArgPlayer =
    killerOrOpts !== undefined &&
    killerOrOpts !== null &&
    typeof killerOrOpts === 'object' &&
    ('x' in killerOrOpts || 'hp' in killerOrOpts || 'alive' in killerOrOpts)
  const opts: TriggerDeathAffixOptions113c = isThirdArgPlayer
    ? { killer: killerOrOpts as CombatPlayer }
    : ((killerOrOpts as TriggerDeathAffixOptions113c | undefined) ?? {})

  const emitted: CombatEvent[] = []
  if (!monster) {
    return Object.assign(emitted, { fireEnchantExplosion: false, coldEnchantNova: false, totalDamage: 0 })
  }
  const eventsList: CombatEvent[] = Array.isArray(world.events) ? world.events : (world.events = [])

  // Trigger pack morale break on Fallen / Fetish / Leader death
  if (Array.isArray(world.monsters)) {
    triggerPackMoraleOnDeath(world, monster)
  }

  const rawMods = collectRawMonsterMods(monster)
  const monAny = monster as unknown as {
    readonly id?: string | number
    readonly hcIdx?: number
    readonly classId?: number
    readonly level?: number
    readonly maxHp?: number
    readonly damage?: number
    readonly rank?: string
    readonly isMinion?: boolean
    readonly stats?: {
      readonly maxHp?: number
    }
  }
  const hcIdx = monster.stats?.hcIdx ?? monAny.hcIdx ?? monAny.classId ?? 0
  const monId = String(monster.stats?.id ?? monAny.id ?? '')
  const mlvl = Math.max(1, monster.stats?.level ?? monAny.level ?? 1)
  const monHp =
    Math.max(
      0,
      monAny.maxHp ?? 0,
      monster.stats?.hp !== undefined && monster.stats.hp > 0 ? monster.stats.hp : 0,
      monAny.stats?.maxHp ?? 0,
      monster.hp !== undefined && monster.hp > 0 ? monster.hp : 0,
    ) || 100
  const monDmg = monster.stats?.damage ?? monAny.damage ?? 10
  const monIdx = monster.index ?? (typeof monAny.id === 'number' ? monAny.id : 0)
  const isMinion =
    monster.stats?.rank === 'minion' ||
    monAny.rank === 'minion' ||
    monAny.isMinion === true
  const difficulty =
    opts.difficulty ??
    (world as unknown as { readonly difficulty?: 'normal' | 'nightmare' | 'hell' | number })?.difficulty ??
    'normal'
  const targetPlayer = opts.killer ?? opts.player ?? world.player
  const distToPlayer = targetPlayer
    ? Math.hypot(targetPlayer.x - monster.x, targetPlayer.y - monster.y)
    : Infinity

  let fireEnchantExplosion = false
  let coldEnchantNova = false
  let totalDamage = 0

  if (hasMonsterUMod(rawMods, MON_UMOD.COLD) && !isMinion) {
    const novaSpec = calcColdEnchantedDeathNova(mlvl, difficulty, isMinion)
    const dmg = Math.max(1, Math.floor((novaSpec.coldMinDmg + novaSpec.coldMaxDmg) / 2))
    coldEnchantNova = true
    totalDamage += dmg
    const ev: CombatEvent = {
      kind: 'missileExplode',
      x: monster.x,
      y: monster.y,
      missileType: 'frostnova',
      skillId: '44',
      amount: dmg,
      monsterIndex: monIdx,
    }
    eventsList.push(ev)
    emitted.push(ev)
  }

  if (hasMonsterUMod(rawMods, MON_UMOD.FIRE) && !isMinion) {
    const feDmg = calcFireEnchantedDeathDamage(monHp, difficulty, 0.5, 0.5)
    const dmg = Math.max(1, feDmg.totalDmg)
    fireEnchantExplosion = true
    totalDamage += dmg
    const ev: CombatEvent = {
      kind: 'missileExplode',
      x: monster.x,
      y: monster.y,
      missileType: 'corpseexplosion',
      skillId: 'fireenchanteddeath',
      amount: dmg,
      monsterIndex: monIdx,
    }
    eventsList.push(ev)
    emitted.push(ev)
    const radiusPx = FIRE_ENCHANT_EXPLOSION_RADIUS * 24 // 96 px (4 sub-tiles)
    if (targetPlayer && distToPlayer <= radiusPx) {
      targetPlayer.hp = Math.max(0, targetPlayer.hp - dmg)
    }
  }

  if (
    hasMonsterUMod(rawMods, MON_UMOD.LIGHTNING) ||
    hasMonsterUMod(rawMods, MON_UMOD.SCARAB) ||
    isScarabMonster(hcIdx, monId)
  ) {
    const dmg = Math.max(1, mlvl * 2)
    totalDamage += dmg
    const ev: CombatEvent = {
      kind: 'missileExplode',
      x: monster.x,
      y: monster.y,
      missileType: 'chargedbolt',
      skillId: '38',
      amount: dmg,
      monsterIndex: monIdx,
    }
    eventsList.push(ev)
    emitted.push(ev)
  }

  if (
    monster.stats?.deathDmg === true ||
    isBoneFetishMonster(hcIdx, monId) ||
    hasMonsterUMod(rawMods, MON_UMOD.GOBOOM)
  ) {
    const bfDmg = calcBoneFetishDeathDamage(monHp, 0.5)
    const dmg = Math.max(1, bfDmg.physDmg)
    totalDamage += dmg
    const ev: CombatEvent = {
      kind: 'missileExplode',
      x: monster.x,
      y: monster.y,
      missileType: 'bonefetishexplode',
      skillId: 'bonefetishdeath',
      amount: dmg,
      monsterIndex: monIdx,
    }
    eventsList.push(ev)
    emitted.push(ev)
    const radiusPx = BONE_FETISH_EXPLOSION_RADIUS * 24 // 96 px
    if (targetPlayer && distToPlayer <= radiusPx) {
      targetPlayer.hp = Math.max(0, targetPlayer.hp - dmg)
    }
  }

  if (
    monster.stats?.ai === 'SuicideMinion' ||
    isSuicideMinionMonster(hcIdx, monId) ||
    hasMonsterUMod(rawMods, MON_UMOD.SUICIDE)
  ) {
    const dmg = Math.max(1, monDmg * 3)
    totalDamage += dmg
    const missileKey = resolveSuicideExplodeMissileKey(hcIdx, difficulty)
    const ev: CombatEvent = {
      kind: 'missileExplode',
      x: monster.x,
      y: monster.y,
      missileType: missileKey,
      skillId: 'suicidedeath',
      amount: dmg,
      monsterIndex: monIdx,
    }
    eventsList.push(ev)
    emitted.push(ev)
    if (targetPlayer && distToPlayer <= 96) {
      targetPlayer.hp = Math.max(0, targetPlayer.hp - dmg)
    }
  }

  if (isPoisonDeadMonster(hcIdx, monId) || hasMonsterUMod(rawMods, MON_UMOD.POISONDEAD)) {
    const dmg = mlvl * 3
    totalDamage += dmg
    const ev: CombatEvent = {
      kind: 'missileExplode',
      x: monster.x,
      y: monster.y,
      missileType: 'poisonnova',
      skillId: 'mummypoison',
      amount: dmg,
      monsterIndex: monIdx,
    }
    eventsList.push(ev)
    emitted.push(ev)
  }

  return Object.assign(emitted, {
    fireEnchantExplosion,
    coldEnchantNova,
    totalDamage,
  })
}

export interface MercenaryUnitState {
  id?: number | string | undefined
  unitId?: number | undefined
  subType?: number | string | undefined
  ownerId?: number | undefined
  difficulty?: number | undefined
  act?: number | undefined
  level?: number | undefined
  x: number
  y: number
  hp: number
  maxHp: number
  damage?: number | undefined
  reach?: number | undefined
  aggroRadius?: number | undefined
  speed?: number | undefined
  cooldown?: number | undefined
  cooldownTicks?: number | undefined
  alive: boolean
  facing?: number | undefined
  targetIndex?: number | undefined
  state?: 'idle' | 'follow' | 'chase' | 'attack' | 'dead' | undefined
  activeAura?: string | undefined
  auraRadius?: number | undefined
  auraDamageBonusPct?: number | undefined
  enchantDamage?: { min: number; max: number } | undefined
  enchantAttackRatingPercent?: number | undefined
  enchantTicks?: number | undefined
}

export interface MercenaryTickOutcome {
  readonly teleportedToOwner: boolean
  readonly teleported?: boolean | undefined
  readonly attackedTargetId?: number | undefined
  readonly activeAura?: string | undefined
  readonly skillUsed?: string | undefined
  readonly skillId?: string | number | undefined
  readonly state?: string | undefined
}

export type MercenaryAiTickResult113c = MercenaryTickOutcome

export interface MercenaryAiTickOptions113c {
  readonly owner?: CombatPlayer | undefined
  readonly tick?: number | undefined
  readonly terrain?: CombatTerrain | undefined
  readonly rng?: unknown
}

/**
 * Server-authoritative 25Hz mercenary AI step (`Hireling.txt` Act 1/2/3/5):
 * - Supports `(world, merc, ownerOrOpts)`, `(merc, world, ownerOrOpts)`, and `(merc, owner, monstersArray, tick)` argument orders
 * - Leashes to owner when distance > 480 px (`teleportedToOwner: true, teleported: true`)
 * - Activates Act 2 Desert Mercenary Paladin aura (`Prayer`, `Blessed Aim`, `Defiance`, `Thorns`, `Holy Freeze`, `Might`)
 * - Acquires and attacks/chases nearest living hostile monster within `aggroRadius` using Hireling.txt skills
 * - Follows owner when idle and distance > 96 px
 */
export function tickMercenaryAi25Hz(
  worldOrMerc: CombatWorld | MercenaryUnitState,
  mercOrWorld: MercenaryUnitState | CombatWorld | CombatPlayer,
  ownerOrOpts?: CombatPlayer | MercenaryAiTickOptions113c | readonly Monster[],
  terrain: CombatTerrain | number = { overlap: () => 0 },
  _rng?: unknown,
): MercenaryTickOutcome {
  const isMonstersArrayThird = Array.isArray(ownerOrOpts)
  const isWorldFirst =
    !isMonstersArrayThird &&
    'monsters' in worldOrMerc &&
    Array.isArray((worldOrMerc as CombatWorld).monsters)
  const merc = (
    isMonstersArrayThird ? worldOrMerc : isWorldFirst ? mercOrWorld : worldOrMerc
  ) as MercenaryUnitState
  const world = (
    isMonstersArrayThird
      ? {
          monsters: ownerOrOpts as Monster[],
          player: mercOrWorld as CombatPlayer,
          events: [],
          tick: typeof terrain === 'number' ? terrain : 0,
        }
      : isWorldFirst
        ? worldOrMerc
        : mercOrWorld
  ) as CombatWorld
  const isOwnerPlayer =
    !isMonstersArrayThird &&
    ownerOrOpts !== undefined &&
    ownerOrOpts !== null &&
    typeof (ownerOrOpts as { x?: unknown }).x === 'number' &&
    typeof (ownerOrOpts as { y?: unknown }).y === 'number'
  const opts =
    !isMonstersArrayThird &&
    !isOwnerPlayer &&
    typeof ownerOrOpts === 'object' &&
    ownerOrOpts !== null
      ? (ownerOrOpts as MercenaryAiTickOptions113c)
      : undefined
  const resolvedOwner =
    (isMonstersArrayThird
      ? (mercOrWorld as CombatPlayer)
      : isOwnerPlayer
        ? (ownerOrOpts as CombatPlayer)
        : opts?.owner) ?? world.player
  const resolvedTerrain: CombatTerrain =
    opts?.terrain ?? (typeof terrain === 'number' ? { overlap: () => 0 } : terrain)
  const effectiveTick =
    typeof terrain === 'number'
      ? terrain
      : typeof opts?.tick === 'number'
        ? opts.tick
        : (world.tick ?? 0)

  if (merc.hp === undefined) {
    merc.hp = merc.maxHp ?? 400
  }
  if (merc.maxHp === undefined) {
    merc.maxHp = Math.max(1, merc.hp)
  }
  if (merc.alive === false || merc.hp <= 0) {
    merc.alive = false
    merc.state = 'dead'
    return { teleportedToOwner: false, teleported: false, state: merc.state }
  }
  merc.alive = true

  // Hydrate default Hireling.txt stats (version = 100 Expansion canonical subType IDs per Act & Difficulty)
  const act = merc.act ?? 2
  const lvl = Math.max(1, merc.level ?? 1)
  const diff = (
    merc.difficulty === 1 || merc.difficulty === 2 || merc.difficulty === 3 ? merc.difficulty : 1
  ) as 1 | 2 | 3
  const defaultSubTypeForAct =
    act === 1
      ? diff === 1
        ? 0
        : diff === 2
          ? 2
          : 4
      : act === 2
        ? diff === 1
          ? 7
          : diff === 2
            ? 11
            : 13
        : act === 3
          ? diff === 1
            ? 16
            : diff === 2
              ? 19
              : 22
          : diff === 1
            ? 24
            : diff === 2
              ? 26
              : 28
  const requestedSubType = merc.subType ?? defaultSubTypeForAct
  let hirelingStats = resolveHirelingStatsAtLevel(requestedSubType, act, diff, lvl, true)
  if (!hirelingStats || hirelingStats.act !== act) {
    hirelingStats = resolveHirelingStatsAtLevel(defaultSubTypeForAct, act, diff, lvl, true)
  }

  if (merc.damage === undefined) {
    merc.damage = hirelingStats
      ? Math.max(1, Math.floor((hirelingStats.minDmg + hirelingStats.maxDmg) / 2))
      : Math.max(10, lvl * 2)
  }
  if (merc.reach === undefined) {
    merc.reach = act === 1 || act === 3 ? 140 : 28
  }
  if (merc.aggroRadius === undefined) {
    merc.aggroRadius = 240
  }
  if (merc.speed === undefined) {
    merc.speed = 45
  }
  if (merc.cooldown === undefined) {
    merc.cooldown = 0
  }
  if (merc.cooldownTicks === undefined) {
    merc.cooldownTicks = 10
  }

  // Act 2 Desert Mercenary aura resolution from Hireling.txt skills
  if (act === 2 && !merc.activeAura) {
    const auraSkill = hirelingStats?.skills.find((s) =>
      /Prayer|Blessed Aim|Defiance|Thorns|Holy Freeze|Might/i.test(s.skillName),
    )
    merc.activeAura = auraSkill?.skillName ?? 'Might'
  }

  if (merc.cooldown > 0) merc.cooldown -= 1

  const ownerDist = Math.hypot(resolvedOwner.x - merc.x, resolvedOwner.y - merc.y)
  if (ownerDist > 480) {
    merc.x = resolvedOwner.x
    merc.y = resolvedOwner.y
    merc.state = 'idle'
    return {
      teleportedToOwner: true,
      teleported: true,
      state: merc.state,
      ...(merc.activeAura !== undefined ? { activeAura: merc.activeAura } : {}),
    }
  }

  let bestMonster: Monster | null = null
  let bestDist = merc.aggroRadius
  for (const m of world.monsters) {
    const mExt = m as {
      readonly inTown?: boolean | undefined
      readonly killable?: boolean | undefined
      readonly petIgnore?: boolean | undefined
    }
    if (
      m.state === 'dead' ||
      m.hp <= 0 ||
      m.sleeping ||
      m.stats?.inTown === true ||
      mExt.inTown === true ||
      m.stats?.killable === false ||
      mExt.killable === false ||
      mExt.petIgnore === true ||
      m.stats?.petIgnore === true ||
      (m.align ?? m.stats?.align ?? 0) !== 0
    ) {
      continue
    }
    const d = Math.hypot(m.x - merc.x, m.y - merc.y)
    if (d <= bestDist) {
      bestDist = d
      bestMonster = m
    }
  }

  if (bestMonster !== null) {
    const dx = bestMonster.x - merc.x
    const dy = bestMonster.y - merc.y
    const dist = Math.hypot(dx, dy) || 1
    merc.facing = facingOf(dx, dy)
    if (dist <= merc.reach) {
      merc.state = 'attack'
      let attackedTargetId: number | undefined
      let skillUsed: string | undefined
      if (merc.cooldown === 0) {
        merc.cooldown = Math.max(1, merc.cooldownTicks)
        const nonAuraSkills = hirelingStats?.skills.filter(
          (s) => !/Prayer|Blessed Aim|Defiance|Thorns|Holy Freeze|Might/i.test(s.skillName),
        )
        const offensiveSkills =
          nonAuraSkills && nonAuraSkills.some((s) => !/Frozen Armor/i.test(s.skillName))
            ? nonAuraSkills.filter((s) => !/Frozen Armor/i.test(s.skillName))
            : nonAuraSkills
        skillUsed =
          offensiveSkills && offensiveSkills.length > 0
            ? offensiveSkills[(effectiveTick >>> 0) % offensiveSkills.length]!.skillName
            : 'Attack'
        const enchantBonus =
          (merc.enchantTicks ?? 0) > 0 && merc.enchantDamage
            ? Math.floor((merc.enchantDamage.min + merc.enchantDamage.max) / 2)
            : 0
        damageMonster(world, bestMonster.index, merc.damage + enchantBonus, resolvedOwner)
        attackedTargetId = bestMonster.index
      }
      return {
        teleportedToOwner: false,
        teleported: false,
        state: merc.state,
        ...(attackedTargetId !== undefined ? { attackedTargetId } : {}),
        ...(merc.activeAura !== undefined ? { activeAura: merc.activeAura } : {}),
        ...(skillUsed !== undefined ? { skillUsed, skillId: skillUsed } : {}),
      }
    }
    merc.state = 'chase'
    const step = merc.speed / 25
    const moved = moveWithCollision(merc, (dx / dist) * step, (dy / dist) * step, resolvedTerrain)
    merc.x = moved.x
    merc.y = moved.y
    return {
      teleportedToOwner: false,
      teleported: false,
      state: merc.state,
      ...(merc.activeAura !== undefined ? { activeAura: merc.activeAura } : {}),
    }
  }

  if (ownerDist > 96) {
    const dx = resolvedOwner.x - merc.x
    const dy = resolvedOwner.y - merc.y
    const dist = Math.hypot(dx, dy) || 1
    merc.facing = facingOf(dx, dy)
    merc.state = 'follow'
    const step = merc.speed / 25
    const moved = moveWithCollision(merc, (dx / dist) * step, (dy / dist) * step, resolvedTerrain)
    merc.x = moved.x
    merc.y = moved.y
  } else {
    merc.state = 'idle'
  }

  return {
    teleportedToOwner: false,
    teleported: false,
    state: merc.state,
    ...(merc.activeAura !== undefined ? { activeAura: merc.activeAura } : {}),
  }
}

export const MonsterAI = {
  tickMonsters,
  damageMonster,
  isActBossMonster,
  executeShamanResurrect113c,
  executeOblivionKnightCurse113c,
  executeActBossAi113c,
  triggerPackMoraleOnDeath,
  triggerMonsterDeathAffixes113c,
  tickMercenaryAi25Hz,
  spawnMonsters,
  spawnMonsterPacks,
} as const


