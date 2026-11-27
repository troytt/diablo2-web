/**
 * 1.13c Pandemonium Event (`Uber Tristram` & Mini-Uber Realms `133..136`, #1841).
 *
 * Ground truth (`D2Game.dll` v1.13c & `MonStats.txt` / `UniqueItems.txt` / `Misc.txt` / `Cubemain.txt`):
 * - `0x6FD01470..0x6FD01566` & `0x6FD0E7B0`:
 *   - Area `133` (`Matron's Den`): strips preset `SparklyChest` (`397`) and spawns `#707 uberandariel` (`Lilith`).
 *   - Area `134` (`Forgotten Sands`): strips preset `WaypointPortal` (`402`); at preset object `(seed % 3) + 3` spawns `#708 uberduriel`.
 *   - Area `135` (`Furnace of Pain`): strips preset `SparklyChest` (`397`) and spawns `#706 uberizual`.
 *   - Area `136` (`Uber Tristram`): suppresses all normal preset monsters (`type === 1`), strips `268` (`Wirt`),
 *     `26` (`CainGibbet`), and `269` (`CainPortal`), and spawns `#704 ubermephisto`, `#705 uberdiablo`, and `#709 uberbaal`.
 * - `0x6FCCF4B5`: Town Portal (`Scroll`/`Tome`/`Skill 220`) is blocked inside `areaId === 136` (`cmp eax, 0x88`).
 * - `0x6FD0A730..0x6FD0AA30` & `0x6FCD0C40`: Uber Prime Evil minion pools & `25`-sub-tile `AloneAndTogether` cap halving,
 *   `experience = 0` and zero item drops on summoned Uber minions, and full minion despawn when all 3 Uber Prime Evils die.
 * - `0x6FD0AA30..0x6FD0AB09`: Only the 3rd (last) Uber Prime Evil killed in `136` drops `1` Unique `cm2` `Hellfire Torch`
 *   (`ilvl = 110`, `levelreq = 75`, `+3` random class `0..6`, `+10..20` stats, `+10..20` all res, `+8` light,
 *   `5%` CtC lvl 10 Firestorm, Level 30 `Hydra` `10/10` full charges per `0x6FCF2380`) + `max(1, activePlayers)` copies
 *   of `Standard of Heroes` (`std`, `ilvl = 90`, `levelreq = 90`).
 */

import type {
  LocalAreaLevelGeometry,
  LocalAreaPresetMonster,
  LocalAreaPresetObject,
} from '../../netproto/index.ts'
import { createDroppedItem, type DropTables } from '../../common/items/drop-tables.ts'
import type { Item } from '../../common/items/items.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { MONSTATS_113C_ROWS } from '../../common/units/monsters-data.ts'

/** Prelude mini-Uber areas opened from `pk1 + pk2 + pk3` in Hell Harrogath (`109`). */
export const PANDEMONIUM_PRELUDE_AREA_IDS_113C = [133, 134, 135] as const

/** Finale Uber Tristram area opened from `dhn + bey + mbr` in Hell Harrogath (`109`). */
export const PANDEMONIUM_FINALE_AREA_ID_113C = 136

/** All four Pandemonium Event areas (`133..136`). */
export const PANDEMONIUM_AREA_IDS_113C: ReadonlySet<number> = new Set([133, 134, 135, 136])

/** Mini-Uber `MonStats.txt` `hcIdx` per prelude area (`133 -> 707`, `134 -> 708`, `135 -> 706`). */
export const PANDEMONIUM_MINI_UBER_BY_AREA_113C: Readonly<Record<number, number>> = {
  133: 707, // uberandariel (Lilith)
  134: 708, // uberduriel
  135: 706, // uberizual
}

/** The three Uber Prime Evils in Area `136` (`MonStats.txt` `hcIdx`: `704`, `705`, `709`). */
export const UBER_PRIME_EVIL_HC_INDICES_113C = [704, 705, 709] as const
export const UBER_PRIME_EVIL_SET_113C: ReadonlySet<number> = new Set(UBER_PRIME_EVIL_HC_INDICES_113C)

/** All six Pandemonium Bosses (`MonStats.txt` `704..709`). */
export const PANDEMONIUM_BOSS_SET_113C: ReadonlySet<number> = new Set([704, 705, 706, 707, 708, 709])

/** `D2Game.dll` `0x6FCD0C40`: proximity threshold (`25` sub-tiles) within which living Uber Prime Evils share reduced minion caps. */
export const UBER_PRIME_TOGETHER_RADIUS_SUBTILES_113C = 25

