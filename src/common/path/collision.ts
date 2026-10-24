/**
 * Diablo II 1.13c D2Common collision-grid primitives used by the dynamic-path code (Refs #808).
 *
 * Port of `D2Common.dll` 1.13c 0x6FD9AA90-0x6FD9D800 (D2MOO `source/D2Common/src/D2Collision.cpp:317-1253`).
 * Every function below was compared instruction-by-instruction with the 1.13c disassembly; the D2MOO
 * source matches except where a doc comment says otherwise (`COLLISION_TrySetUnitCollisionMask`).
 *
 * Room lookup is `DUNGEON_GetRoomAtPosition` (0x6FD51330): the room itself, then its adjacency list.
 * A cell that is in no reachable room reads as {@link COLLIDE_MASK_INVALID} (0x27, NOT masked).
 */

import { type PathRoom, d2Assert } from './types.ts'

// ---------------------------------------------------------------------------
// D2C_CollisionMaskFlags (D2MOO include/D2Collision.h:38-80; equal to src/common/world/d2map.ts)
// ---------------------------------------------------------------------------

export const COLLIDE_NONE = 0x0000
export const COLLIDE_WALL = 0x0001
export const COLLIDE_VISIBLE = 0x0002
export const COLLIDE_MISSILE_BARRIER = 0x0004
export const COLLIDE_NOPLAYER = 0x0008
export const COLLIDE_PRESET = 0x0010
export const COLLIDE_BLANK = 0x0020
export const COLLIDE_MISSILE = 0x0040
export const COLLIDE_PLAYER = 0x0080
export const COLLIDE_MONSTER = 0x0100
export const COLLIDE_ITEM = 0x0200
export const COLLIDE_OBJECT = 0x0400
export const COLLIDE_DOOR = 0x0800
export const COLLIDE_NO_PATH = 0x1000
export const COLLIDE_PET = 0x2000
export const COLLIDE_CORPSE = 0x8000
export const COLLIDE_ALL_MASK = 0xffff
/** `COLLIDE_BLANK | COLLIDE_MISSILE_BARRIER | COLLIDE_VISIBLE | COLLIDE_WALL` = 0x27 (0x6FD9B54A `mov ax,0x27`). */
export const COLLIDE_MASK_INVALID = 0x0027
/** Player move-test mask 0x1C09 (PATH_AllocDynamicPath 0x6FD86030). */
export const COLLIDE_MASK_PLAYER_PATH = 0x1c09
/** 0x1804: flying monster move-test mask (0x6FD85100, MonStats `flying`). */
export const COLLIDE_MASK_FLYING_UNIT = 0x1804
/** 0x3401: monster that can open doors (0x6FD85100, MonStats `opendoors`). */
export const COLLIDE_MASK_MONSTER_THAT_CAN_OPEN_DOORS = 0x3401
/** 0x3C01: default monster move-test mask (0x6FD85100). */
export const COLLIDE_MASK_MONSTER_PATH = 0x3c01
/** 0x0804 (`COLLIDE_DOOR | COLLIDE_MISSILE_BARRIER`): BaseId 38 (wraith) move mask (0x6FD86030). */
export const COLLIDE_MASK_PLAYER_FLYING = 0x0804
/** 0x0806: door object with `BlocksVis` (UNITS_GetCollisionMask). */
export const COLLIDE_MASK_DOOR_BLOCK_VIS = 0x0806

// ---------------------------------------------------------------------------
// Room lookup
// ---------------------------------------------------------------------------

function roomContains(r: PathRoom, nX: number, nY: number): boolean {
  return nX >= r.subX && nX < r.subX + r.subW && nY >= r.subY && nY < r.subY + r.subH
}

/**
 * `DUNGEON_GetRoomAtPosition` (D2Common 1.13c 0x6FD51330, eax=pRoom ebx=x edi=y; D2MOO
 * `COLLISION_GetRoomBySubTileCoordinates` D2Collision.cpp:1900). NULL room -> NULL; the room itself
 * if it contains (x, y) (signed compares on `tCoords.nSubtileX/Y/Width/Height` +0x4C..+0x58), else
 * the first entry of `ppRoomList` (+0x00, count +0x24; NULL entries skipped) that contains it.
 */
