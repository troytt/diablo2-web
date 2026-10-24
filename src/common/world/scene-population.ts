import type { MonsterPack, MonsterStats, SafeZone } from '../units/unit-types.ts'
import {
  ORTHO_CELL_HEIGHT,
  ORTHO_CELL_WIDTH,
  cellAt,
  isBlockedAt,
  levelSeed,
  subTileToScene,
  type CollisionGrid,
} from './d2map.ts'
import type { DropTables } from '../items/drop-tables.ts'
import { getEmbeddedDropTables } from '../items/embedded-drop-tables.ts'
import type { SceneEntrance, SceneWarp, SceneWaypoint } from './level-links.ts'
import { allocatePacksToRooms, type MapRoom } from '../units/monster-rooms.ts'
import type { StreamingRoomDef } from '../units/monster-streaming.ts'
import {
  ELITE_HEALTH_MULTIPLIER,
  MONUMOD_CONSTANTS,
  applyEliteModifiers,
  enrichMonsterPacks,
  rollEliteModifiers,
} from '../units/monsters-data.ts'
import { Rng } from '../rng/d2-rng.ts'

/** Base paths tried in order when `?base=` is absent. */
export const DEFAULT_BASES = ['samples/d2', '/diablo2/data']

/**
 * Side of a streaming room, in cells.
 *
 * `D2Common`'s DRLG cuts a wilderness level into rooms of a handful of tiles
 * each; a generated level here is 8 cells per generator block, so 24 cells is
 * three blocks — about a screen and a half, which is the granularity at which
 * populating a room is cheap enough to do inside one frame.
 */
export const ROOM_CELL_SIZE = 24

/** Town levels across Acts 1..5 that must strictly remain at 0 monster density. */
export const TOWN_LEVEL_IDS = new Set<number>([1, 40, 75, 103, 109])

export function isTownLevel(levelId: number | undefined | null): boolean {
  if (levelId === undefined || levelId === null || levelId <= 0) return false
  return TOWN_LEVEL_IDS.has(levelId)
}

export type DensityMultiplier = 0.5 | 1 | 2 | 4 | 8
export type EliteMultiplier = 0.5 | 1 | 2 | 4 | 'all'

export function parseDensityMultiplier(raw: string | number | null | undefined): DensityMultiplier {
  if (raw === null || raw === undefined) return 1
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).trim())
  if (num === 0.5 || num === 1 || num === 2 || num === 4 || num === 8) {
    return num as DensityMultiplier
  }
  return 1
}

export function parseEliteMultiplier(raw: string | number | null | undefined): EliteMultiplier {
  if (raw === null || raw === undefined) return 1
  const str = String(raw).trim().toLowerCase()
  if (str === 'all') return 'all'
  const num = parseFloat(str)
  if (num === 0.5 || num === 1 || num === 2 || num === 4) {
    return num as EliteMultiplier
  }
  return 1
}

export function promoteToChampion(pack: MonsterPack, rng: Rng): MonsterPack {
  const leaderBase = pack.members[0]
  if (!leaderBase) return pack
  const count = rng.int(2, 4)
  const mods = rollEliteModifiers('champion', rng)
  const members: MonsterStats[] = []
  for (let i = 0; i < count; i += 1) {
    const base = pack.members[i % pack.members.length] ?? leaderBase
    const scaledBase: MonsterStats = {
      ...base,
      hp: Math.max(1, Math.round(base.hp * ELITE_HEALTH_MULTIPLIER.champion)),
    }
    members.push(applyEliteModifiers(scaledBase, 'champion', mods))
  }
  return {
    ...pack,
    members,
  }
}

