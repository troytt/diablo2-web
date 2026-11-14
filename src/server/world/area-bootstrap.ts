/**
 * Server-side area bootstrap resolver (issue #1325).
 *
 * The local game server (`GameInstance`) brings areas online on demand — at game entry and on every
 * waypoint / town portal / warp transition — from the DRLG build of the level. The level geometry is
 * produced by whichever DRLG host the process has (the browser's `MapService`, a test fixture, ...) and
 * handed in through `AreaLevelSource`; everything 1.13c-semantic about turning that geometry into game
 * units lives here, inside `src/server`:
 *
 * - preset objects (`UNIT_OBJECT = 2`): Objects.txt row as class; waypoints are the 16 OperateFn 23 rows
 *   (`WAYPOINT_CLASS_IDS_113C`) and start activated (mode 1) in towns; the DRLG `index < 0` "no object"
 *   presets and object 573 are not spawned;
 * - preset monsters (`UNIT_MONSTER = 1`): MonStats.txt hcIdx; town NPCs / vendors come from the canonical
 *   town NPC table (`getTownNpcDescriptorByHcIdx`, NPC.txt vendor ids); an index past the MonStats.txt
 *   rows is a SuperUniques.txt row (`index - monStatsCount`, D2Common MonPreset), never spawned in towns;
 * - warps (`UNIT_TILE = 5`): the level's LvlWarp.txt tiles with their destination level;
 * - spawn: 1.13c `DUNGEON_FindActSpawnLocationEx(pAct, level, 0, &x, &y, 2)` (D2Common `#10816`, #1693):
 *   the seeded style-30 entry marker (or the waypoint / warp-room / centre-room fall-backs of
 *   `Position = 0` levels), then the `0x1C09` free-coordinate search for the player's unit size 2.
 */

import type {
  LocalAreaBootstrap,
  LocalAreaBootstrapResolver,
  LocalAreaLevelGeometry,
  LocalAreaLevelPresetUnit,
  LocalAreaLevelRequest,
  LocalAreaLevelSource,
  LocalAreaLevelWarp,
  LocalAreaPresetMonster,
  LocalAreaPresetObject,
  LocalAreaWarp,
} from '../../netproto/index.ts'
import {
  MONSTATS_113C_ROWS,
  getCanonicalMonsterKinds,
  getSuperUniqueByIndex,
} from '../../common/units/monsters-data.ts'
import { resolveMonPlacePreset113c } from '../../common/units/monai-113c.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { getTownNpcDescriptorByHcIdx } from '../../common/units/npc-table.ts'
import {
  PRE_OPERATE_ROLLED_OBJECTS_113C,
  SPARKLY_CHEST_INIT57_CLASS_IDS_113C,
  rollPreOperateOpen113c,
} from '../../common/world/object-operate-113c.ts'
import { WAYPOINT_CLASS_IDS_113C } from '../../common/world/objects-meta.ts'
import { OBJECTS_TXT_113C } from '../../common/world/objects-txt-113c.ts'
import {
  ACT_SPAWN_TILE_ENTRY,
  collisionGetFreeCoordinates,
  findActSpawnLocationSubTile,
  isBlockedWithUnitSize,
} from '../../common/world/act-spawn-location.ts'
import { populateAreaObjGroups113c } from './objgroup-113c.ts'
import { applyPandemoniumAreaBootstrap113c } from './pandemonium-113c.ts'

/**
 * Canonical 1.13c progression portal destination areas (`D2Game.dll` `OperateFn 34, 44, 46, 50, 66, 70`):
 * - `298` (`ArcaneSanctuaryPortal`, `OperateFn 34` @ `0x6FC8D620`): Palace Cellar L3 (`54`) <-> Arcane Sanctuary (`74`)
 * - `342` (`Hellgate`, `OperateFn 46` @ `0x6FC8CD40`): Durance of Hate L3 (`102`) -> Pandemonium Fortress (`103`)
 * - `366` (`SewerStairs`, `OperateFn 44` @ `0x6FD095E0`): Kurast Sewers L1 (`92`) -> Kurast Sewers L2 (`93`)
 * - `386` (`DuranceOfHateStairs`, `OperateFn 50` @ `0x6FC8F4F0`): Travincal (`83`) -> Durance of Hate L1 (`100`)
 * - `547` (`AncientsDoor`, `OperateFn 66` @ `0x6FC7E2E0`): Arreat Summit (`120`) -> Worldstone Keep Level 1 (`128`)
 * - `564` (`SummitDoor` / `Glacial Caves Level 1`, `OperateFn 71` @ `0x6FC7D690`): Arreat Summit (`120`) -> The Ancients' Way (`118`)
 * - `563` (`BaalsPortal`, `OperateFn 70` @ `0x6FC7DF70`): Throne of Destruction (`131`) -> The Worldstone Chamber (`132`)
 * - `569` (`BaalsPortalReturn`, `OperateFn 70` @ `0x6FC7DFDE`): The Worldstone Chamber (`132`) -> Throne of Destruction (`131`)
 */