export function DUNGEON_GetRoomAtPosition(pRoom: PathRoom | null, nX: number, nY: number): PathRoom | null {
  if (!pRoom) return null
  if (roomContains(pRoom, nX, nY)) return pRoom
  for (const r of pRoom.adjacentRooms) {
    if (r && roomContains(r, nX, nY)) return r
  }
  return null
}

// ---------------------------------------------------------------------------
// Single cells
// ---------------------------------------------------------------------------

/**
 * `COLLISION_CheckCollisionMask` (1.13c 0x6FD9B510, duplicate 0x6FD9C570; D2MOO D2Collision.cpp:545).
 * Returns `mask[x,y] & nMask`, or {@link COLLIDE_MASK_INVALID} (unmasked) when the cell is in no room
 * or the room has no collision grid.
 */
export function COLLISION_CheckCollisionMask(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): number {
  const r = DUNGEON_GetRoomAtPosition(pRoom, nX, nY)
  if (r && r.grid) return r.grid.get(nX, nY) & nMask & 0xffff
  return COLLIDE_MASK_INVALID
}

/** `COLLISION_SetCollisionMask` (1.13c 0x6FD9B490; D2MOO D2Collision.cpp:827). */
export function COLLISION_SetCollisionMask(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): void {
  const r = DUNGEON_GetRoomAtPosition(pRoom, nX, nY)
  if (r && r.grid) r.grid.set(nX, nY, (r.grid.get(nX, nY) | nMask) & 0xffff)
}

/** `COLLISION_ResetCollisionMask` (1.13c 0x6FD9B4D0; D2MOO D2Collision.cpp:970). */
export function COLLISION_ResetCollisionMask(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): void {
  const r = DUNGEON_GetRoomAtPosition(pRoom, nX, nY)
  if (r && r.grid) r.grid.set(nX, nY, r.grid.get(nX, nY) & ~nMask & 0xffff)
}

/** `COLLISION_CheckMask` (#10482, 1.13c 0x6FD9C9D0; D2MOO #10118 D2Collision.cpp:318). */
export function COLLISION_CheckMask(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): number {
  return COLLISION_CheckCollisionMask(pRoom, nX, nY, nMask)
}

/** `COLLISION_SetMask` (#10468, 1.13c 0x6FD9C990; D2MOO #10127 D2Collision.cpp:324). */
export function COLLISION_SetMask(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): void {
  COLLISION_SetCollisionMask(pRoom, nX, nY, nMask)
}

/** `COLLISION_ResetMask` (#10870, 1.13c 0x6FD9C940; D2MOO #10123 D2Collision.cpp:330). */
export function COLLISION_ResetMask(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): void {
  COLLISION_ResetCollisionMask(pRoom, nX, nY, nMask)
}

// ---------------------------------------------------------------------------
// Bounding boxes
// ---------------------------------------------------------------------------

/** `D2BoundingBoxStrc` {nLeft +0, nBottom +4, nRight +8, nTop +0xC} (inclusive sub-tile bounds). */
export interface BoundingBox {
  nLeft: number
  nBottom: number
  nRight: number
  nTop: number
}

/**
 * `COLLISION_CreateBoundingBox` (inlined in 1.13c, e.g. 0x6FD9CEE2; D2MOO D2Collision.cpp:1174).
 * Sizes are `unsigned int` (`nSize / 2` is an unsigned halving).
 */
export function COLLISION_CreateBoundingBox(nCenterX: number, nCenterY: number, nSizeX: number, nSizeY: number): BoundingBox {
  const sx = nSizeX >>> 0
  const sy = nSizeY >>> 0
  const nLeft = (nCenterX - (sx >>> 1)) | 0
  const nBottom = (nCenterY - (sy >>> 1)) | 0
  return { nLeft, nBottom, nRight: (nLeft + sx - 1) | 0, nTop: (nBottom + sy - 1) | 0 }
}

/**
 * `COLLISION_AdaptBoundingBoxToGrid` (1.13c 0x6FD9AA90; D2MOO D2Collision.cpp:370). Clips the box to
 * the room grid: first the part right of the grid (full height), then the part above it (clipped width).
 */