export interface UberPrimeMinionSpec113c {
  readonly pool: readonly number[]
  readonly capTogether: number
  readonly capIsolated: number
  readonly summonSkillId: number
  readonly cooldownFrames: number
}

/**
 * `D2Game.dll` `0x6FD0A730..0x6FD0AA30`:
 * - `#704 ubermephisto`: summons `#725 skeleton8`, `#726 sk_archer11`, `#727..730 skmage_*` (cap `15` together / `30` isolated).
 * - `#705 uberdiablo`: summons `#712 megademon6` Pit Lords (cap `4` together / `10` isolated).
 * - `#709 uberbaal`: summons `#732 wraith9` Specters & `#731 vampire9` Dark Lords (cap `7` together / `15` isolated).
 */
export const UBER_PRIME_MINION_SPECS_113C: Readonly<Record<number, UberPrimeMinionSpec113c>> = {
  704: {
    pool: [725, 726, 727, 728, 729, 730],
    capTogether: 15,
    capIsolated: 30,
    summonSkillId: 158,
    cooldownFrames: 50,
  },
  705: {
    pool: [712],
    capTogether: 4,
    capIsolated: 10,
    summonSkillId: 302,
    cooldownFrames: 75,
  },
  709: {
    pool: [732, 731],
    capTogether: 7,
    capIsolated: 15,
    summonSkillId: 286,
    cooldownFrames: 65,
  },
}

/** Computes the active minion cap for an Uber Prime Evil based on proximity (`<= 25` sub-tiles) to another living Uber Prime Evil. */
export function computeUberPrimeMinionCap113c(
  bossHcIdx: number,
  bossUnitId: number,
  bossX: number,
  bossY: number,
  livingUberPrimes: readonly { readonly unitId: number; readonly hcIdx: number; readonly x: number; readonly y: number }[],
): number {
  const spec = UBER_PRIME_MINION_SPECS_113C[bossHcIdx]
  if (!spec) return 0
  const hasNearbyPeer = livingUberPrimes.some(
    (other) =>
      other.unitId !== bossUnitId &&
      UBER_PRIME_EVIL_SET_113C.has(other.hcIdx) &&
      Math.hypot(other.x - bossX, other.y - bossY) <= UBER_PRIME_TOGETHER_RADIUS_SUBTILES_113C,
  )
  return hasNearbyPeer ? spec.capTogether : spec.capIsolated
}

function makePresetBossMonster(classId: number, x: number, y: number, areaId: number): LocalAreaPresetMonster {
  const row = MONSTATS_113C_ROWS[classId]
  return {
    classId,
    x,
    y,
    areaId,
    ...(row ? { name: row.id } : {}),
    isNpc: false,
    isVendor: false,
    isKillable: true,
    aiDisabled: false,
  }
}

function findFallbackBossAnchor(
  level: LocalAreaLevelGeometry,
  spawn: { readonly x: number; readonly y: number },
  findStandable: (x: number, y: number) => { readonly x: number; readonly y: number } | null,
): { readonly x: number; readonly y: number } {
  const centerX = level.originX + Math.floor(level.subWidth / 2)
  const centerY = level.originY + Math.floor(level.subHeight / 2)
  if (Math.hypot(centerX - spawn.x, centerY - spawn.y) >= 8) {
    const atCenter = findStandable(centerX, centerY)
    if (atCenter !== null) return atCenter
  }
  for (const [dx, dy] of [
    [14, 0],
    [-14, 0],
    [0, 14],
    [0, -14],
    [10, 10],
    [-10, -10],
    [8, 0],
    [0, 8],
  ] as const) {
    const cand = findStandable(spawn.x + dx, spawn.y + dy)
    if (cand !== null && (cand.x !== spawn.x || cand.y !== spawn.y)) {
      return cand
    }
  }
  return findStandable(centerX, centerY) ?? spawn
}

/**
 * Applies `D2Game.dll` (`0x6FD01470..0x6FD01566` & `0x6FD0E7B0`) preset transformations for Pandemonium areas `133..136`.
 */
