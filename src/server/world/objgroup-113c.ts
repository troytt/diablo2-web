/**
 * Diablo II v1.13c procedural room object population (`Levels.txt` `ObjGrp0..7` / `ObjPrb0..7` + `Objgroup.txt`, #1840).
 *
 * Ground truth:
 * - `D2Game.dll` `OBJECTS_PopulateRoom` (`0x6FC4F1C3..0x6FC4F2B9`) & `D2Common.#10465` (`DATATBLS_GetObjGroupTxtRecord`, `0x6FD8E960`).
 * - `Objects.txt` `PopulateFn` (`0..9`, `D2Game.dll` `0x6FD2E190` jump table):
 *   - `0`: never populated procedurally
 *   - `1`: Casket / Sarcophagus / Urn (`0x6FC51110`)
 *   - `2`: Shrine (`0x6FC52850`: 1 per slot roll, >= 30 sub-tiles minimum spacing between shrines)
 *   - `3`: Chest / Container (`0x6FC52D40`)
 *   - `4`: Barrel (`0x6FC50850`)
 *   - `5`: Crate (`0x6FC501A0`)
 *   - `6`: Rogue Corpse (`0x6FC50DC0`)
 *   - `7`: Staked Corpse (`0x6FC50B30`)
 *   - `8`: Well (`0x6FC529E0`: 1 per slot roll, level cap `min(4, max(1, (numRooms + 7) >> 3))`)
 *   - `9`: Trapped Soul (`0x6FC52C20`)
 */

import type {
  LocalAreaLevelGeometry,
  LocalAreaPresetObject,
  LocalAreaWarp,
} from '../../netproto/index.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { classifyObjectOperate113c } from '../../common/world/object-operate-113c.ts'
import { CANONICAL_113C_OBJECTS, WAYPOINT_CLASS_IDS_113C } from '../../common/world/objects-meta.ts'
import { OBJECTS_TXT_113C } from '../../common/world/objects-txt-113c.ts'
import {
  LEVEL_OBJGRP_113C,
  OBJECT_POPULATE_FN_113C,
  OBJGROUP_TXT_113C,
} from './objgroup-data-113c.ts'

/** 1.13c `D2Game.dll` `0x6FC52880`: minimum sub-tile spacing (`0x1E = 30`) between procedural shrines. */
export const SHRINE_MIN_SPACING_SUBTILES_113C = 30

/** Minimum clearance (sub-tiles) from spawn, warps, and doors so procedural objects never block transitions. */
const LANDMARK_CLEARANCE_SUBTILES = 5

/** Minimum clearance (sub-tiles) between any two non-shrine objects. */
const OBJECT_CLEARANCE_SUBTILES = 3

/** Max placement attempts per procedural object instance inside one DRLG room. */
const PLACEMENT_ATTEMPTS_PER_OBJECT = 24

const TOWN_AREA_SET: ReadonlySet<number> = new Set([1, 40, 75, 103, 109])

function isSubTileWalkable(level: LocalAreaLevelGeometry, x: number, y: number): boolean {
  const sx = Math.floor(x) - level.originX
  const sy = Math.floor(y) - level.originY
  if (sx < 0 || sy < 0 || sx >= level.subWidth || sy >= level.subHeight) return false
  return level.blocked[sy * level.subWidth + sx] === 0
}

/**
 * Connected floor + anti-chokepoint check:
 * - Full `3x3` walkable neighborhood around `(x, y)` (`isStandableSubTile`).
 * - At least `12` of the `16` outer `5x5` ring sub-tiles must be walkable so 3-sub-tile doorways,
 *   bridges, and Maggot Lair / Arcane Sanctuary narrow corridors are never plugged by containers.
 */
function isSafeOpenFloor(level: LocalAreaLevelGeometry, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!isSubTileWalkable(level, x + dx, y + dy)) return false
    }
  }
  let outerWalkable = 0
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue
      if (isSubTileWalkable(level, x + dx, y + dy)) outerWalkable++
    }
  }
  return outerWalkable >= 12
}

export interface PopulateAreaObjGroupsOptions113c {
  readonly level: LocalAreaLevelGeometry
  readonly existingObjects: readonly LocalAreaPresetObject[]
  readonly warps: readonly LocalAreaWarp[]
  readonly spawn: { readonly x: number; readonly y: number }
  readonly seedOverride?: number | undefined
}