export function COLLISION_AdaptBoundingBoxToGrid(pRoom: PathRoom, box: BoundingBox): BoundingBox[] {
  if (box.nLeft > box.nRight || box.nBottom > box.nTop) return []
  if (!pRoom.grid) return []
  const out: BoundingBox[] = [{ ...box }]
  const b0 = out[0]
  const gridRight = pRoom.subX + pRoom.subW
  if (box.nRight >= gridRight) {
    b0.nRight = gridRight - 1
    out.push({ nLeft: b0.nRight + 1, nRight: box.nRight, nBottom: b0.nBottom, nTop: b0.nTop })
  }
  const gridTop = pRoom.subY + pRoom.subH
  if (box.nTop >= gridTop) {
    b0.nTop = gridTop - 1
    out.push({ nLeft: b0.nLeft, nRight: b0.nRight, nBottom: gridTop, nTop: box.nTop })
  }
  return out
}

/** `COLLISION_CheckCollisionMaskForBoundingBox` (1.13c 0x6FD9AC40; D2MOO D2Collision.cpp:350): OR of `mask & nMask`. */
function checkBoxInGrid(r: PathRoom, box: BoundingBox, nMask: number): number {
  const g = r.grid!
  let res = 0
  for (let y = box.nBottom; y <= box.nTop; y++) {
    for (let x = box.nLeft; x <= box.nRight; x++) res |= g.get(x, y) & nMask
  }
  return res & 0xffff
}

/** `COLLISION_SetCollisionMaskForBoundingBox` (1.13c 0x6FD9AB60; D2MOO D2Collision.cpp:1137). */
function setBoxInGrid(r: PathRoom, box: BoundingBox, nMask: number): void {
  const g = r.grid!
  for (let y = box.nBottom; y <= box.nTop; y++) {
    for (let x = box.nLeft; x <= box.nRight; x++) g.set(x, y, (g.get(x, y) | nMask) & 0xffff)
  }
}

/** `COLLISION_ResetCollisionMaskForBoundingBox` (1.13c 0x6FD9ABD0; D2MOO D2Collision.cpp:1103). */
function resetBoxInGrid(r: PathRoom, box: BoundingBox, nMask: number): void {
  const g = r.grid!
  for (let y = box.nBottom; y <= box.nTop; y++) {
    for (let x = box.nLeft; x <= box.nRight; x++) g.set(x, y, g.get(x, y) & ~nMask & 0xffff)
  }
}

/**
 * `COLLISION_CheckCollisionMaskForBoundingBoxRecursively` (1.13c 0x6FD9B3F0; D2MOO D2Collision.cpp:416).
 * Room of (left, bottom) without grid / outside rooms -> 0x27; split parts recurse from that room.
 */
export function COLLISION_CheckCollisionMaskForBoundingBoxRecursively(pRoom: PathRoom | null, box: BoundingBox, nMask: number): number {
  const r = DUNGEON_GetRoomAtPosition(pRoom, box.nLeft, box.nBottom)
  if (!r || !r.grid) return COLLIDE_MASK_INVALID
  const boxes = COLLISION_AdaptBoundingBoxToGrid(r, box)
  if (boxes.length <= 0) return COLLIDE_MASK_INVALID
  let res = checkBoxInGrid(r, boxes[0], nMask)
  for (let i = 1; i < boxes.length; i++) res |= COLLISION_CheckCollisionMaskForBoundingBoxRecursively(r, boxes[i], nMask)
  return res & 0xffff
}

/** `COLLISION_CheckAnyCollisionForBoundingBoxRecursively` (1.13c 0x6FD9B360; D2MOO D2Collision.cpp:586). */
export function COLLISION_CheckAnyCollisionForBoundingBoxRecursively(pRoom: PathRoom | null, box: BoundingBox, nMask: number): boolean {
  const r = DUNGEON_GetRoomAtPosition(pRoom, box.nLeft, box.nBottom)
  if (!r || !r.grid) return true
  const boxes = COLLISION_AdaptBoundingBoxToGrid(r, box)
  if (boxes.length <= 0 || checkBoxInGrid(r, boxes[0], nMask) !== 0) return true
  for (let i = 1; i < boxes.length; i++) {
    if (COLLISION_CheckAnyCollisionForBoundingBoxRecursively(r, boxes[i], nMask)) return true
  }
  return false
}