export function promoteToUnique(pack: MonsterPack, rng: Rng): MonsterPack {
  const leaderBase = pack.members[0]
  if (!leaderBase) return pack
  const minionCount = rng.int(3, 6)
  const mods = rollEliteModifiers('unique', rng)
  const scaledLeader: MonsterStats = {
    ...leaderBase,
    hp: Math.max(1, Math.round(leaderBase.hp * ELITE_HEALTH_MULTIPLIER.unique)),
  }
  const leader = applyEliteModifiers(scaledLeader, 'unique', mods)
  const members: MonsterStats[] = [leader]
  for (let i = 0; i < minionCount; i += 1) {
    const minionBase = pack.members[(i + 1) % pack.members.length] ?? leaderBase
    const scaledMinion: MonsterStats = {
      ...minionBase,
      hp: Math.max(1, Math.round(minionBase.hp * (1 + MONUMOD_CONSTANTS.minionHpPct / 100))),
    }
    members.push(applyEliteModifiers(scaledMinion, 'minion', []))
  }
  return {
    ...pack,
    members,
  }
}

export function demoteToNormal(pack: MonsterPack): MonsterPack {
  const members: MonsterStats[] = pack.members.map(m => {
    let hp = m.hp
    let level = m.level
    if (m.rank === 'champion') {
      hp = Math.max(1, Math.round(hp / ELITE_HEALTH_MULTIPLIER.champion))
      if (level !== undefined) {
        level = Math.max(1, level - 2)
      }
    } else if (m.rank === 'unique') {
      hp = Math.max(1, Math.round(hp / ELITE_HEALTH_MULTIPLIER.unique))
      if (level !== undefined) {
        level = Math.max(1, level - 3)
      }
    } else if (m.rank === 'minion') {
      hp = Math.max(1, Math.round(hp / (1 + MONUMOD_CONSTANTS.minionHpPct / 100)))
      if (level !== undefined) {
        level = Math.max(1, level - 3)
      }
    }
    return {
      ...m,
      hp,
      ...(level !== undefined ? { level } : {}),
      rank: 'normal',
      modifiers: [],
    }
  })
  return {
    ...pack,
    members,
  }
}

export interface RebudgetOptions {
  readonly densityMultiplier?: number | string | undefined
  readonly eliteMultiplier?: number | string | undefined
  readonly levelId?: number | undefined
  readonly seed?: number | undefined
}