export function resolvePresetPortalDestArea113c(
  classId: number,
  areaId: number,
): number | undefined {
  if (classId === 298) {
    if (areaId === 54) return 74
    if (areaId === 74) return 54
    return 74
  }
  if (classId === 342) return 103
  if (classId === 366) return areaId === 92 ? 93 : undefined
  if (classId === 386) return 100
  if (classId === 547) return 128
  if (classId === 564) return areaId === 120 ? 118 : undefined
  if (classId === 563) return 132
  if (classId === 569) return 131
  return undefined
}

/** Levels.txt ids of the five towns (Rogue Encampment, Lut Gholein, Kurast Docks, Pandemonium Fortress, Harrogath). */
export const TOWN_AREA_IDS_113C: ReadonlySet<number> = new Set([1, 40, 75, 103, 109])

/** Sub-tiles per DRLG tile. */
const SUB_TILES_PER_TILE = 5
/** `UNITS_GetUnitSizeX` (`#10589` `0x6FD80F80`) of a player: 2 (jump-table case `UNIT_PLAYER`). */
const PLAYER_UNIT_SIZE = 2
/** Objects.txt 573 — never spawned from DRLG presets (`D2Game.dll` `0x6fd012f1`). */
const OBJECT_SKIPPED_PRESET = 573
/**
 * 1.13c D2Game preset chest pools (`0x6fc522b0`, `0x6fd2e1bc` dispatch for preset IDs `574..582`):
 * - Act 1/4/5 (`act === 0, 3, 4`): 13 chest classes (`0x6fd1ccd8`)
 * - Act 2 Arcane Sanctuary (`areaId === 74`): 4 chest classes (`0x6fd1cc9c`)
 * - Act 2 other (`areaId in 40..73`): 2 chest classes (`[87, 88]`)
 * - Act 3 Travincal (`areaId === 83`): 4 chest classes (`0x6fd1ccac`)
 * - Act 3 other (`areaId in 75..102`): 2 chest classes (`[181, 183]`)
 */
const PRESET_CHEST_POOL_ACT1_4_5: readonly number[] = [
  5, 6, 139, 140, 141, 144, 176, 177, 198, 240, 241, 242, 243,
]
const PRESET_CHEST_POOL_ARCANE: readonly number[] = [387, 389, 390, 391]
const PRESET_CHEST_POOL_ACT2: readonly number[] = [87, 88]
const PRESET_CHEST_POOL_TRAVINCAL: readonly number[] = [329, 330, 331, 332]
const PRESET_CHEST_POOL_ACT3: readonly number[] = [181, 183]

/**
 * Resolve a DRLG preset object index (`u.index`) to a real `Objects.txt` row (`0..572`)
 * per `D2Game.dll` `0x6fd012d0` -> `0x6fc4e830` (`0x6fd2e1bc` pseudo-object table):
 * - `< 0` or `573` or `> 582`: not spawned (`null`)
 * - `0..572`: direct `Objects.txt` row
 * - `574..579` (`0x6fc525c0`): `classId = 136`
 * - `580` (`0x6fc531b0` Super Chest): `371` in area 25, else Act/Level chest pool + `isSparkling`
 * - `581` (`0x6fc522b0` Preset Chest): Act/Level chest pool
 * - `582` (`0x6fc52110` Tomb Orifice placeholder): `classId = 307`
 */