/** `COLLISION_SetCollisionMaskForBoundingBoxRecursively` (1.13c 0x6FD9B280; D2MOO D2Collision.cpp:841). */
export function COLLISION_SetCollisionMaskForBoundingBoxRecursively(pRoom: PathRoom | null, box: BoundingBox, nMask: number): void {
  const r = DUNGEON_GetRoomAtPosition(pRoom, box.nLeft, box.nBottom)
  if (!r || !r.grid) return
  const boxes = COLLISION_AdaptBoundingBoxToGrid(r, box)
  if (boxes.length <= 0) return
  setBoxInGrid(r, boxes[0], nMask)
  for (let i = 1; i < boxes.length; i++) COLLISION_SetCollisionMaskForBoundingBoxRecursively(r, boxes[i], nMask)
}

/** `COLLISION_ResetCollisionMaskForBoundingBoxRecursively` (1.13c 0x6FD9B2F0; D2MOO D2Collision.cpp:984). */
export function COLLISION_ResetCollisionMaskForBoundingBoxRecursively(pRoom: PathRoom | null, box: BoundingBox, nMask: number): void {
  const r = DUNGEON_GetRoomAtPosition(pRoom, box.nLeft, box.nBottom)
  if (!r || !r.grid) return
  const boxes = COLLISION_AdaptBoundingBoxToGrid(r, box)
  if (boxes.length <= 0) return
  resetBoxInGrid(r, boxes[0], nMask)
  for (let i = 1; i < boxes.length; i++) COLLISION_ResetCollisionMaskForBoundingBoxRecursively(r, boxes[i], nMask)
}

// ---------------------------------------------------------------------------
// "+" shaped (adjacent cells) checks
// ---------------------------------------------------------------------------

/** Edge flags of D2MOO `v21`: 1 left, 2 bottom(min Y), 4 right, 8 top(max Y). */
function edgeFlags(r: PathRoom, nX: number, nY: number): number {
  let v = 0
  if (r.subX >= nX) v += 1
  if (r.subY >= nY) v += 2
  if (r.subX + r.subW <= nX + 1) v += 4
  if (r.subY + r.subH <= nY + 1) v += 8
  return v
}

/**
 * `COLLISION_CheckCollisionMaskWithAdjacentCells` (1.13c 0x6FD9C5C0; D2MOO D2Collision.cpp:469).
 * OR of the masked "+" cells; cells beyond the room edge go through {@link COLLISION_CheckCollisionMask}
 * (0x27 if in no room). No room / degenerate (1-wide) room -> `nMask`.
 */
export function COLLISION_CheckCollisionMaskWithAdjacentCells(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): number {
  const r = DUNGEON_GetRoomAtPosition(pRoom, nX, nY)
  if (!r || !r.grid) return nMask & 0xffff
  const g = r.grid
  const c = (dx: number, dy: number): number => g.get(nX + dx, nY + dy)
  const m = nMask
  const out = (rx: number, ry: number): number => COLLISION_CheckCollisionMask(r, nX + rx, nY + ry, m)
  switch (edgeFlags(r, nX, nY)) {
    case 0:
      return m & (c(0, 0) | c(1, 0) | c(-1, 0) | c(0, 1) | c(0, -1)) & 0xffff
    case 1:
      return (out(-1, 0) | (m & (c(0, 0) | c(1, 0) | c(0, 1) | c(0, -1)))) & 0xffff
    case 2:
      return (out(0, -1) | (m & (c(0, 0) | c(1, 0) | c(-1, 0) | c(0, 1)))) & 0xffff
    case 3:
      return (out(-1, 0) | out(0, -1) | (m & (c(0, 0) | c(1, 0) | c(0, 1)))) & 0xffff
    case 4:
      return (out(1, 0) | (m & (c(0, 0) | c(-1, 0) | c(0, 1) | c(0, -1)))) & 0xffff
    case 6:
      return (out(1, 0) | out(0, -1) | (m & (c(0, 0) | c(-1, 0) | c(0, 1)))) & 0xffff
    case 8:
      return (out(0, 1) | (m & (c(0, 0) | c(1, 0) | c(-1, 0) | c(0, -1)))) & 0xffff
    case 9:
      return (out(-1, 0) | out(0, 1) | (m & (c(0, 0) | c(1, 0) | c(0, -1)))) & 0xffff
    case 12:
      return (out(1, 0) | out(0, 1) | (m & (c(0, 0) | c(-1, 0) | c(0, -1)))) & 0xffff
    default:
      return m & 0xffff
  }
}