export function rebudgetMonsterPacks(
  basePacks: readonly MonsterPack[],
  options?: RebudgetOptions,
): MonsterPack[] {
  const levelId = options?.levelId
  if (levelId !== undefined && isTownLevel(levelId)) {
    return []
  }
  if (!basePacks || basePacks.length === 0) {
    return []
  }

  const dropTables = getEmbeddedDropTables()
  const enrichedBasePacks = enrichMonsterPacks(basePacks, dropTables.monsterKinds, dropTables.superUniques)

  const density = parseDensityMultiplier(options?.densityMultiplier)
  const elite = parseEliteMultiplier(options?.eliteMultiplier)

  if (density === 1 && elite === 1) {
    return enrichedBasePacks.map(pack => ({
      ...pack,
      members: pack.members.map(m => ({ ...m })),
    }))
  }

  const rng = new Rng(options?.seed ?? 0x9e37)

  // Separate fixed / landmark packs from regular wild packs
  const fixedPacks = enrichedBasePacks.filter(p => p.superUniqueId !== undefined || p.fixedPosition !== undefined || p.landmarkTile !== undefined)
  const regularPacks = enrichedBasePacks.filter(p => p.superUniqueId === undefined && p.fixedPosition === undefined && p.landmarkTile === undefined)

  // 1. Density scaling on regular packs
  let scaledRegularPacks: MonsterPack[] = []
  if (regularPacks.length > 0) {
    const targetCount = Math.max(1, Math.round(regularPacks.length * density))
    if (targetCount <= regularPacks.length) {
      for (let i = 0; i < targetCount; i += 1) {
        const idx = Math.floor((i * regularPacks.length) / targetCount)
        const src = regularPacks[idx]!
        scaledRegularPacks.push({
          ...src,
          members: src.members.map(m => ({ ...m })),
        })
      }
    } else {
      for (let i = 0; i < targetCount; i += 1) {
        const src = regularPacks[i % regularPacks.length]!
        scaledRegularPacks.push({
          ...src,
          members: src.members.map(m => ({ ...m })),
        })
      }
    }
  }

  // 2. Elite scaling on regular packs
  if (elite === 'all') {
    scaledRegularPacks = scaledRegularPacks.map((pack, idx) => {
      const normalPack = demoteToNormal(pack)
      const packRng = rng.fork(`all-elite-${idx}`)
      const isChampion = packRng.next() < (MONUMOD_CONSTANTS.championChance / 100)
      return isChampion ? promoteToChampion(normalPack, packRng) : promoteToUnique(normalPack, packRng)
    })
  } else if (elite !== 1) {
    const currentEliteIndices: number[] = []
    const currentNormalIndices: number[] = []
    for (let i = 0; i < scaledRegularPacks.length; i += 1) {
      const leaderRank = scaledRegularPacks[i]?.members[0]?.rank
      if (leaderRank === 'champion' || leaderRank === 'unique') {
        currentEliteIndices.push(i)
      } else {
        currentNormalIndices.push(i)
      }
    }

    if (currentEliteIndices.length > 0) {
      const targetEliteCount = Math.min(scaledRegularPacks.length, Math.max(0, Math.round(currentEliteIndices.length * elite)))
      if (targetEliteCount < currentEliteIndices.length) {
        const toDemoteCount = currentEliteIndices.length - targetEliteCount
        for (let i = 0; i < toDemoteCount; i += 1) {
          const idx = currentEliteIndices[currentEliteIndices.length - 1 - i]!
          scaledRegularPacks[idx] = demoteToNormal(scaledRegularPacks[idx]!)
        }
      } else if (targetEliteCount > currentEliteIndices.length) {
        const toPromoteCount = Math.min(currentNormalIndices.length, targetEliteCount - currentEliteIndices.length)
        for (let i = 0; i < toPromoteCount; i += 1) {
          const idx = currentNormalIndices[i]!
          const packRng = rng.fork(`promote-${idx}`)
          const isChampion = packRng.next() < (MONUMOD_CONSTANTS.championChance / 100)
          scaledRegularPacks[idx] = isChampion
            ? promoteToChampion(scaledRegularPacks[idx]!, packRng)
            : promoteToUnique(scaledRegularPacks[idx]!, packRng)
        }
      }
    } else if (elite > 1 && currentNormalIndices.length > 0) {
      const targetEliteCount = Math.min(
        scaledRegularPacks.length,
        Math.max(1, Math.round(scaledRegularPacks.length * 0.05 * elite)),
      )
      const toPromote = Math.min(currentNormalIndices.length, targetEliteCount)
      for (let i = 0; i < toPromote; i += 1) {
        const idx = currentNormalIndices[i]!
        const packRng = rng.fork(`promote-zero-${idx}`)
        const isChampion = packRng.next() < (MONUMOD_CONSTANTS.championChance / 100)
        scaledRegularPacks[idx] = isChampion
          ? promoteToChampion(scaledRegularPacks[idx]!, packRng)
          : promoteToUnique(scaledRegularPacks[idx]!, packRng)
      }
    }
  }

  return [
    ...fixedPacks.map(p => ({ ...p, members: p.members.map(m => ({ ...m })) })),
    ...scaledRegularPacks,
  ]
}

export interface HeroClassInfo {
  readonly token: string
  readonly code: string
  readonly nameZh: string
  readonly nameEn: string
  readonly defaultLeftSkill: number
  readonly defaultRightSkill: number
  readonly charIdentity: {
    readonly name: string
    readonly classNameZh: string
    readonly classNameEn: string
    readonly str: number
    readonly dex: number
    readonly vit: number
    readonly ene: number
    readonly baseMaxHp: number
    readonly baseMaxMana: number
  }
}