export function resolvePresetObject113c(
  presetIndex: number,
  areaId: number,
  subXOrRng?: number | ((max: number) => number) | undefined,
  subY?: number,
  rng?: ((max: number) => number) | undefined,
): { readonly classId: number; readonly isSparkling?: boolean | undefined } | null {
  if (presetIndex < 0 || presetIndex === OBJECT_SKIPPED_PRESET || presetIndex > 582) {
    return null
  }
  if (presetIndex < OBJECT_SKIPPED_PRESET) {
    return SPARKLY_CHEST_INIT57_CLASS_IDS_113C.has(presetIndex)
      ? { classId: presetIndex, isSparkling: true }
      : { classId: presetIndex }
  }
  if (presetIndex >= 574 && presetIndex <= 579) {
    return { classId: 136 }
  }
  if (presetIndex === 582) {
    return { classId: 307 }
  }
  // 1.13c D2Game.dll 0x6fc522b0 & 0x6fc531b0:
  // Random chest class and sparkling status are rolled via game seed / RNG.
  const roll: (n: number) => number =
    typeof subXOrRng === 'function'
      ? subXOrRng
      : typeof rng === 'function'
        ? rng
        : (n: number) => {
            const sx = typeof subXOrRng === 'number' ? subXOrRng : 0
            const sy = typeof subY === 'number' ? subY : 0
            const h =
              (Math.imul(areaId, 73856093) ^
                Math.imul(sx, 19349663) ^
                Math.imul(sy, 83492791)) >>>
              0
            return h % n
          }

  let classId: number
  if (presetIndex === 580 && areaId === 25) {
    classId = 371
  } else {
    let pool: readonly number[]
    if (areaId === 74) {
      pool = PRESET_CHEST_POOL_ARCANE
    } else if (areaId >= 40 && areaId < 75) {
      pool = PRESET_CHEST_POOL_ACT2
    } else if (areaId === 83) {
      pool = PRESET_CHEST_POOL_TRAVINCAL
    } else if (areaId >= 75 && areaId < 103) {
      pool = PRESET_CHEST_POOL_ACT3
    } else {
      pool = PRESET_CHEST_POOL_ACT1_4_5
    }
    const idx = roll(pool.length)
    classId = pool[idx]!
  }
  if (presetIndex === 580) {
    // 1.13c D2Game.dll 0x6fc531b0: Maggot Lair (areas 62..64) rolls rand(100) <= 50 (51% chance, 51 values out of 100)
    // to mark as super chest; 100% elsewhere.
    const isSuper =
      areaId >= 62 && areaId <= 64
        ? roll(100) <= 50
        : true
    return isSuper ? { classId, isSparkling: true } : { classId }
  }
  return { classId }
}
/** Spiral radius (sub-tiles) searched for standable floor around a landmark landing (waypoint, warp). */
export const LANDING_SEARCH_RADIUS = 25

/** Level geometry contract (netproto, shared with the browser DRLG host). */
export type AreaLevelPresetUnit = LocalAreaLevelPresetUnit
export type AreaLevelWarp = LocalAreaLevelWarp
export type AreaLevelGeometry = LocalAreaLevelGeometry
export type AreaLevelRequest = LocalAreaLevelRequest
export type AreaLevelSource = LocalAreaLevelSource

/** Walkability of world sub-tile `(x, y)` in `level` (outside the grid = void = blocked). */
export function isLevelSubTileWalkable(
  level: AreaLevelGeometry,
  x: number,
  y: number,
  isFlying = false,
): boolean {
  const sx = Math.floor(x) - level.originX
  const sy = Math.floor(y) - level.originY
  if (sx < 0 || sy < 0 || sx >= level.subWidth || sy >= level.subHeight) return false
  const idx = sy * level.subWidth + sx
  if (isFlying && level.collision !== undefined && level.collision.length === level.blocked.length) {
    // 1.13c COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR (0x0804): water pools carry walk-only
    // COLLIDE_WALL (0x0001) so missiles, flying units, and water-watcher sight cross them.
    return (level.collision[idx]! & 0x0804) === 0
  }
  return level.blocked[idx] === 0
}

/**
 * Standable floor: the sub-tile and its 8 neighbours are walkable, so the unit is grounded on connected
 * floor instead of a single isolated walkable sub-tile inside a wall.
 */