/**
 * `COLLISION_CheckAnyCollisionWithAdjacentCells` (1.13c 0x6FD9C140; D2MOO D2Collision.cpp:614).
 * Same "+" footprint as above, boolean result; no room / degenerate room -> TRUE.
 */
export function COLLISION_CheckAnyCollisionWithAdjacentCells(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): boolean {
  const r = DUNGEON_GetRoomAtPosition(pRoom, nX, nY)
  if (!r || !r.grid) return true
  const g = r.grid
  const hit = (dx: number, dy: number): boolean => (nMask & g.get(nX + dx, nY + dy)) !== 0
  const out = (dx: number, dy: number): boolean => COLLISION_CheckCollisionMask(r, nX + dx, nY + dy, nMask) !== 0
  switch (edgeFlags(r, nX, nY)) {
    case 0:
      return hit(0, 0) || hit(-1, 0) || hit(1, 0) || hit(0, -1) || hit(0, 1)
    case 1:
      return hit(0, 0) || hit(1, 0) || hit(0, -1) || hit(0, 1) || out(-1, 0)
    case 2:
      return hit(0, 0) || hit(-1, 0) || hit(1, 0) || hit(0, 1) || out(0, -1)
    case 3:
      return hit(0, 0) || hit(1, 0) || hit(0, 1) || out(0, -1) || out(-1, 0)
    case 4:
      return hit(0, 0) || hit(-1, 0) || hit(0, -1) || hit(0, 1) || out(1, 0)
    case 6:
      return hit(0, 0) || hit(-1, 0) || hit(0, 1) || out(1, 0) || out(0, -1)
    case 8:
      return hit(0, 0) || hit(-1, 0) || hit(1, 0) || hit(0, -1) || out(0, 1)
    case 9:
      return hit(0, 0) || hit(1, 0) || hit(0, -1) || out(-1, 0) || out(0, 1)
    case 12:
      return hit(0, 0) || hit(-1, 0) || hit(0, -1) || out(1, 0) || out(0, 1)
    default:
      return true
  }
}

// ---------------------------------------------------------------------------
// Exported checks by size / pattern
// ---------------------------------------------------------------------------

/**
 * `COLLISION_CheckMaskWithSizeXY` (#10303, 1.13c 0x6FD9C080; D2MOO #10120 D2Collision.cpp:336).
 * `(int)nSizeX <= 1 && (int)nSizeY <= 1` -> single cell, else bounding box.
 */
export function COLLISION_CheckMaskWithSizeXY(pRoom: PathRoom | null, nX: number, nY: number, nSizeX: number, nSizeY: number, nMask: number): number {
  if ((nSizeX | 0) <= 1 && (nSizeY | 0) <= 1) return COLLISION_CheckCollisionMask(pRoom, nX, nY, nMask)
  return COLLISION_CheckCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, nSizeX, nSizeY), nMask)
}

/**
 * `COLLISION_CheckMaskWithPattern` (#10001, 1.13c 0x6FD9CF40; D2MOO #10121 D2Collision.cpp:443).
 * 0 -> cell; 1/3/5 -> "+"; 2/4 -> 3x3 box; other -> 0xFFFF.
 */
export function COLLISION_CheckMaskWithPattern(pRoom: PathRoom | null, nX: number, nY: number, nCollisionPattern: number, nMask: number): number {
  switch (nCollisionPattern) {
    case 0:
      return COLLISION_CheckCollisionMask(pRoom, nX, nY, nMask)
    case 1:
    case 3:
    case 5:
      return COLLISION_CheckCollisionMaskWithAdjacentCells(pRoom, nX, nY, nMask)
    case 2:
    case 4:
      return COLLISION_CheckCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
    default:
      return COLLIDE_ALL_MASK
  }
}

/**
 * `COLLISION_CheckAnyCollisionWithPattern` (#10851, 1.13c 0x6FD9CE90; D2MOO #10122 D2Collision.cpp:561).
 * NOTE pattern 0 returns the masked cell value (`movzx eax,ax` at 0x6FD9CEBA), the others a BOOL.
 */