export const HERO_CLASSES: Record<string, HeroClassInfo> = {
  so: {
    token: 'so', code: 'sor', nameZh: '法师', nameEn: 'Sorceress',
    defaultLeftSkill: 47, defaultRightSkill: 64,
    charIdentity: {
      name: 'Isendra', classNameZh: '女法师', classNameEn: 'Sorceress',
      str: 156, dex: 75, vit: 315, ene: 95, baseMaxHp: 850, baseMaxMana: 620,
    },
  },
  am: {
    token: 'am', code: 'ama', nameZh: '亚马逊', nameEn: 'Amazon',
    defaultLeftSkill: 6, defaultRightSkill: 7,
    charIdentity: {
      name: 'Cassia', classNameZh: '亚马逊', classNameEn: 'Amazon',
      str: 135, dex: 210, vit: 250, ene: 50, baseMaxHp: 920, baseMaxMana: 320,
    },
  },
  ne: {
    token: 'ne', code: 'nec', nameZh: '死灵法师', nameEn: 'Necromancer',
    defaultLeftSkill: 67, defaultRightSkill: 70,
    charIdentity: {
      name: 'Xul', classNameZh: '死灵法师', classNameEn: 'Necromancer',
      str: 120, dex: 80, vit: 290, ene: 120, baseMaxHp: 780, baseMaxMana: 580,
    },
  },
  pa: {
    token: 'pa', code: 'pal', nameZh: '圣骑士', nameEn: 'Paladin',
    defaultLeftSkill: 96, defaultRightSkill: 112,
    charIdentity: {
      name: 'Cartographus', classNameZh: '圣骑士', classNameEn: 'Paladin',
      str: 175, dex: 120, vit: 340, ene: 45, baseMaxHp: 1150, baseMaxMana: 380,
    },
  },
  ba: {
    token: 'ba', code: 'bar', nameZh: '野蛮人', nameEn: 'Barbarian',
    defaultLeftSkill: 126, defaultRightSkill: 133,
    charIdentity: {
      name: 'Sonya', classNameZh: '野蛮人', classNameEn: 'Barbarian',
      str: 235, dex: 110, vit: 380, ene: 30, baseMaxHp: 1420, baseMaxMana: 260,
    },
  },
  dz: {
    token: 'dz', code: 'dru', nameZh: '德鲁伊', nameEn: 'Druid',
    defaultLeftSkill: 225, defaultRightSkill: 229,
    charIdentity: {
      name: 'Loreov', classNameZh: '德鲁伊', classNameEn: 'Druid',
      str: 165, dex: 90, vit: 330, ene: 70, baseMaxHp: 1050, baseMaxMana: 420,
    },
  },
  ai: {
    token: 'ai', code: 'ass', nameZh: '刺客', nameEn: 'Assassin',
    defaultLeftSkill: 254, defaultRightSkill: 251,
    charIdentity: {
      name: 'Natalya', classNameZh: '刺客', classNameEn: 'Assassin',
      str: 150, dex: 180, vit: 280, ene: 60, baseMaxHp: 960, baseMaxMana: 360,
    },
  },
}

export function normalizeHeroToken(input: string | null | undefined): string {
  if (!input) return 'so'
  const lower = input.toLowerCase().trim()
  if (HERO_CLASSES[lower]) return lower
  const codeMap: Record<string, string> = {
    sor: 'so', sorceress: 'so',
    ama: 'am', amazon: 'am',
    nec: 'ne', necromancer: 'ne',
    pal: 'pa', paladin: 'pa',
    bar: 'ba', barbarian: 'ba',
    dru: 'dz', druid: 'dz', dr: 'dz',
    ass: 'ai', assassin: 'ai', as: 'ai',
  }
  return codeMap[lower] ?? 'so'
}