export function isStandableSubTile(
  isWalkable: (x: number, y: number) => boolean,
  x: number,
  y: number,
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!isWalkable(x + dx, y + dy)) return false
    }
  }
  return true
}

/**
 * Nearest standable sub-tile to `(x, y)` on growing square rings (`r = 0..maxRadius`); `null` when
 * there is none (the caller must refuse the placement instead of dropping the unit in void).
 */
export function findStandableNear(
  isWalkable: (x: number, y: number) => boolean,
  x: number,
  y: number,
  maxRadius: number = LANDING_SEARCH_RADIUS,
): { readonly x: number; readonly y: number } | null {
  const cx = Math.round(x)
  const cy = Math.round(y)
  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        if (isStandableSubTile(isWalkable, cx + dx, cy + dy)) {
          return { x: cx + dx, y: cy + dy }
        }
      }
    }
  }
  return null
}

/** Turns one level's DRLG geometry into the units, warps, rooms and spawn the game server needs. */
export function buildAreaBootstrap(
  level: AreaLevelGeometry,
  rng?: ((max: number) => number) | undefined,
): LocalAreaBootstrap {
  const areaId = level.areaId
  const isTown = TOWN_AREA_IDS_113C.has(areaId)
  const walkable = (x: number, y: number): boolean => isLevelSubTileWalkable(level, x, y)

  const objects: LocalAreaPresetObject[] = []
  const monsters: LocalAreaPresetMonster[] = []

  for (const u of level.presetUnits) {
    const x = level.originX + u.subX
    const y = level.originY + u.subY
    if (u.type === 2) {
      const resolved = resolvePresetObject113c(u.index, areaId, u.subX, u.subY, rng)
      if (resolved === null) continue
      const isWaypoint = WAYPOINT_CLASS_IDS_113C.has(resolved.classId)
      const destAreaId = resolvePresetPortalDestArea113c(resolved.classId, areaId)
      objects.push({
        classId: resolved.classId,
        x,
        y,
        areaId,
        mode: isWaypoint && isTown ? 1 : u.mode,
        isWaypoint,
        ...(resolved.isSparkling ? { isSparkling: true } : {}),
        ...(destAreaId !== undefined ? { destAreaId } : {}),
      })
    } else if (u.type === 1) {
      if (u.index < 0) continue
      if (u.index >= MONSTATS_113C_ROWS.length) {
        const superUniqueIndex = u.index - MONSTATS_113C_ROWS.length
        const su = getSuperUniqueByIndex(superUniqueIndex)
        if (su) {
          if (isTown) continue
          const suKind = getCanonicalMonsterKinds('normal').get(su.monsterId)
          if (suKind?.hcIdx === undefined) continue
          monsters.push({ classId: suKind.hcIdx, x, y, areaId, superUniqueIndex })
          continue
        }
        // 1.13c MonPreset type 0 (`MonPlace.txt` rows, `u.index >= nMonStats + nSuperUniques` = 800):
        // D2Game.dll 0x6FC67E6D resolves deterministic presets such as Act 3 water pool TentacleHead (10/11).
        const SUPERUNIQUES_TXT_COUNT_113C = 66
        if (superUniqueIndex >= SUPERUNIQUES_TXT_COUNT_113C && !isTown) {
          const monPlace = resolveMonPlacePreset113c(
            superUniqueIndex - SUPERUNIQUES_TXT_COUNT_113C,
            areaId,
          )
          if (monPlace !== null) {
            if (monPlace.superUniqueIndex !== undefined) {
              monsters.push({
                classId: monPlace.classId,
                x,
                y,
                areaId,
                superUniqueIndex: monPlace.superUniqueIndex,
              })
              continue
            }
            const mpRow = MONSTATS_113C_ROWS[monPlace.classId]
            if (mpRow) {
              const mpTownNpc = getTownNpcDescriptorByHcIdx(monPlace.classId)
              const mpIsVendor = mpTownNpc !== undefined && mpTownNpc.vendorId !== null
              const mpIsNpc = mpRow.npc || mpTownNpc !== undefined
              const mpIsKillable = !mpIsNpc && mpRow.killable
              monsters.push({
                classId: monPlace.classId,
                x,
                y,
                areaId,
                isNpc: mpIsNpc,
                isVendor: mpIsVendor,
                isKillable: mpIsKillable,
                aiDisabled: mpIsNpc,
              })
            }
          }
        }
        continue
      }
      const townNpc = getTownNpcDescriptorByHcIdx(u.index)
      const isVendor = townNpc !== undefined && townNpc.vendorId !== null
      const row = MONSTATS_113C_ROWS[u.index]
      if (!row) {
        throw new Error(`area bootstrap: missing MonStats entry for hcIdx ${u.index}`)
      }
      const isNpc = row.npc || townNpc !== undefined
      const isKillable = !isNpc && row.killable
      monsters.push({
        classId: u.index,
        x,
        y,
        areaId,
        isNpc,
        isVendor,
        isKillable,
        aiDisabled: isNpc,
        ...(u.mapAi !== undefined ? { mapAi: u.mapAi } : {}),
      })
    }
  }

  const warps: LocalAreaWarp[] = level.warps.map((w) => ({
    lvlWarpId: w.lvlWarpId,
    x: level.originX + w.subX,
    y: level.originY + w.subY,
    destAreaId: w.toLevelId,
  }))

  // #1693: game join / respawn / act change land on DUNGEON_FindActSpawnLocationEx(.., 0, .., 2). The
  // locator owns the area's copy of the level seed; the game server calls it once per arrival so every
  // arrival rolls like 1.13c. `spawnX/Y` is the result the next call would give (a peek on a copy of
  // the seed). Geometry without the DRLG capture (synthetic test levels) carries the core's tile
  // directly in spawnTileX/Y; #10816 then applies the same *5+3 + free-coordinate search.
  const locate = level.actSpawn !== undefined ? createActSpawnLocator(level) : undefined
  const spawn =
    level.actSpawn !== undefined
      ? createActSpawnLocator(level)(ACT_SPAWN_TILE_ENTRY, PLAYER_UNIT_SIZE)
      : spawnFromGeometryTile(level)

  // #1841: 1.13c Pandemonium Event (`D2Game.dll` `0x6FD01470..0x6FD01566` & `0x6FD0E7B0`):
  // replace preset anchors in `133..136` with Lilith (#707), Uber Duriel (#708), Uber Izual (#706),
  // and the Uber Tristram Trio (#704, #705, #709) while suppressing normal Tristram preset monsters in `136`.
  applyPandemoniumAreaBootstrap113c({
    level,
    objects,
    monsters,
    spawn,
    findStandable: (ax, ay) => findStandableNear(walkable, ax, ay, 45),
  })

  // #1840: 1.13c `OBJECTS_PopulateRoom` (`D2Game.dll` `0x6FC4F1C3`): populate procedural shrines,
  // wells, and field/dungeon containers across all DRLG rooms (`Levels.txt` `ObjGrp0..7` / `ObjPrb0..7`).
  const proceduralObjects = populateAreaObjGroups113c({
    level,
    existingObjects: objects,
    warps,
    spawn,
  })
  if (proceduralObjects.length > 0) {
    objects.push(...proceduralObjects)
  }

  // #1918: 1.13c `OBJECTS_Init` (`D2Game.dll` `0x6FC4F480`): un-locked containers with `PreOperate === 1`
  // have a `1/14` (`7.14%`) chance to spawn in `OBJMODE_OPENED (2)` decorative state.
  if (!isTown) {
    const fallbackRng =
      rng === undefined
        ? new D2Rng(
            (((level.roomRects[0]?.seed ?? Math.imul(areaId, 0x9e3779b9)) ^
              Math.imul(level.originX ^ (level.originY << 8), 0x85ebca6b)) >>>
              0) || 1,
          )
        : null
    const preOpRng =
      rng !== undefined
        ? { rand: (max: number) => Math.max(0, Math.trunc(rng(max))) % Math.max(1, max) }
        : { rand: (max: number) => fallbackRng!.rand(max) }
    for (let i = 0; i < objects.length; i += 1) {
      const obj = objects[i]!
      if (obj.mode === 0 && rollPreOperateOpen113c(obj.classId, false, preOpRng)) {
        const opened: LocalAreaPresetObject = { ...obj, mode: 2 }
        PRE_OPERATE_ROLLED_OBJECTS_113C.add(opened)
        objects[i] = opened
      } else {
        PRE_OPERATE_ROLLED_OBJECTS_113C.add(obj)
      }
    }
  }

  return {
    areaId,
    spawnX: spawn.x,
    spawnY: spawn.y,
    rooms: level.rooms.map((r) => ({ areaId: r.areaId, tileX: r.tileX, tileY: r.tileY })),
    roomRects: level.roomRects.map((r) => ({ ...r })),
    adjacentAreaIds: level.adjacentAreaIds?.slice() ?? [],
    objects,
    monsters,
    warps,
    originX: level.originX,
    originY: level.originY,
    subWidth: level.subWidth,
    subHeight: level.subHeight,
    ...(level.collision !== undefined ? { collision: level.collision.slice() } : {}),
    isWalkable: (checkAreaId, x, y, isFlying) =>
      checkAreaId === areaId && isLevelSubTileWalkable(level, x, y, Boolean(isFlying)),
    ...(locate !== undefined ? { findActSpawnLocation: locate } : {}),
  }
}