export function applyPandemoniumAreaBootstrap113c(params: {
  readonly level: LocalAreaLevelGeometry
  readonly objects: LocalAreaPresetObject[]
  readonly monsters: LocalAreaPresetMonster[]
  readonly spawn: { readonly x: number; readonly y: number }
  readonly findStandable: (x: number, y: number) => { readonly x: number; readonly y: number } | null
}): void {
  const { level, objects, monsters, spawn, findStandable } = params
  const areaId = level.areaId
  if (!PANDEMONIUM_AREA_IDS_113C.has(areaId)) return

  if (areaId === 133 || areaId === 135) {
    const bossHcIdx = areaId === 133 ? 707 : 706
    let anchor: { readonly x: number; readonly y: number } | null = null
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i]!
      if (obj.classId === 397) {
        if (anchor === null) anchor = { x: obj.x, y: obj.y }
        objects.splice(i, 1)
      }
    }
    const resolved =
      (anchor !== null ? findStandable(anchor.x, anchor.y) : null) ??
      findFallbackBossAnchor(level, spawn, findStandable)
    if (!monsters.some((m) => m.classId === bossHcIdx)) {
      monsters.push(makePresetBossMonster(bossHcIdx, resolved.x, resolved.y, areaId))
    }
    return
  }

  if (areaId === 134) {
    for (let i = objects.length - 1; i >= 0; i--) {
      if (objects[i]!.classId === 402 || objects[i]!.isWaypoint) {
        objects.splice(i, 1)
      }
    }
    const seedVal =
      level.actSpawn !== undefined
        ? level.actSpawn.seed[0] >>> 0
        : ((Math.imul(level.originX ^ 0x9e3779b9, 2654435761) ^ Math.imul(level.originY, 2246822519)) >>> 0)
    // D2Game.dll 0x6FD0E7B0: 1-based counter (seed % 3) + 3 -> 0-based index (seed % 3) + 2 among non-waypoint preset objects.
    const targetOrdinal = (seedVal % 3) + 2
    const candidateObj =
      objects.length > 0 ? objects[Math.min(targetOrdinal, objects.length - 1)] : undefined
    const resolved =
      (candidateObj !== undefined ? findStandable(candidateObj.x, candidateObj.y) : null) ??
      findFallbackBossAnchor(level, spawn, findStandable)
    if (!monsters.some((m) => m.classId === 708)) {
      monsters.push(makePresetBossMonster(708, resolved.x, resolved.y, areaId))
    }
    return
  }

  if (areaId === 136) {
    // D2Game.dll 0x6FD012C0 & 0x6FD014CF..0x6FD01520:
    // Suppress ALL normal Tristram preset monsters (Griswold, Rakanishu, etc.) and strip Wirt (268), CainGibbet (26), CainPortal (269).
    monsters.length = 0
    let gibbetAnchor: { readonly x: number; readonly y: number } | null = null
    for (let i = objects.length - 1; i >= 0; i--) {
      const cid = objects[i]!.classId
      if (cid === 26 && gibbetAnchor === null) {
        gibbetAnchor = { x: objects[i]!.x, y: objects[i]!.y }
      }
      if (cid === 26 || cid === 268 || cid === 269) {
        objects.splice(i, 1)
      }
    }
    const baseAnchor =
      (gibbetAnchor !== null ? findStandable(gibbetAnchor.x, gibbetAnchor.y) : null) ??
      findFallbackBossAnchor(level, spawn, findStandable)
    const offsets: readonly (readonly [number, number])[] = [
      [0, 0],
      [4, -3],
      [-4, 3],
      [5, 4],
      [-5, -4],
      [0, 5],
      [6, 0],
    ]
    const used: { x: number; y: number }[] = []
    for (let idx = 0; idx < UBER_PRIME_EVIL_HC_INDICES_113C.length; idx++) {
      const bossHcIdx = UBER_PRIME_EVIL_HC_INDICES_113C[idx]!
      let chosen: { readonly x: number; readonly y: number } | null = null
      for (let k = idx; k < offsets.length + idx; k++) {
        const [dx, dy] = offsets[k % offsets.length]!
        const cand = findStandable(baseAnchor.x + dx, baseAnchor.y + dy)
        if (cand !== null && !used.some((u) => Math.hypot(u.x - cand.x, u.y - cand.y) < 2)) {
          chosen = cand
          break
        }
      }
      const pos = chosen ?? { x: baseAnchor.x + idx * 2, y: baseAnchor.y + (idx % 2) * 2 }
      used.push({ x: pos.x, y: pos.y })
      monsters.push(makePresetBossMonster(bossHcIdx, pos.x, pos.y, areaId))
    }
  }
}