export function COLLISION_CheckAnyCollisionWithPattern(pRoom: PathRoom | null, nX: number, nY: number, nCollisionPattern: number, nMask: number): number {
  switch (nCollisionPattern) {
    case 0:
      return COLLISION_CheckCollisionMask(pRoom, nX, nY, nMask)
    case 1:
    case 3:
    case 5:
      return COLLISION_CheckAnyCollisionWithAdjacentCells(pRoom, nX, nY, nMask) ? 1 : 0
    case 2:
    case 4:
      return COLLISION_CheckAnyCollisionForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask) ? 1 : 0
    default:
      return 1
  }
}

/**
 * `COLLISION_CheckMaskWithSize` (#10573, 1.13c 0x6FD9CE00; D2MOO #10119 D2Collision.cpp:775).
 * 0/1 -> cell; 2 -> "+"; 3 -> 3x3 box; other -> 0xFFFF.
 */
export function COLLISION_CheckMaskWithSize(pRoom: PathRoom | null, nX: number, nY: number, nUnitSize: number, nMask: number): number {
  switch (nUnitSize) {
    case 0:
    case 1:
      return COLLISION_CheckCollisionMask(pRoom, nX, nY, nMask)
    case 2:
      return COLLISION_CheckCollisionMaskWithAdjacentCells(pRoom, nX, nY, nMask)
    case 3:
      return COLLISION_CheckCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
    default:
      return COLLIDE_ALL_MASK
  }
}

function setPlus(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): void {
  COLLISION_SetCollisionMask(pRoom, nX - 1, nY, nMask)
  COLLISION_SetCollisionMask(pRoom, nX, nY, nMask)
  COLLISION_SetCollisionMask(pRoom, nX + 1, nY, nMask)
  COLLISION_SetCollisionMask(pRoom, nX, nY - 1, nMask)
  COLLISION_SetCollisionMask(pRoom, nX, nY + 1, nMask)
}

function resetPlus(pRoom: PathRoom | null, nX: number, nY: number, nMask: number): void {
  COLLISION_ResetCollisionMask(pRoom, nX - 1, nY, nMask)
  COLLISION_ResetCollisionMask(pRoom, nX, nY, nMask)
  COLLISION_ResetCollisionMask(pRoom, nX + 1, nY, nMask)
  COLLISION_ResetCollisionMask(pRoom, nX, nY - 1, nMask)
  COLLISION_ResetCollisionMask(pRoom, nX, nY + 1, nMask)
}

/** `COLLISION_SetMaskWithSize` (#10552, 1.13c 0x6FD9BFC0; D2MOO #10128 D2Collision.cpp:798). 1 cell / "+" / 3x3; 0 and >3 -> nothing. */
export function COLLISION_SetMaskWithSize(pRoom: PathRoom | null, nX: number, nY: number, nUnitSize: number, nMask: number): void {
  switch (nUnitSize) {
    case 1:
      COLLISION_SetCollisionMask(pRoom, nX, nY, nMask)
      break
    case 2:
      setPlus(pRoom, nX, nY, nMask)
      break
    case 3:
      COLLISION_SetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
      break
    default:
      break
  }
}

/** `COLLISION_ResetMaskWithSize` (#10232, 1.13c 0x6FD9BE10; D2MOO #10124 D2Collision.cpp:938). NULL room -> nothing. */
export function COLLISION_ResetMaskWithSize(pRoom: PathRoom | null, nX: number, nY: number, nUnitSize: number, nMask: number): void {
  if (!pRoom) return
  switch (nUnitSize) {
    case 1:
      COLLISION_ResetCollisionMask(pRoom, nX, nY, nMask)
      break
    case 2:
      resetPlus(pRoom, nX, nY, nMask)
      break
    case 3:
      COLLISION_ResetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
      break
    default:
      break
  }
}

/**
 * `COLLISION_SetMaskWithPattern` (#10565, 1.13c 0x6FD9BE90; D2MOO #10130 D2Collision.cpp:864).
 * Pattern 0 / >5 set nothing. When `nMask != 0`: 1 adds NO_PATH on the centre, 2 NO_PATH on the "+",
 * 3 PET on the centre, 4 PET on the "+".
 */