/**
 * `#10816` tail on a precomputed core tile (`spawnTileX/Y`): tile `*5+3`, then
 * `COLLISION_GetFreeCoordinates` (mask `0x1C09`, radius 50, step 1) for the player's unit size.
 */
function spawnFromGeometryTile(level: AreaLevelGeometry): { x: number; y: number } {
  const isCellBlocked = (x: number, y: number): boolean =>
    !isLevelSubTileWalkable(level, level.originX + x, level.originY + y)
  const free = collisionGetFreeCoordinates(
    (x, y) => !isBlockedWithUnitSize(isCellBlocked, x, y, PLAYER_UNIT_SIZE),
    level.spawnTileX * SUB_TILES_PER_TILE + 3,
    level.spawnTileY * SUB_TILES_PER_TILE + 3,
  )
  if (free === null) {
    throw new Error(`area bootstrap: level ${String(level.areaId)} has no free cell near its start tile`)
  }
  return { x: level.originX + free.x, y: level.originY + free.y }
}

/**
 * 1.13c `DUNGEON_FindActSpawnLocationEx` (D2Common `#10816` `0x6FD8CDF0`) bound to one area: the level
 * seed is copied once from the DRLG capture and advanced by every call (`sub_6FD69B60` always rolls when a
 * record matches), like `pLevel->pSeed` in the original server. Returns world sub-tiles.
 */