/**
 * Finds a standable, non-overlapping sub-tile near `(originX, originY)` for a permanent red portal (`classId = 60`),
 * following `D2Game.dll` `0x6FD0F0C9` expanding ring search (`r = 2..12`) so multiple transmuted portals never stack.
 */
export function findFreePortalCoordNear113c(params: {
  readonly originX: number
  readonly originY: number
  readonly existingPortals: readonly { readonly x: number; readonly y: number }[]
  readonly isWalkable: (x: number, y: number) => boolean
  readonly minSeparation?: number | undefined
}): { readonly x: number; readonly y: number } {
  const { originX, originY, existingPortals, isWalkable } = params
  const minSep = params.minSeparation ?? 3
  const cx = Math.round(originX)
  const cy = Math.round(originY)

  const isClear = (x: number, y: number): boolean => {
    if (x === cx && y === cy) return false
    if (!isWalkable(x, y)) return false
    for (const p of existingPortals) {
      if (Math.hypot(p.x - x, p.y - y) < minSep) return false
    }
    return true
  }

  for (let r = 2; r <= 12; r++) {
    const candidates: [number, number][] = [
      [cx + r, cy],
      [cx - r, cy],
      [cx, cy + r],
      [cx, cy - r],
      [cx + r, cy + r],
      [cx - r, cy + r],
      [cx + r, cy - r],
      [cx - r, cy - r],
    ]
    for (let step = 1; step < r; step++) {
      candidates.push(
        [cx + r, cy + step],
        [cx + r, cy - step],
        [cx - r, cy + step],
        [cx - r, cy - step],
        [cx + step, cy + r],
        [cx - step, cy + r],
        [cx + step, cy - r],
        [cx - step, cy - r],
      )
    }
    for (const [tx, ty] of candidates) {
      if (isClear(tx, ty)) return { x: tx, y: ty }
    }
  }
  return { x: cx + 2 + existingPortals.length * 3, y: cy + 2 }
}

/**
 * `D2Game.dll` `0x6FD0AA30..0x6FD0AB09`:
 * Creates the Pandemonium Finale drops when the final (3rd) Uber Prime Evil dies in `areaId === 136`:
 * - `1` × Unique Large Charm `Hellfire Torch` (`code: 'cm2'`, `id: 400`, `ilvl: 110`, `levelreq: 75`,
 *   `+3` to random class `0..6`, `+10..20` all attributes, `+10..20` all resistances, `+8` light radius,
 *   `5%` CtC Level 10 Firestorm on striking, Level 30 `Hydra` `10/10` full charges per `0x6FCF2380`).
 * - `max(1, activePlayerCount)` × `Standard of Heroes` (`code: 'std'`, `ilvl: 90`, `levelreq: 90`).
 */
export function createPandemoniumFinaleDrops113c(params: {
  readonly dropTables: DropTables
  readonly nextSeed: () => number
  readonly activePlayerCount: number
  readonly spawnedUniqueIds?: Set<number> | undefined
}): Item[] {
  const { dropTables, nextSeed, spawnedUniqueIds } = params
  const dropped: Item[] = []

  const cm2Base = dropTables.getBase('cm2')
  const torchUnique =
    dropTables.uniques
      .getEnabledByCode('cm2')
      .find((u) => u.id === 400 || u.index === 'Hellfire Torch') ??
    dropTables.uniques.all.find((u) => u.id === 400 || u.index === 'Hellfire Torch')

  if (cm2Base && torchUnique) {
    const seed = (nextSeed() >>> 0) || 1
    const itemRng = new D2Rng(seed)
    const torchItem = createDroppedItem(cm2Base, 'unique', {
      uniqueItem: torchUnique,
      ethereal: false,
      sockets: 0,
      itemTypes: dropTables.itemTypes,
      ilvl: 110,
      dwInitSeed: seed,
      itemRng,
    })
    spawnedUniqueIds?.add(torchUnique.id)
    dropped.push(torchItem)
  }

  const stdBase = dropTables.getBase('std')
  const stdCount = Math.max(1, Math.trunc(params.activePlayerCount || 1))
  if (stdBase) {
    for (let i = 0; i < stdCount; i++) {
      const seed = (nextSeed() >>> 0) || 1
      const itemRng = new D2Rng(seed)
      const stdItem = createDroppedItem(stdBase, 'normal', {
        ethereal: false,
        sockets: 0,
        itemTypes: dropTables.itemTypes,
        ilvl: 90,
        dwInitSeed: seed,
        itemRng,
        identified: true,
      })
      dropped.push(stdItem)
    }
  }

  return dropped
}