export function COLLISION_SetMaskWithPattern(pRoom: PathRoom | null, nX: number, nY: number, nCollisionPattern: number, nMask: number): void {
  switch (nCollisionPattern) {
    case 1:
      setPlus(pRoom, nX, nY, nMask)
      if (nMask) COLLISION_SetCollisionMask(pRoom, nX, nY, COLLIDE_NO_PATH)
      break
    case 2:
      COLLISION_SetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
      if (nMask) setPlus(pRoom, nX, nY, COLLIDE_NO_PATH)
      break
    case 3:
      setPlus(pRoom, nX, nY, nMask)
      if (nMask) COLLISION_SetCollisionMask(pRoom, nX, nY, COLLIDE_PET)
      break
    case 4:
      COLLISION_SetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
      if (nMask) setPlus(pRoom, nX, nY, COLLIDE_PET)
      break
    case 5:
      setPlus(pRoom, nX, nY, nMask)
      break
    default:
      break
  }
}

/** `COLLISION_ResetMaskWithPattern` (#11073, 1.13c 0x6FD9BCF0; D2MOO #10126 D2Collision.cpp:1007). Mirror of the setter; NULL room -> nothing. */
export function COLLISION_ResetMaskWithPattern(pRoom: PathRoom | null, nX: number, nY: number, nCollisionPattern: number, nMask: number): void {
  if (!pRoom) return
  switch (nCollisionPattern) {
    case 1:
      resetPlus(pRoom, nX, nY, nMask)
      if (nMask) COLLISION_ResetCollisionMask(pRoom, nX, nY, COLLIDE_NO_PATH)
      break
    case 2:
      COLLISION_ResetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
      if (nMask) resetPlus(pRoom, nX, nY, COLLIDE_NO_PATH)
      break
    case 3:
      resetPlus(pRoom, nX, nY, nMask)
      if (nMask) COLLISION_ResetCollisionMask(pRoom, nX, nY, COLLIDE_PET)
      break
    case 4:
      COLLISION_ResetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, 3, 3), nMask)
      if (nMask) resetPlus(pRoom, nX, nY, COLLIDE_PET)
      break
    case 5:
      resetPlus(pRoom, nX, nY, nMask)
      break
    default:
      break
  }
}

/** `COLLISION_SetMaskWithSizeXY` (#10200, 1.13c 0x6FD9B840; D2MOO #10129 D2Collision.cpp:1121). */
export function COLLISION_SetMaskWithSizeXY(pRoom: PathRoom | null, nX: number, nY: number, nSizeX: number, nSizeY: number, nMask: number): void {
  if ((nSizeX >>> 0) !== 1 || (nSizeY >>> 0) !== 1) {
    COLLISION_SetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, nSizeX, nSizeY), nMask)
  } else {
    COLLISION_SetCollisionMask(pRoom, nX, nY, nMask)
  }
}

/** `COLLISION_ResetMaskWithSizeXY` (#10958, 1.13c 0x6FD9BAB0; D2MOO #10125 D2Collision.cpp:1084). Only when `(int)sx > 0 && (int)sy > 0`. */
export function COLLISION_ResetMaskWithSizeXY(pRoom: PathRoom | null, nX: number, nY: number, nSizeX: number, nSizeY: number, nMask: number): void {
  if ((nSizeX | 0) > 0 && (nSizeY | 0) > 0) {
    if ((nSizeX >>> 0) !== 1 || (nSizeY >>> 0) !== 1) {
      COLLISION_ResetCollisionMaskForBoundingBoxRecursively(pRoom, COLLISION_CreateBoundingBox(nX, nY, nSizeX, nSizeY), nMask)
    } else {
      COLLISION_ResetCollisionMask(pRoom, nX, nY, nMask)
    }
  }
}

// ---------------------------------------------------------------------------
// Unit footprint moves
// ---------------------------------------------------------------------------

/**
 * `COLLISION_TryMoveUnitCollisionMask` (#10735, 1.13c 0x6FD9D760; D2MOO #10131 D2Collision.cpp:1155).
 * Clears the footprint at 1, tests 2 with the size shape; `& (WALL|MISSILE_BARRIER)` keeps it at 1.
 */