export function createActSpawnLocator(
  level: AreaLevelGeometry,
): (nTileIndex: number, nUnitSize: number) => { x: number; y: number } {
  const capture = level.actSpawn
  if (capture === undefined) {
    throw new Error(`area bootstrap: level ${String(level.areaId)} has no DUNGEON_FindActSpawnLocationEx capture`)
  }
  const seed = { lo: capture.seed[0] >>> 0, hi: capture.seed[1] >>> 0 }
  // COLLISION_CheckCollisionMask(room, x, y, 0x1C09): the geometry's `blocked` grid is exactly
  // `mask & 0x1C09` (COLLIDE_MASK_PLAYER_PATH); cells outside every room read as blocked.
  const isCellBlocked = (x: number, y: number): boolean =>
    !isLevelSubTileWalkable(level, level.originX + x, level.originY + y)
  return (nTileIndex, nUnitSize) => {
    const local = findActSpawnLocationSubTile(capture.level, nTileIndex, seed, nUnitSize, isCellBlocked)
    return { x: level.originX + local.x, y: level.originY + local.y }
  }
}

/** The resolver injected into `GameInstance`: builds the level through `source`, then `buildAreaBootstrap`. */
export function createAreaBootstrapResolver(
  source: AreaLevelSource,
  rng?: ((max: number) => number) | undefined,
): LocalAreaBootstrapResolver {
  return (request) => {
    const level = source(request)
    if (level === null) return null
    if (level.areaId !== request.areaId) {
      throw new Error(
        `area bootstrap: level source returned level ${level.areaId} for requested area ${request.areaId}`,
      )
    }
    if (level.blocked.length !== level.subWidth * level.subHeight) {
      throw new Error(
        `area bootstrap: level ${level.areaId} collision grid has ${level.blocked.length} cells, expected ${level.subWidth}x${level.subHeight}`,
      )
    }
    return buildAreaBootstrap(level, rng)
  }
}