/** Town Stash entity (authentic 1.13c Objects.txt row 267 B6). */
export interface TownStashEntity {
  readonly id: number
  readonly objectsTxtId: number
  readonly token: string
  readonly nameZh: string
  readonly nameEn: string
  readonly act: number
  readonly x: number
  readonly y: number
  readonly subTileX: number
  readonly subTileY: number
  readonly clickRadiusPx: number
  readonly interactionRangePx: number
}

/**
 * Canonical town stash coordinates for Acts 1..5.
 * Grounded in authentic 1.13c DS1 map objects (row 267 B6).
 */
export const CANONICAL_TOWN_STASHES: Record<number, TownStashEntity> = {
  1: {
    id: 267,
    objectsTxtId: 267,
    token: 'B6',
    nameZh: '储物箱',
    nameEn: 'Stash',
    act: 1,
    x: 4512,
    y: 1720,
    subTileX: 112,
    subTileY: 86,
    clickRadiusPx: 48,
    interactionRangePx: 80,
  },
  2: {
    id: 267,
    objectsTxtId: 267,
    token: 'B6',
    nameZh: '储物箱',
    nameEn: 'Stash',
    act: 2,
    x: 5328,
    y: 1568,
    subTileX: 133,
    subTileY: 78,
    clickRadiusPx: 48,
    interactionRangePx: 80,
  },
  3: {
    id: 267,
    objectsTxtId: 267,
    token: 'B6',
    nameZh: '储物箱',
    nameEn: 'Stash',
    act: 3,
    x: 5264,
    y: 1584,
    subTileX: 131,
    subTileY: 79,
    clickRadiusPx: 48,
    interactionRangePx: 80,
  },
  4: {
    id: 267,
    objectsTxtId: 267,
    token: 'B6',
    nameZh: '储物箱',
    nameEn: 'Stash',
    act: 4,
    x: 704,
    y: 552,
    subTileX: 17,
    subTileY: 27,
    clickRadiusPx: 48,
    interactionRangePx: 80,
  },
  5: {
    id: 267,
    objectsTxtId: 267,
    token: 'B6',
    nameZh: '储物箱',
    nameEn: 'Stash',
    act: 5,
    x: 3792,
    y: 1448,
    subTileX: 94,
    subTileY: 72,
    clickRadiusPx: 48,
    interactionRangePx: 80,
  },
}

/** Global singleton cache for DropTables using pre-baked embedded canonical drop data (zero network/MPQ). */
let sharedDropTablesPromise: Promise<DropTables> | null = null

export function getSharedDropTables(_bases: readonly string[] = DEFAULT_BASES): Promise<DropTables> {
  if (!sharedDropTablesPromise) {
    sharedDropTablesPromise = Promise.resolve(getEmbeddedDropTables())
  }
  return sharedDropTablesPromise
}

/**
 * Sample a scene-pixel rectangle on a 7×7 interior grid and ask whether any
 * point is walkable.
 *
 * An axis-aligned rectangle over the isometric diamond includes the four empty
 * triangles outside the map; without this check those corners become rooms,
 * `allocatePacksToRooms` deals packs into them, and `spawnMonsterPacks` fails
 * every placement attempt against void space.
 */
export function roomHasWalkableGround(
  grid: CollisionGrid,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const samples = 9
  for (let iy = 1; iy < samples; iy += 1) {
    const y = minY + (maxY - minY) * (iy / samples)
    for (let ix = 1; ix < samples; ix += 1) {
      const x = minX + (maxX - minX) * (ix / samples)
      if (!isBlockedAt(grid, x, y)) return true
    }
  }
  return false
}

export interface StreamingRoomLayoutInput {
  readonly grid: CollisionGrid
  readonly widthPx: number
  readonly heightPx: number
  readonly level: string
}

export interface SafeZoneSourceRuntime {
  readonly grid: CollisionGrid
  readonly waypoints: readonly SceneWaypoint[]
  readonly entrances: readonly SceneEntrance[]
  readonly warps: readonly SceneWarp[]
}