export function COLLISION_TryMoveUnitCollisionMask(
  pRoom: PathRoom | null, nX1: number, nY1: number, nX2: number, nY2: number, nUnitSize: number, nCollisionMask: number, nMoveConditionMask: number,
): number {
  COLLISION_ResetMaskWithSize(pRoom, nX1, nY1, nUnitSize, nCollisionMask)
  const r = COLLISION_CheckMaskWithSize(pRoom, nX2, nY2, nUnitSize, nMoveConditionMask)
  if (r & (COLLIDE_WALL | COLLIDE_MISSILE_BARRIER)) COLLISION_SetMaskWithSize(pRoom, nX1, nY1, nUnitSize, nCollisionMask)
  else COLLISION_SetMaskWithSize(pRoom, nX2, nY2, nUnitSize, nCollisionMask)
  return r & 0xffff
}

/**
 * `COLLISION_TryTeleportUnitCollisionMask` (#10166, 1.13c 0x6FD9D6E0; D2MOO #10132 D2Collision.cpp:1183).
 * Any masked collision at 2 keeps the footprint at 1 and returns the mask; else moves it and returns 0.
 */
export function COLLISION_TryTeleportUnitCollisionMask(
  pRoom: PathRoom | null, nX1: number, nY1: number, nX2: number, nY2: number, nCollisionPattern: number, nFootprintCollisionMask: number, nMoveConditionMask: number,
): number {
  COLLISION_ResetMaskWithPattern(pRoom, nX1, nY1, nCollisionPattern, nFootprintCollisionMask)
  const r = COLLISION_CheckMaskWithPattern(pRoom, nX2, nY2, nCollisionPattern, nMoveConditionMask)
  if (r) {
    COLLISION_SetMaskWithPattern(pRoom, nX1, nY1, nCollisionPattern, nFootprintCollisionMask)
    return r & 0xffff
  }
  COLLISION_SetMaskWithPattern(pRoom, nX2, nY2, nCollisionPattern, nFootprintCollisionMask)
  return 0
}

/**
 * `COLLISION_TrySetUnitCollisionMask` (1.13c 0x6FD9D5C0, fastcall ebx=pRoom1 edi=pattern; D2MOO
 * D2Collision.cpp:1222). DISCREPANCY vs D2MOO: 1.13c tests the destination with
 * {@link COLLISION_CheckAnyCollisionWithPattern} (#10851, `call 0x6fd9ce90`), so the return value is
 * that function's result (BOOL for patterns 1-5, masked cell value for pattern 0), not a full mask.
 */
export function COLLISION_TrySetUnitCollisionMask(
  pRoom1: PathRoom | null, nX1: number, nY1: number, pRoom2: PathRoom | null, nX2: number, nY2: number,
  nCollisionPattern: number, nFootprintCollisionMask: number, nMoveConditionMask: number,
): number {
  if (pRoom1) COLLISION_ResetMaskWithPattern(pRoom1, nX1, nY1, nCollisionPattern, nFootprintCollisionMask)
  const r = COLLISION_CheckAnyCollisionWithPattern(pRoom2, nX2, nY2, nCollisionPattern, nMoveConditionMask)
  if (r === 0) {
    COLLISION_SetMaskWithPattern(pRoom2, nX2, nY2, nCollisionPattern, nFootprintCollisionMask)
    return 0
  }
  if (pRoom1) COLLISION_SetMaskWithPattern(pRoom1, nX1, nY1, nCollisionPattern, nFootprintCollisionMask)
  return r
}

/** `COLLISION_SetUnitCollisionMask` (#10772, 1.13c 0x6FD9CD90; D2MOO #10133 D2Collision.cpp:1245). Only when `pRoom1`. */
export function COLLISION_SetUnitCollisionMask(
  pRoom1: PathRoom | null, nX1: number, nY1: number, pRoom2: PathRoom | null, nX2: number, nY2: number, nCollisionPattern: number, nCollisionMask: number,
): void {
  if (pRoom1) {
    COLLISION_ResetMaskWithPattern(pRoom1, nX1, nY1, nCollisionPattern, nCollisionMask)
    COLLISION_SetMaskWithPattern(pRoom2, nX2, nY2, nCollisionPattern, nCollisionMask)
  }
}