/**
 * Populate procedural objects (`Shrine`, `Well`, `Chest`, `Casket`, `Urn`, `Barrel`, `Crate`, `RogueCorpse`, `TrappedSoul`)
 * across all DRLG rooms of `level` per `Levels.txt` `ObjGrp0..7` / `ObjPrb0..7` and `Objgroup.txt`.
 */
export function populateAreaObjGroups113c(
  options: PopulateAreaObjGroupsOptions113c,
): LocalAreaPresetObject[] {
  const { level, existingObjects, warps, spawn, seedOverride } = options
  const areaId = level.areaId
  if (TOWN_AREA_SET.has(areaId) || level.roomRects.length === 0) return []

  const levelSpec = LEVEL_OBJGRP_113C[areaId]
  if (!levelSpec) return []
  let hasActiveSlot = false
  for (let i = 0; i < 8; i++) {
    if (levelSpec.objGrp[i]! > 0 && levelSpec.objPrb[i]! > 0) {
      hasActiveSlot = true
      break
    }
  }
  if (!hasActiveSlot) return []

  // D2Game.dll 0x6FC52A34..0x6FC52A47: level well cap from room count.
  const maxWells = Math.min(4, Math.max(1, (level.roomRects.length + 7) >> 3))
  let wellsCount = 0

  const landmarks: { readonly x: number; readonly y: number }[] = [{ x: spawn.x, y: spawn.y }]
  for (const w of warps) {
    landmarks.push({ x: w.x, y: w.y })
  }

  const occupied: { readonly x: number; readonly y: number }[] = []
  const shrines: { readonly x: number; readonly y: number }[] = []

  for (const obj of existingObjects) {
    occupied.push({ x: obj.x, y: obj.y })
    const rec = OBJECTS_TXT_113C[obj.classId]
    if (rec?.isDoor === 1 || obj.isWaypoint || WAYPOINT_CLASS_IDS_113C.has(obj.classId)) {
      landmarks.push({ x: obj.x, y: obj.y })
    }
    if (obj.isShrine || CANONICAL_113C_OBJECTS[obj.classId]?.isShrine || rec?.operateFn === 2) {
      shrines.push({ x: obj.x, y: obj.y })
    }
    if (classifyObjectOperate113c(obj.classId) === 'well') {
      wellsCount++
    }
  }

  const spawned: LocalAreaPresetObject[] = []
  const landmarkClearSq = LANDMARK_CLEARANCE_SUBTILES * LANDMARK_CLEARANCE_SUBTILES
  const objClearSq = OBJECT_CLEARANCE_SUBTILES * OBJECT_CLEARANCE_SUBTILES
  const shrineClearSq = SHRINE_MIN_SPACING_SUBTILES_113C * SHRINE_MIN_SPACING_SUBTILES_113C

  const canPlaceAt = (x: number, y: number, isShrine: boolean): boolean => {
    if (!isSafeOpenFloor(level, x, y)) return false
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i]!
      const dx = x - lm.x
      const dy = y - lm.y
      if (dx * dx + dy * dy < landmarkClearSq) return false
    }
    for (let i = 0; i < occupied.length; i++) {
      const oc = occupied[i]!
      const dx = x - oc.x
      const dy = y - oc.y
      if (dx * dx + dy * dy < objClearSq) return false
    }
    if (isShrine) {
      for (let i = 0; i < shrines.length; i++) {
        const sh = shrines[i]!
        const dx = x - sh.x
        const dy = y - sh.y
        if (dx * dx + dy * dy < shrineClearSq) return false
      }
    }
    return true
  }

  for (let rIdx = 0; rIdx < level.roomRects.length; rIdx++) {
    const room = level.roomRects[rIdx]!
    if (room.w < 6 || room.h < 6) continue

    const baseSeed =
      seedOverride !== undefined
        ? (seedOverride ^ Math.imul(rIdx + 1, 0x85ebca6b)) >>> 0
        : (room.seed ^
            Math.imul(areaId, 0x9e3779b1) ^
            Math.imul((room.index ?? rIdx) + 1, 0x85ebca6b) ^
            Math.imul(room.x, 73856093) ^
            Math.imul(room.y, 19349663)) >>>
          0
    const roomRng = new D2Rng(baseSeed || 1)

    const innerW = room.w - 4
    const innerH = room.h - 4
    if (innerW <= 0 || innerH <= 0) continue

    for (let slot = 0; slot < 8; slot++) {
      const grpId = levelSpec.objGrp[slot]!
      const grpPrb = levelSpec.objPrb[slot]!
      if (grpId <= 0 || grpPrb <= 0) continue

      const group = OBJGROUP_TXT_113C[grpId]
      if (!group || group.ids[0] <= 0) continue

      // D2Game.dll 0x6FC4F1F8: roll slot probability (0..99 < ObjPrb[slot]).
      if (roomRng.rand(100) >= grpPrb) continue

      // D2Game.dll 0x6FC4F228..0x6FC4F26E: weighted selection across ID0..ID7 using PROB0..PROB7.
      let totalProb = 0
      for (let m = 0; m < 8; m++) {
        const cid = group.ids[m]!
        const prb = group.probs[m]!
        if (cid > 0 && cid < OBJECT_POPULATE_FN_113C.length && prb > 0) {
          totalProb += prb
        }
      }
      if (totalProb <= 0) continue

      let pick = roomRng.rand(totalProb)
      let chosenMember = -1
      for (let m = 0; m < 8; m++) {
        const cid = group.ids[m]!
        const prb = group.probs[m]!
        if (cid <= 0 || cid >= OBJECT_POPULATE_FN_113C.length || prb <= 0) continue
        if (pick < prb) {
          chosenMember = m
          break
        }
        pick -= prb
      }
      if (chosenMember < 0) continue

      const classId = group.ids[chosenMember]!
      const popFn = OBJECT_POPULATE_FN_113C[classId] ?? 0
      if (popFn === 0) continue

      const objTxt = OBJECTS_TXT_113C[classId]
      if (!objTxt || objTxt.name.toLowerCase() === 'dummy') continue

      // Unused Objects.txt rows 110/112/114 have PopulateFn=8 but OperateFn=0.
      if (popFn === 8 && objTxt.operateFn !== 22) continue
      if (popFn === 8 && wellsCount >= maxWells) continue

      const isShrine = Boolean(
        popFn === 2 || CANONICAL_113C_OBJECTS[classId]?.isShrine || objTxt.operateFn === 2,
      )

      let targetCount = 0
      if (popFn === 2 || popFn === 8 || popFn === 6) {
        targetCount = 1
      } else if (popFn === 7) {
        targetCount = 1 + roomRng.rand(2)
      } else {
        // PopulateFn 1, 3, 4, 5, 9: D2Game.dll (((room.w * room.h) >> 7) * density) >> 8 (+ fractional roll).
        const density = Math.min(128, Math.max(0, group.densities[chosenMember]!))
        if (density <= 0) continue
        const scaled = ((room.w * room.h) >> 7) * density
        targetCount = (scaled >> 8) + (roomRng.rand(256) < (scaled & 0xff) ? 1 : 0)
        if (targetCount === 0 && room.w * room.h >= 192 && roomRng.rand(128) < density) {
          targetCount = 1
        }
        targetCount = Math.min(6, targetCount)
      }

      for (let n = 0; n < targetCount; n++) {
        if (popFn === 8 && wellsCount >= maxWells) break
        let placedX = -1
        let placedY = -1
        for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS_PER_OBJECT; attempt++) {
          const cx = room.x + 2 + roomRng.rand(innerW)
          const cy = room.y + 2 + roomRng.rand(innerH)
          if (canPlaceAt(cx, cy, isShrine)) {
            placedX = cx
            placedY = cy
            break
          }
        }
        if (placedX < 0) continue

        occupied.push({ x: placedX, y: placedY })
        if (isShrine) shrines.push({ x: placedX, y: placedY })
        if (popFn === 8) wellsCount++

        spawned.push({
          classId,
          x: placedX,
          y: placedY,
          areaId,
          mode: 0,
          isWaypoint: false,
          ...(isShrine ? { isShrine: true } : {}),
        })
      }
    }
  }

  return spawned
}
