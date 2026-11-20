import { MONSTATS_113C_ROWS } from '../../common/units/monstats-113c-data.ts';
import {
  buildAdjacentRoomLists,
  COLLISION_CheckMaskWithSize,
  D2Common_10142,
  D2Common_10226,
  D2COMMON_10170_PathSetTargetPos,
  D2COMMON_10193_PATH_AdjustDirection,
  DUNGEON_GetRoomAtPosition,
  DynamicPath,
  getMonsterModeBaseAnimSpeed256,
  getMonsterModeBaseFrameCount113c,
  getMonsterPathRecord,
  MONMODE_NEUTRAL,
  MONMODE_SKILL1,
  MONMODE_SKILL4,
  MONMODE_WALK,
  PATH_AddCollisionFootprintForUnit,
  PATH_AllocDynamicPath,
  PATH_FreeDynamicPath,
  PATH_RemoveCollisionFootprintForUnit,
  PATH_SetDistance,
  PATH_SetNewDistance,
  PATH_SetStepNum,
  PATH_SetTargetUnit,
  PATH_SetType,
  PATH_SetUnitDeadCollision,
  PATH_SetVelocity,
  PATH_StopMovement,
  PATHTYPE_MON_CIRCLE_CW,
  PATHTYPE_STRAIGHT,
  PATHTYPE_WALL_FOLLOW,
  subtileCenter,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  type PathCollisionGrid,
  type PathObjectTxt,
  type PathRoom,
  type PathUnit,
} from '../../common/path/index.ts';
import { CANONICAL_113C_OBJECTS } from '../../common/world/objects-meta.ts';
import type { LocalAreaMapAiNode } from '../../netproto/index.ts';
import type { D2SeedStrc } from '../../common/rng/d2-rng.ts';
import { CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C } from '../engine/game-instance/constants-and-helpers.ts';
import { rollLimitedSeed113c } from '../engine/game-instance/unit-seeds-113c.ts';

function areAreasSeamAdjacent113c(a: number, b: number): boolean {
  if (a === b) return true;
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  return CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has(`${lo}:${hi}`);
}

const TOWN_AREA_IDS_113C: ReadonlySet<number> = new Set<number>([1, 40, 75, 103, 109]);

/**
 * Exact set of 1.13c Objects.txt row IDs with Orientation === 1
 * (extracted from d2data.mpq + d2exp.mpq + Patch_D2.mpq, 573 rows total).
 */
export const OBJECT_ORIENTATION_1_IDS_113C: ReadonlySet<number> = new Set<number>([
  8, 14, 16, 24, 25, 27, 32, 33, 47, 49, 63, 77, 92, 99, 104, 106, 109, 116,
  152, 165, 167, 168, 193, 196, 260, 261, 267, 273, 274, 291, 293, 295, 296,
  297, 301, 302, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 326,
  357, 401, 452, 453, 459, 460, 461, 462, 548, 550,
]);

const objectPathTxtCache = new Map<number, PathObjectTxt>();

export function getObjectPathTxt113c(classId: number): PathObjectTxt {
  const cached = objectPathTxtCache.get(classId);
  if (cached) return cached;
  const meta = CANONICAL_113C_OBJECTS[classId];
  const mask = meta?.hasCollisionMask ?? 0;
  const hasCollision: readonly boolean[] = [
    Boolean((mask >>> 0) & 1),
    Boolean((mask >>> 1) & 1),
    Boolean((mask >>> 2) & 1),
    Boolean((mask >>> 3) & 1),
    Boolean((mask >>> 4) & 1),
    Boolean((mask >>> 5) & 1),
    Boolean((mask >>> 6) & 1),
    Boolean((mask >>> 7) & 1),
  ];
  const txt: PathObjectTxt = {
    sizeX: meta?.sizeX ?? 0,
    sizeY: meta?.sizeY ?? 0,
    subClass: meta?.subClass ?? 0,
    isDoor: Boolean(meta?.isDoor),
    blocksVis: Boolean(meta?.blocksVis),
    blockMissile: Boolean(meta?.blockMissile),
    orientation: OBJECT_ORIENTATION_1_IDS_113C.has(classId) ? 1 : 0,
    hasCollision,
  };
  objectPathTxtCache.set(classId, txt);
  return txt;
}

export function isTownNpcMonster113c(hcIdx: number): boolean {
  return MONSTATS_113C_ROWS[hcIdx]?.ai === 'Npc';
}

/**
 * D2Common_10396 / integer octile approximation:
 * max(|dx|, |dy|) + (min(|dx|, |dy|) >> 1).
 */
export function distApprox113c(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return dx >= dy ? dx + (dy >> 1) : dy + (dx >> 1);
}

function getPathUnitSubtileCoords113c(unit: PathUnit): { x: number; y: number } {
  if (unit.pDynamicPath) {
    return { x: unit.pDynamicPath.wPosX, y: unit.pDynamicPath.wPosY };
  }
  if (unit.pStaticPath) {
    return { x: unit.pStaticPath.x, y: unit.pStaticPath.y };
  }
  return { x: 0, y: 0 };
}

function getUnitSizeX113c(unit: PathUnit): number {
  if (unit.dwUnitType === UNIT_PLAYER) return 2;
  if (unit.dwUnitType === UNIT_MONSTER) {
    return getMonsterPathRecord(unit.dwClassId).sizeX;
  }
  if (unit.dwUnitType === UNIT_OBJECT) {
    return unit.objectTxt?.sizeX ?? 0;
  }
  return 1;
}

/**
 * D2Game.dll 0x6FCD0A20 (`UNIT_GetSizeSubtractedOctileDist`):
 * Subtracts `D2Common_10589(unitA)` (`sizeX` of `unitA`) from `|x1 - x2|` and `|y1 - y2|`
 * (clamped >= 0), then returns `trunc((max * 2 + min) / 2)`.
 */
export function unitSizeSubtractedOctileDist113c(
  unitA: PathUnit,
  unitB: PathUnit,
): number {
  const a = getPathUnitSubtileCoords113c(unitA);
  const b = getPathUnitSubtileCoords113c(unitB);
  const sizeA = getUnitSizeX113c(unitA);
  const dx = Math.max(0, Math.abs(a.x - b.x) - sizeA);
  const dy = Math.max(0, Math.abs(a.y - b.y) - sizeA);
  const num = dx > dy ? dy + dx * 2 : dx + dy * 2;
  return Math.trunc(num / 2);
}

/**
 * Exact 8x8 lookup table from `D2Common.dll` `0x6FDDABC0`, indexed by `dx + dy * 8` (`dx, dy in 0..7`),
 * read by `D2Common.#10935` (`UNITS_GetMeleeDistance` `0x6FDCFCD0`).
 */
const D2COMMON_MELEE_DIST_TABLE_8X8: readonly number[] = Object.freeze([
  -1, -1, -1, 0, 2, 4, 6, 8,
  -1, -1, 0, 1, 2, 4, 6, 8,
  -1, 0, 0, 2, 3, 5, 7, 8,
  0, 1, 2, 2, 4, 5, 7, 8,
  2, 2, 3, 4, 5, 6, 7, 9,
  4, 4, 5, 5, 6, 7, 8, 9,
  6, 6, 7, 7, 7, 8, 10, 10,
  8, 8, 8, 8, 9, 9, 10, 11,
]);

/**
 * `D2Common.#10935` (`0x6FDCFCD0`): inter-unit melee distance between two footprints.
 */
export function unitsGetMeleeDistance113c(
  x1: number,
  y1: number,
  size1: number,
  x2: number,
  y2: number,
  size2: number,
): number {
  const dx = Math.abs((x1 | 0) - (x2 | 0));
  const dy = Math.abs((y1 | 0) - (y2 | 0));
  if (dx < 8 && dy < 8 && size1 < 4 && size2 < 4) {
    let v = D2COMMON_MELEE_DIST_TABLE_8X8[dx + dy * 8]!;
    if (v < 0) return 0;
    if (size1 === 3 || size2 === 3) v -= 1;
    if (v < 0) v = 0;
    if (size1 <= 1 || size2 <= 1) return v + 1;
    return v;
  }
  let halfSum = ((size1 >>> 1) + (size2 >>> 1)) | 0;
  if (halfSum < 0) halfSum = -halfSum;
  const bx = Math.max(0, dx - halfSum);
  const di = Math.max(0, dy - halfSum);
  return bx > di ? di + bx * 2 : bx + di * 2;
}

/**
 * `D2Common` `0x6FD9AD20` (`COLLISION_RayTrace`) over `PathRoom` adjacency / grid:
 * returns `true` when any subtile along the single-major-axis Bresenham ray hits `mask` or lies outside rooms.
 */
function pathRoomRayTrace113c(
  startRoom: PathRoom | null,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  mask: number,
): boolean {
  if (!startRoom) return true;
  let x = startX | 0;
  let y = startY | 0;
  const x1 = endX | 0;
  const y1 = endY | 0;
  const dx = Math.abs(x1 - x);
  const dy = Math.abs(y1 - y);
  const sx = x1 - x < 0 ? -1 : 1;
  const sy = y1 - y < 0 ? -1 : 1;
  const xMajor = dx >= dy;
  const majorDelta = xMajor ? dx : dy;
  const minorDelta = xMajor ? dy : dx;

  let curRoom: PathRoom | null = startRoom;
  let acc = 0;
  for (let step = 0; step <= majorDelta; step += 1) {
    if (
      !curRoom ||
      x < curRoom.subX ||
      y < curRoom.subY ||
      x >= curRoom.subX + curRoom.subW ||
      y >= curRoom.subY + curRoom.subH
    ) {
      let nextRoom: PathRoom | null = null;
      if (curRoom) {
        for (const adj of curRoom.adjacentRooms) {
          if (
            adj &&
            x >= adj.subX &&
            y >= adj.subY &&
            x < adj.subX + adj.subW &&
            y < adj.subY + adj.subH
          ) {
            nextRoom = adj;
            break;
          }
        }
      }
      curRoom = nextRoom;
      if (!curRoom || !curRoom.grid) return true;
    }
    if (!curRoom.grid || (curRoom.grid.get(x, y) & mask) !== 0) {
      return true;
    }
    acc += minorDelta;
    if (xMajor) {
      x += sx;
      if (acc >= majorDelta) {
        acc -= majorDelta;
        y += sy;
      }
    } else {
      y += sy;
      if (acc >= majorDelta) {
        acc -= majorDelta;
        x += sx;
      }
    }
  }
  return false;
}

/**
 * `D2Common` `0x6FD814A0` -> `0x6FD80730`: footprint-inset collision ray check between two units.
 * Returns `true` when blocked (`0x6FD80730 != 0`), `false` when clear (`0`).
 */
function unitsHasCollisionBetween113c(
  room1: PathRoom | null,
  x1In: number,
  y1In: number,
  size1In: number,
  x2In: number,
  y2In: number,
  size2In: number,
  mask: number,
): boolean {
  if (!room1) return true;
  const s1 = size1In < 3 ? size1In : 2;
  const s2 = size2In < 3 ? size2In : 2;
  const absDx = Math.abs((x2In | 0) - (x1In | 0));
  const absDy = Math.abs((y2In | 0) - (y1In | 0));
  if (absDx + absDy < s1 + s2) return false;

  let x1 = x1In | 0;
  let y1 = y1In | 0;
  let x2 = x2In | 0;
  let y2 = y2In | 0;
  if (s1 !== 0 || s2 !== 0) {
    if (absDx >= absDy) {
      if (x2 > x1) {
        x1 += s1;
        x2 -= s2;
      } else {
        x1 -= s1;
        x2 += s2;
      }
    }
    if (absDy >= absDx) {
      if (y2 > y1) {
        y1 += s1;
        y2 -= s2;
      } else {
        y1 -= s1;
        y2 += s2;
      }
    }
  }
  return pathRoomRayTrace113c(room1, x1, y1, x2, y2, mask);
}

/**
 * `D2Common.#11138` (`UNITS_IsInMeleeRange` `0x6FD826C0`):
 * Exact 1.13c monster melee range test against a target unit.
 */
function unitsIsMonsterInMeleeRange113c(
  monUnit: PathUnit,
  targetUnit: PathUnit,
  bonus: number,
): boolean {
  const a = getPathUnitSubtileCoords113c(monUnit);
  const b = getPathUnitSubtileCoords113c(targetUnit);
  const size1 = getUnitSizeX113c(monUnit);
  const size2 = getUnitSizeX113c(targetUnit);
  const rawMeleeRng = MONSTATS_113C_ROWS[monUnit.dwClassId]?.meleeRng ?? 0;
  const meleeRng = rawMeleeRng === 0xff ? 0 : rawMeleeRng;
  const dist = unitsGetMeleeDistance113c(a.x, a.y, size1, b.x, b.y, size2);

  if (targetUnit.dwUnitType === UNIT_MONSTER) {
    const targetBaseId = getMonsterPathRecord(targetUnit.dwClassId).baseId;
    if ((targetBaseId === 0x102 || targetBaseId === 0x105) && meleeRng + 8 > dist) {
      return true;
    }
  }
  if (dist <= 0) return true;
  if (meleeRng + bonus + 1 < dist) return false;
  const room1 = monUnit.pDynamicPath?.pRoom ?? monUnit.pStaticPath?.room ?? null;
  return !unitsHasCollisionBetween113c(room1, a.x, a.y, size1, b.x, b.y, size2, 0x804);
}

interface NpcNode4State {
  x: number;
  y: number;
  count: number;
  delay: number;
}

interface NpcNode7State {
  mode: number;
  x: number;
  y: number;
  ticks: number;
}

export interface TownNpcAiState113c {
  homeInitialized: boolean;
  homeX: number;
  homeY: number;
  nextAiFrame: number;
  animEndFrame: number;
  node4: NpcNode4State | null;
  node4RetryCounter: number;
  node7: NpcNode7State | null;
}

export interface TownNpcMonsterLike {
  unitId: number;
  hcIdx: number;
  areaId: number;
  x: number;
  y: number;
  mode: number;
  dead: boolean;
  mapAi?: readonly LocalAreaMapAiNode[] | undefined;
  townNpcAiEnabled?: boolean | undefined;
}

export interface TownNpcPlayerContext {
  unitId: number;
  areaId: number;
  x: number;
  y: number;
  activeNpcId: number | undefined;
  warrivGreeted: boolean;
}

interface MonsterPathEntry {
  unit: PathUnit;
  npcAi: TownNpcAiState113c | null;
}

interface PlayerPathEntry {
  unit: PathUnit;
  run: boolean;
  velocityFp8: number;
  targetUnitType: number | null;
  targetUnitId: number | null;
  stopRange: number;
}

const ROOM_CHUNK_SUBTILES = 40;

interface AreaPathContext113c {
  areaId: number;
  originX: number;
  originY: number;
  subWidth: number;
  subHeight: number;
  roomCols: number;
  roomRows: number;
  hasExplicitRooms: boolean;
  rooms: PathRoom[];
  objects: Map<number, PathUnit>;
  monsters: Map<number, MonsterPathEntry>;
  players: Map<number, PlayerPathEntry>;
}

/**
 * 1.13c CharStats.txt WalkVelocity = 6 (1536 -> 6/16 = 3/8 sub-tile/frame = 9.375/s),
 * RunVelocity = 9 (2304 -> 9/16 sub-tile/frame = 14.0625/s).
 * UNITS_UpdateAnimRateAndVelocity (#10819, 0x6FD83110) computes:
 *   pct = max(25, 100 + velocityPercentBonus)
 *   pathVel = trunc((pct * (baseVel << 8)) / 100)
 */
export function computePlayerVelocity113c(
  run: boolean,
  velocityPercentBonus = 0,
): number {
  const baseVelFp8 = 6 << 8;
  const pct = Math.max(25, 100 + (run ? 50 : 0) + velocityPercentBonus);
  return Math.trunc(Math.imul(pct, baseVelFp8) / 100) | 0;
}

/**
 * 1.13c monster walk velocity in UNITS_UpdateAnimRateAndVelocity (#10819, 0x6FD83110):
 * MONSTER_InitStats (D2Game.dll 0x6FCCFFD1) initializes base stat 67 (STAT_VELOCITYPERCENT) = 75 (0x4B)
 * on all monsters (confirmed by 0x67 NPCMove captures in 04-d2gs-idle-60s.d2cap and a1-town-walk Oracle trace).
 */
export function computeMonsterWalkVelocity113c(hcIdx: number, pct = 75, baseVelocityFp8?: number): number {
  // `UNITS_UpdateAnimRateAndVelocity` 0x6FD833AE: base = 0x6FD80D50(type, class) (monsters: MonStats
  // `Velocity << 8`), unless a transform state (0x6FDA01E0, States.bin +0x2D/+0x2E) remaps the unit to a
  // player class (CharStats `WalkVelocity << 8`), passed in as `baseVelocityFp8`.
  const base = baseVelocityFp8 ?? getMonsterPathRecord(hcIdx).velocity << 8;
  const clamped = Math.max(25, pct | 0);
  return Math.trunc(Math.imul(clamped, base) / 100) | 0;
}

/**
 * 1.13c MONSTER_StartMove (0x6FC95E10 -> 0x6FC94F90 -> 0x6FC94D50):
 * - Sets target coord and PATH_SetDistance(pPath, 20) (#10022 0x6FD84880, called at 0x6FC95EE7).
 * - 0x6FC94F90 defaults nMaxDist (al) to 5 when neither pAiPath+0x20 nor pModeChange+0x1c sets one
 *   (0x6FC94FDA: mov byte ptr [esp+0x1c], 5), and 0x6FC94D50 calls PATH_SetNewDistance(pPath, al)
 *   (#10168 0x6FD84F50, called at 0x6FC94D5C).
 * - Sets PATH_SetType(pPath, pathType) and calls D2Common_10142(pPath, npcUnit, 0).
 * - When pts === 0 and pathType is in {2, 7, 9, 13} (jump table 0x6FC94E2C),
 *   falls back to PATHTYPE_WALL_FOLLOW (15) and retries D2Common_10142 (0x6FC94DF0).
 */
function startNpcWalkToPos113c(
  pPath: DynamicPath,
  npcUnit: PathUnit,
  hcIdx: number,
  targetX: number,
  targetY: number,
  pathType: number,
  stepNum: number,
  maxDist = 5,
): number {
  PATH_SetStepNum(pPath, stepNum);
  // MONSTER_StartMode 0x6FC95EDB: position target -> #10286 only (it clears pTargetUnit itself).
  D2COMMON_10170_PathSetTargetPos(pPath, targetX, targetY);
  PATH_SetDistance(pPath, 20);
  PATH_SetNewDistance(pPath, maxDist > 0 ? maxDist : 5);
  PATH_SetVelocity(pPath, computeMonsterWalkVelocity113c(hcIdx));
  PATH_SetType(pPath, pathType);
  let pts = D2Common_10142(pPath, npcUnit, 0);
  if (
    pts <= 0 &&
    (pathType === 2 || pathType === PATHTYPE_STRAIGHT || pathType === 9 || pathType === 13)
  ) {
    PATH_SetType(pPath, PATHTYPE_WALL_FOLLOW);
    pts = D2Common_10142(pPath, npcUnit, 0);
  }
  return pts;
}

function computeMonsterSkillAnimTicks113c(hcIdx: number, mode: number): number {
  const frames = getMonsterModeBaseFrameCount113c(hcIdx, mode);
  const speed = getMonsterModeBaseAnimSpeed256(hcIdx, mode);
  if (frames <= 0 || speed <= 0) return 15;
  return Math.max(1, Math.floor(((frames << 8) + speed - 1) / speed));
}

function makeRoomCollisionGrid(
  originX: number,
  originY: number,
  subWidth: number,
  subHeight: number,
  cells: Uint16Array,
): PathCollisionGrid {
  return {
    get(x: number, y: number): number {
      const lx = (x - originX) | 0;
      const ly = (y - originY) | 0;
      if (lx < 0 || ly < 0 || lx >= subWidth || ly >= subHeight) return 0xffff;
      return cells[ly * subWidth + lx]!;
    },
    set(x: number, y: number, value: number): void {
      const lx = (x - originX) | 0;
      const ly = (y - originY) | 0;
      if (lx < 0 || ly < 0 || lx >= subWidth || ly >= subHeight) return;
      cells[ly * subWidth + lx] = value & 0xffff;
    },
  };
}

export class AreaPathWorld113c {
  private readonly areas = new Map<number, AreaPathContext113c>();
  private readonly playerAreaById = new Map<number, number>();
  private readonly monsterAreaById = new Map<number, number>();
  private readonly objectAreaById = new Map<number, number>();
  private readonly hibernatedNpcAi = new Map<number, TownNpcAiState113c>();
  private drlgTileZoneResolver: ((areaId: number, x: number, y: number) => number) | null = null;

  setDrlgTileZoneResolver113c(
    resolver: ((areaId: number, x: number, y: number) => number) | null,
  ): void {
    this.drlgTileZoneResolver = resolver;
  }

  initArea(
    areaId: number,
    originX?: number,
    originY?: number,
    subWidth?: number,
    subHeight?: number,
    collision?: Uint16Array,
    roomRects?: ReadonlyArray<{
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }>,
  ): boolean {
    if (
      originX === undefined ||
      originY === undefined ||
      !subWidth ||
      !subHeight ||
      !collision ||
      collision.length < subWidth * subHeight
    ) {
      return false;
    }
    const cells = collision.slice();
    const grid = makeRoomCollisionGrid(originX, originY, subWidth, subHeight, cells);
    const isTown = TOWN_AREA_IDS_113C.has(areaId);
    const roomCols = Math.max(1, Math.ceil(subWidth / ROOM_CHUNK_SUBTILES));
    const roomRows = Math.max(1, Math.ceil(subHeight / ROOM_CHUNK_SUBTILES));
    const validRects = roomRects?.filter((r) => r.w > 0 && r.h > 0) ?? [];
    const hasExplicitRooms = validRects.length > 0;
    const rooms: PathRoom[] = [];
    if (hasExplicitRooms) {
      for (const rect of validRects) {
        rooms.push({
          subX: rect.x,
          subY: rect.y,
          subW: rect.w,
          subH: rect.h,
          isTown,
          adjacentRooms: [],
          grid,
        });
      }
    } else {
      for (let ry = 0; ry < roomRows; ry += 1) {
        const sy = originY + ry * ROOM_CHUNK_SUBTILES;
        const sh = Math.min(ROOM_CHUNK_SUBTILES, originY + subHeight - sy);
        for (let rx = 0; rx < roomCols; rx += 1) {
          const sx = originX + rx * ROOM_CHUNK_SUBTILES;
          const sw = Math.min(ROOM_CHUNK_SUBTILES, originX + subWidth - sx);
          rooms.push({
            subX: sx,
            subY: sy,
            subW: sw,
            subH: sh,
            isTown,
            adjacentRooms: [],
            grid,
          });
        }
      }
    }
    this.areas.set(areaId, {
      areaId,
      originX,
      originY,
      subWidth,
      subHeight,
      roomCols,
      roomRows,
      hasExplicitRooms,
      rooms,
      objects: new Map(),
      monsters: new Map(),
      players: new Map(),
    });
    this.relinkSeamComponentRooms(areaId);
    return true;
  }

  private getSeamConnectedAreaIds(areaId: number): number[] {
    if (!this.areas.has(areaId)) return [];
    const visited = new Set<number>([areaId]);
    const queue: number[] = [areaId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const cand of this.areas.keys()) {
        if (visited.has(cand)) continue;
        if (areAreasSeamAdjacent113c(cur, cand)) {
          visited.add(cand);
          queue.push(cand);
        }
      }
    }
    return [...visited].sort((a, b) => a - b);
  }

  private areAreasSeamConnected(a: number, b: number): boolean {
    if (a === b) return true;
    return this.getSeamConnectedAreaIds(a).includes(b);
  }

  private relinkSeamComponentRooms(areaId: number): void {
    const componentIds = this.getSeamConnectedAreaIds(areaId);
    const componentRooms: PathRoom[] = [];
    for (const id of componentIds) {
      const ctx = this.areas.get(id);
      if (ctx) componentRooms.push(...ctx.rooms);
    }
    const adjacentMap = buildAdjacentRoomLists(componentRooms);
    for (const room of componentRooms) {
      (room as { adjacentRooms: readonly PathRoom[] }).adjacentRooms =
        adjacentMap.get(room) ?? [];
    }
  }

  private findRoom(ctx: AreaPathContext113c, x: number, y: number): PathRoom | null {
    if (ctx.hasExplicitRooms) {
      const ix = x | 0;
      const iy = y | 0;
      for (const room of ctx.rooms) {
        if (
          ix >= room.subX &&
          iy >= room.subY &&
          ix < room.subX + room.subW &&
          iy < room.subY + room.subH
        ) {
          return room;
        }
      }
      return null;
    }
    const lx = (x - ctx.originX) | 0;
    const ly = (y - ctx.originY) | 0;
    if (lx < 0 || ly < 0 || lx >= ctx.subWidth || ly >= ctx.subHeight) return null;
    const col = Math.floor(lx / ROOM_CHUNK_SUBTILES);
    const row = Math.floor(ly / ROOM_CHUNK_SUBTILES);
    return ctx.rooms[row * ctx.roomCols + col] ?? null;
  }

  hasArea(areaId: number): boolean {
    return this.areas.has(areaId);
  }

  getCollisionAt(areaId: number, x: number, y: number): number {
    const ctx = this.areas.get(areaId);
    const grid = ctx?.rooms[0]?.grid;
    if (!grid) return 0xffff;
    return grid.get(x | 0, y | 0);
  }

  addCollisionMaskAt(areaId: number, x: number, y: number, mask: number): void {
    const ix = x | 0;
    const iy = y | 0;
    for (const id of this.getSeamConnectedAreaIds(areaId)) {
      const grid = this.areas.get(id)?.rooms[0]?.grid;
      if (!grid) continue;
      const cur = grid.get(ix, iy);
      if (cur !== 0xffff) {
        grid.set(ix, iy, (cur | mask) & 0xffff);
      }
    }
  }

  removeCollisionMaskAt(areaId: number, x: number, y: number, mask: number): void {
    const ix = x | 0;
    const iy = y | 0;
    for (const id of this.getSeamConnectedAreaIds(areaId)) {
      const grid = this.areas.get(id)?.rooms[0]?.grid;
      if (!grid) continue;
      const cur = grid.get(ix, iy);
      if (cur !== 0xffff) {
        grid.set(ix, iy, cur & ~mask & 0xffff);
      }
    }
  }

  unitSizeSubtractedDistToTarget(
    areaId: number,
    monUnitId: number,
    targetUnitType: number,
    targetUnitId: number,
  ): number | null {
    const ctx = this.areas.get(areaId);
    const monEntry = ctx?.monsters.get(monUnitId);
    if (!ctx || !monEntry) return null;
    const targetUnit = this.findTargetPathUnit(ctx, targetUnitType, targetUnitId);
    if (!targetUnit) return null;
    return unitSizeSubtractedOctileDist113c(monEntry.unit, targetUnit);
  }

  isMonsterInMeleeRange113c(
    areaId: number,
    monUnitId: number,
    targetUnitType: number,
    targetUnitId: number,
    bonus = 0,
  ): boolean | null {
    const ctx = this.areas.get(areaId);
    const monEntry = ctx?.monsters.get(monUnitId);
    if (!ctx || !monEntry) return null;
    const targetUnit = this.findTargetPathUnit(ctx, targetUnitType, targetUnitId);
    if (!targetUnit) return null;
    return unitsIsMonsterInMeleeRange113c(monEntry.unit, targetUnit, bonus);
  }

  startMonsterMoveToTarget113c(params: {
    readonly areaId: number;
    readonly unitId: number;
    readonly hcIdx: number;
    readonly targetUnitType: number;
    readonly targetUnitId: number;
    readonly pathType: number;
    readonly stepNum: number;
    readonly velocityPct: number;
    readonly baseVelocityFp8?: number | undefined;
    readonly maxDist?: number | undefined;
  }): number {
    const ctx = this.areas.get(params.areaId);
    const monEntry = ctx?.monsters.get(params.unitId);
    const pPath = monEntry?.unit.pDynamicPath;
    if (!ctx || !monEntry || !pPath) return 0;
    const targetUnit = this.findTargetPathUnit(
      ctx,
      params.targetUnitType,
      params.targetUnitId,
    );
    if (!targetUnit) return 0;
    // `AI_ApproachTarget` 0x6FD12599: #11005 PATH_SetStepNum, then `MONSTER_StartMode` 0x6FC95EBE..
    // 0x6FC95EE7 sets EITHER #10336 PATH_SetTargetUnit (target unit given) OR #10286 PathSetTargetPos
    // (no unit), never both, then #10022 PATH_SetDistance(20)
    // (kb/engine/path-call-order-audit-113c.md, row MONSTER_StartMode).
    PATH_SetStepNum(pPath, params.stepNum);
    PATH_SetTargetUnit(pPath, targetUnit);
    PATH_SetDistance(pPath, 20);
    const md = params.maxDist ?? 5;
    PATH_SetNewDistance(pPath, md > 0 ? md : 5);
    PATH_SetVelocity(pPath, computeMonsterWalkVelocity113c(params.hcIdx, params.velocityPct, params.baseVelocityFp8));
    PATH_SetType(pPath, params.pathType);
    let pts = D2Common_10142(pPath, monEntry.unit, 0);
    if (
      pts <= 0 &&
      (params.pathType === 2 ||
        params.pathType === PATHTYPE_STRAIGHT ||
        params.pathType === 9 ||
        params.pathType === 13)
    ) {
      PATH_SetType(pPath, PATHTYPE_WALL_FOLLOW);
      pts = D2Common_10142(pPath, monEntry.unit, 0);
    }
    if (pts > 0) this.monsterMoveSeq113c.set(params.unitId, ++this.monsterMoveSeqCounter113c);
    return pts;
  }

  startMonsterMoveToPos113c(params: {
    readonly areaId: number;
    readonly unitId: number;
    readonly hcIdx: number;
    readonly targetX: number;
    readonly targetY: number;
    readonly pathType: number;
    readonly stepNum: number;
    readonly velocityPct: number;
    readonly baseVelocityFp8?: number | undefined;
    readonly maxDist?: number | undefined;
  }): number {
    const ctx = this.areas.get(params.areaId);
    const monEntry = ctx?.monsters.get(params.unitId);
    const pPath = monEntry?.unit.pDynamicPath;
    if (!ctx || !monEntry || !pPath) return 0;
    PATH_SetStepNum(pPath, params.stepNum);
    // MONSTER_StartMode 0x6FC95EDB: position target -> #10286 only (it clears pTargetUnit itself).
    D2COMMON_10170_PathSetTargetPos(pPath, params.targetX | 0, params.targetY | 0);
    PATH_SetDistance(pPath, 20);
    const md = params.maxDist ?? 5;
    PATH_SetNewDistance(pPath, md > 0 ? md : 5);
    PATH_SetVelocity(pPath, computeMonsterWalkVelocity113c(params.hcIdx, params.velocityPct, params.baseVelocityFp8));
    PATH_SetType(pPath, params.pathType);
    let pts = D2Common_10142(pPath, monEntry.unit, 0);
    if (
      pts <= 0 &&
      (params.pathType === 2 ||
        params.pathType === PATHTYPE_STRAIGHT ||
        params.pathType === 9 ||
        params.pathType === 13)
    ) {
      PATH_SetType(pPath, PATHTYPE_WALL_FOLLOW);
      pts = D2Common_10142(pPath, monEntry.unit, 0);
    }
    if (pts > 0) this.monsterMoveSeq113c.set(params.unitId, ++this.monsterMoveSeqCounter113c);
    return pts;
  }

  stepMonsterMove113c(params: {
    readonly areaId: number;
    readonly unitId: number;
    readonly hcIdx: number;
    readonly velocityPct: number;
    readonly baseVelocityFp8?: number | undefined;
    readonly mode: number;
  }): { readonly stepped: number; readonly x: number; readonly y: number } | null {
    const ctx = this.areas.get(params.areaId);
    const monEntry = ctx?.monsters.get(params.unitId);
    const pPath = monEntry?.unit.pDynamicPath;
    if (!ctx || !monEntry || !pPath) return null;
    monEntry.unit.dwAnimMode = params.mode;
    PATH_SetVelocity(pPath, computeMonsterWalkVelocity113c(params.hcIdx, params.velocityPct, params.baseVelocityFp8));
    const stepped = D2Common_10226(monEntry.unit, 0x400);
    D2COMMON_10193_PATH_AdjustDirection(pPath);
    if (pPath.pRoom) {
      for (const id of this.getSeamConnectedAreaIds(params.areaId)) {
        const cand = this.areas.get(id);
        if (cand && cand.rooms.includes(pPath.pRoom) && id !== params.areaId) {
          this.migrateMonsterAreaIfSeamConnected(params.unitId, id);
          break;
        }
      }
    }
    return { stepped, x: pPath.wPosX, y: pPath.wPosY };
  }

  /**
   * Registration order of the monsters' moves: a 1.13c move (WL / RN) installs a persistent per-frame
   * mode-update event at the head of the monster partition list (kb/engine/d2game-event-wheel-and-room-
   * units-113c.md §6), so the newest move is updated first.
   */
  private readonly monsterMoveSeq113c = new Map<number, number>();
  private monsterMoveSeqCounter113c = 0;

  getMonsterMoveSeq113c(unitId: number): number {
    return this.monsterMoveSeq113c.get(unitId) ?? 0;
  }

  stopMonsterMove113c(areaId: number, unitId: number, mode = MONMODE_NEUTRAL): void {
    const entry = this.areas.get(areaId)?.monsters.get(unitId);
    const pPath = entry?.unit.pDynamicPath;
    if (!entry || !pPath) return;
    PATH_StopMovement(pPath);
    entry.unit.dwAnimMode = mode;
  }

  getMonsterAreaId113c(unitId: number): number | undefined {
    return this.monsterAreaById.get(unitId);
  }

  checkMonsterCrowdedMask113c(areaId: number, unitId: number, mask: number): boolean {
    const entry = this.areas.get(areaId)?.monsters.get(unitId);
    const pPath = entry?.unit.pDynamicPath;
    if (!entry || !pPath) return false;
    return COLLISION_CheckMaskWithSize(pPath.pRoom, pPath.wPosX, pPath.wPosY, pPath.dwUnitSize | 0, mask) !== 0;
  }

  /**
   * Diagnostics only (oracle trace-window tool): a plain snapshot of a player's (`unitType` 0) or
   * monster's (`unitType` 1) `D2DynamicPathStrc` fields that drive `D2Common_10226` stepping, or
   * `null` when the unit has no dynamic path in any area. Never used by the simulation.
   */
  describeUnitPath113c(unitType: number, unitId: number): Record<string, number | string | null> | null {
    for (const ctx of this.areas.values()) {
      const unit =
        unitType === UNIT_PLAYER
          ? ctx.players.get(unitId)?.unit
          : unitType === UNIT_MONSTER
            ? ctx.monsters.get(unitId)?.unit
            : undefined;
      const p = unit?.pDynamicPath;
      if (!unit || !p) continue;
      const t = p.pTargetUnit;
      const tp = t?.pDynamicPath;
      return {
        area: ctx.areaId,
        animMode: unit.dwAnimMode,
        pos: `${p.wPosX},${p.wPosY}`,
        pathType: p.dwPathType,
        point: `${p.dwCurrentPointIdx}/${p.dwPathPoints}`,
        stepNum: p.nStepNum,
        dist: p.nDist,
        vel: `${p.tVelocityVector.nX},${p.tVelocityVector.nY}`,
        targetPos: `${p.tTargetCoord.X},${p.tTargetCoord.Y}`,
        targetUnit: t ? `${t.dwUnitType}:${t.dwUnitId}@${tp ? `${tp.wPosX},${tp.wPosY}` : '?'}` : null,
      };
    }
    return null;
  }

  /**
   * Ensures deleted or newly-slain units across any GameInstance subsystem
   * release or convert their collision footprints before pathfinding/stepping.
   */
  syncWorldUnits(
    hasMonster: (unitId: number) => boolean,
    isMonsterDead: (unitId: number) => boolean,
    hasObject: (unitId: number) => boolean,
    hasPlayer: (unitId: number) => boolean,
  ): void {
    for (const [unitId, areaId] of [...this.monsterAreaById.entries()]) {
      if (!hasMonster(unitId)) {
        this.removeMonster(unitId);
        continue;
      }
      if (isMonsterDead(unitId)) {
        const entry = this.areas.get(areaId)?.monsters.get(unitId);
        if (entry && entry.unit.dwAnimMode !== 12 && entry.unit.dwAnimMode !== 0) {
          this.setMonsterDead(unitId);
        }
      }
    }
    for (const unitId of [...this.objectAreaById.keys()]) {
      if (!hasObject(unitId)) {
        this.removeObject(unitId);
      }
    }
    for (const unitId of [...this.playerAreaById.keys()]) {
      if (!hasPlayer(unitId)) {
        this.removePlayer(unitId);
      }
    }
  }

  isInBounds(areaId: number, x: number, y: number): boolean {
    const ctx = this.areas.get(areaId);
    if (!ctx || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ctx.hasExplicitRooms) {
      return this.findRoom(ctx, ix, iy) !== null;
    }
    return (
      ix >= ctx.originX &&
      iy >= ctx.originY &&
      ix < ctx.originX + ctx.subWidth &&
      iy < ctx.originY + ctx.subHeight
    );
  }

  isInReachableBounds(areaId: number, x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    for (const candId of this.getSeamConnectedAreaIds(areaId)) {
      if (this.isInBounds(candId, x, y)) return true;
    }
    return false;
  }

  private migratePlayerAreaIfSeamConnected(unitId: number, areaId: number): void {
    const prevArea = this.playerAreaById.get(unitId);
    if (prevArea === undefined || prevArea === areaId) return;
    if (!this.areAreasSeamConnected(prevArea, areaId)) return;
    const prevCtx = this.areas.get(prevArea);
    const nextCtx = this.areas.get(areaId);
    const entry = prevCtx?.players.get(unitId);
    if (!prevCtx || !nextCtx || !entry) return;
    prevCtx.players.delete(unitId);
    nextCtx.players.set(unitId, entry);
    this.playerAreaById.set(unitId, areaId);
  }

  private migrateMonsterAreaIfSeamConnected(unitId: number, areaId: number): void {
    const prevArea = this.monsterAreaById.get(unitId);
    if (prevArea === undefined || prevArea === areaId) return;
    if (!this.areAreasSeamConnected(prevArea, areaId)) return;
    const prevCtx = this.areas.get(prevArea);
    const nextCtx = this.areas.get(areaId);
    const entry = prevCtx?.monsters.get(unitId);
    if (!prevCtx || !nextCtx || !entry) return;
    prevCtx.monsters.delete(unitId);
    nextCtx.monsters.set(unitId, entry);
    this.monsterAreaById.set(unitId, areaId);
  }

  spawnObject(
    areaId: number,
    unitId: number,
    classId: number,
    x: number,
    y: number,
    mode: number,
  ): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const ctx = this.areas.get(areaId);
    if (!ctx || !this.isInBounds(areaId, ix, iy)) return;
    this.removeObject(unitId);
    const room = this.findRoom(ctx, ix, iy);
    if (!room) return;
    const unit: PathUnit = {
      dwUnitType: UNIT_OBJECT,
      dwClassId: classId,
      dwUnitId: unitId,
      dwAnimMode: mode,
      dwFlags: 0,
      dwFlagEx: 0,
      pDynamicPath: null,
      pStaticPath: { room, x: ix, y: iy },
      objectTxt: getObjectPathTxt113c(classId),
    };
    if (unit.objectTxt?.hasCollision[mode]) {
      PATH_AddCollisionFootprintForUnit(unit);
    }
    ctx.objects.set(unitId, unit);
    this.objectAreaById.set(unitId, areaId);
  }

  setObjectMode(unitId: number, mode: number): void {
    const areaId = this.objectAreaById.get(unitId);
    if (areaId === undefined) return;
    const ctx = this.areas.get(areaId);
    const unit = ctx?.objects.get(unitId);
    if (!unit) return;
    if (unit.dwAnimMode === mode) return;
    PATH_RemoveCollisionFootprintForUnit(unit, false);
    unit.dwAnimMode = mode;
    if (unit.objectTxt?.hasCollision[mode]) {
      PATH_AddCollisionFootprintForUnit(unit);
    }
  }

  removeObject(unitId: number): void {
    const areaId = this.objectAreaById.get(unitId);
    if (areaId === undefined) return;
    this.objectAreaById.delete(unitId);
    const ctx = this.areas.get(areaId);
    const unit = ctx?.objects.get(unitId);
    if (!unit) return;
    PATH_RemoveCollisionFootprintForUnit(unit, false);
    ctx!.objects.delete(unitId);
  }

  spawnMonster(
    areaId: number,
    monster: TownNpcMonsterLike,
    currentFrame: number,
  ): void {
    const ix = Math.round(monster.x);
    const iy = Math.round(monster.y);
    const ctx = this.areas.get(areaId);
    if (!ctx || !this.isInBounds(areaId, ix, iy)) return;
    this.removeMonster(monster.unitId);
    const room = this.findRoom(ctx, ix, iy);
    if (!room) return;
    const unit: PathUnit = {
      dwUnitType: UNIT_MONSTER,
      dwClassId: monster.hcIdx,
      dwUnitId: monster.unitId,
      dwAnimMode: monster.mode,
      dwFlags: 0,
      dwFlagEx: 0,
      pDynamicPath: null,
      pStaticPath: null,
      objectTxt: null,
    };
    PATH_AllocDynamicPath(room, ix, iy, unit, false);
    if (monster.dead || monster.mode === 0 || monster.mode === 12) {
      PATH_SetUnitDeadCollision(unit, true);
    }
    let npcAi: TownNpcAiState113c | null = null;
    if (monster.townNpcAiEnabled) {
      const savedAi = this.hibernatedNpcAi.get(monster.unitId);
      if (savedAi) {
        this.hibernatedNpcAi.delete(monster.unitId);
        savedAi.nextAiFrame =
          monster.mode === MONMODE_NEUTRAL
            ? currentFrame === 0
              ? 4
              : currentFrame + 2
            : Infinity;
        npcAi = savedAi;
      } else {
        npcAi = {
          homeInitialized: false,
          homeX: 0,
          homeY: 0,
          // Bootstrap monsters (currentFrame === 0) fire initial AI event on frame 4;
          // dynamically activated monsters fire on currentFrame + 2.
          nextAiFrame: currentFrame === 0 ? 4 : currentFrame + 2,
          animEndFrame: 0,
          node4: null,
          node4RetryCounter: 0,
          node7: null,
        };
      }
    }
    ctx.monsters.set(monster.unitId, { unit, npcAi });
    this.monsterAreaById.set(monster.unitId, areaId);
  }

  syncMonsterPosition(
    areaId: number,
    unitId: number,
    x: number,
    y: number,
    mode: number,
  ): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    this.migrateMonsterAreaIfSeamConnected(unitId, areaId);
    const prevArea = this.monsterAreaById.get(unitId);
    if (prevArea !== undefined && prevArea !== areaId) {
      this.removeMonster(unitId);
    }
    const ctx = this.areas.get(areaId);
    const entry = ctx?.monsters.get(unitId);
    if (!ctx || !entry) return;
    const pPath = entry.unit.pDynamicPath;
    entry.unit.dwAnimMode = mode;
    if (!pPath) return;
    if (pPath.wPosX === ix && pPath.wPosY === iy) return;
    if (!this.isInBounds(areaId, ix, iy)) return;
    const room = this.findRoom(ctx, ix, iy);
    if (!room) return;
    PATH_RemoveCollisionFootprintForUnit(entry.unit, false);
    pPath.dwPrecisionX = subtileCenter(ix);
    pPath.dwPrecisionY = subtileCenter(iy);
    pPath.pRoom = room;
    PATH_StopMovement(pPath);
    PATH_AddCollisionFootprintForUnit(entry.unit);
  }

  setMonsterDead(unitId: number): void {
    const areaId = this.monsterAreaById.get(unitId);
    if (areaId === undefined) return;
    const ctx = this.areas.get(areaId);
    const entry = ctx?.monsters.get(unitId);
    if (!entry) return;
    entry.unit.dwAnimMode = 12;
    PATH_SetUnitDeadCollision(entry.unit, true);
  }

  hibernateMonster(unitId: number): void {
    const areaId = this.monsterAreaById.get(unitId);
    if (areaId !== undefined) {
      const entry = this.areas.get(areaId)?.monsters.get(unitId);
      if (entry?.npcAi) {
        this.hibernatedNpcAi.set(unitId, entry.npcAi);
      }
    }
    this.removeMonster(unitId);
  }

  setTownNpcNextAiFrame(areaId: number, unitId: number, nextAiFrame: number): void {
    const entry = this.areas.get(areaId)?.monsters.get(unitId);
    if (entry?.npcAi) {
      entry.npcAi.nextAiFrame = nextAiFrame;
    }
  }

  removeMonster(unitId: number): void {
    this.hibernatedNpcAi.delete(unitId);
    const areaId = this.monsterAreaById.get(unitId);
    if (areaId === undefined) return;
    this.monsterAreaById.delete(unitId);
    const ctx = this.areas.get(areaId);
    const entry = ctx?.monsters.get(unitId);
    if (!entry) return;
    PATH_RemoveCollisionFootprintForUnit(entry.unit, false);
    if (entry.unit.pDynamicPath) {
      PATH_FreeDynamicPath(entry.unit.pDynamicPath);
    }
    ctx!.monsters.delete(unitId);
  }

  spawnOrSyncPlayer(
    areaId: number,
    unitId: number,
    charClassId: number,
    x: number,
    y: number,
    mode: number,
  ): PlayerPathEntry | null {
    const ix = Math.round(x);
    const iy = Math.round(y);
    this.migratePlayerAreaIfSeamConnected(unitId, areaId);
    const prevArea = this.playerAreaById.get(unitId);
    if (prevArea !== undefined && prevArea !== areaId) {
      this.removePlayer(unitId);
    }
    const ctx = this.areas.get(areaId);
    if (!ctx || !this.isInBounds(areaId, ix, iy)) return null;
    let entry = ctx.players.get(unitId);
    if (!entry) {
      const room = this.findRoom(ctx, ix, iy);
      if (!room) return null;
      const unit: PathUnit = {
        dwUnitType: UNIT_PLAYER,
        dwClassId: charClassId,
        dwUnitId: unitId,
        dwAnimMode: mode,
        dwFlags: 0,
        dwFlagEx: 0,
        pDynamicPath: null,
        pStaticPath: null,
        objectTxt: null,
      };
      PATH_AllocDynamicPath(room, ix, iy, unit, false);
      entry = {
        unit,
        run: false,
        velocityFp8: computePlayerVelocity113c(false, 0),
        targetUnitType: null,
        targetUnitId: null,
        stopRange: 0,
      };
      ctx.players.set(unitId, entry);
      this.playerAreaById.set(unitId, areaId);
      return entry;
    }
    entry.unit.dwAnimMode = mode;
    const pPath = entry.unit.pDynamicPath;
    if (pPath && (pPath.wPosX !== ix || pPath.wPosY !== iy)) {
      const room = this.findRoom(ctx, ix, iy);
      if (room) {
        PATH_RemoveCollisionFootprintForUnit(entry.unit, false);
        pPath.dwPrecisionX = subtileCenter(ix);
        pPath.dwPrecisionY = subtileCenter(iy);
        pPath.pRoom = room;
        PATH_StopMovement(pPath);
        PATH_AddCollisionFootprintForUnit(entry.unit);
      }
    }
    return entry;
  }

  removePlayer(unitId: number): void {
    const areaId = this.playerAreaById.get(unitId);
    if (areaId === undefined) return;
    this.playerAreaById.delete(unitId);
    const ctx = this.areas.get(areaId);
    const entry = ctx?.players.get(unitId);
    if (!entry) return;
    PATH_RemoveCollisionFootprintForUnit(entry.unit, false);
    if (entry.unit.pDynamicPath) {
      PATH_FreeDynamicPath(entry.unit.pDynamicPath);
    }
    ctx!.players.delete(unitId);
  }

  stopPlayer(unitId: number, neutralMode: number): void {
    const areaId = this.playerAreaById.get(unitId);
    if (areaId === undefined) return;
    const ctx = this.areas.get(areaId);
    const entry = ctx?.players.get(unitId);
    if (!entry) return;
    entry.unit.dwAnimMode = neutralMode;
    entry.targetUnitType = null;
    entry.targetUnitId = null;
    entry.stopRange = 0;
    const pPath = entry.unit.pDynamicPath;
    if (pPath) {
      PATH_SetTargetUnit(pPath, null);
      PATH_StopMovement(pPath);
    }
  }

  isPlayerMoving(areaId: number, unitId: number): boolean {
    this.migratePlayerAreaIfSeamConnected(unitId, areaId);
    const ctx = this.areas.get(areaId);
    const pPath = ctx?.players.get(unitId)?.unit.pDynamicPath;
    if (!pPath) return false;
    return pPath.dwPathPoints > 0 && pPath.dwCurrentPointIdx < pPath.dwPathPoints;
  }

  getPlayerNextWaypoint(
    areaId: number,
    unitId: number,
  ): { x: number; y: number } | null {
    this.migratePlayerAreaIfSeamConnected(unitId, areaId);
    const ctx = this.areas.get(areaId);
    const pPath = ctx?.players.get(unitId)?.unit.pDynamicPath;
    if (!pPath || pPath.dwPathPoints <= 0 || pPath.dwCurrentPointIdx >= pPath.dwPathPoints) {
      return null;
    }
    const pt = pPath.PathPoints[pPath.dwPathPoints - 1]!;
    return { x: pt.X, y: pt.Y };
  }

  planPlayerMoveToLocation(
    areaId: number,
    unitId: number,
    charClassId: number,
    curX: number,
    curY: number,
    targetX: number,
    targetY: number,
    run: boolean,
    velocityPercentBonus: number,
    moveMode: number,
  ): boolean {
    const tx = Math.round(targetX);
    const ty = Math.round(targetY);
    if (!this.isInBounds(areaId, curX, curY) || !this.isInReachableBounds(areaId, tx, ty)) {
      return false;
    }
    const neutralMode = TOWN_AREA_IDS_113C.has(areaId) ? 5 : 1;
    const entry = this.spawnOrSyncPlayer(areaId, unitId, charClassId, curX, curY, neutralMode);
    const pPath = entry?.unit.pDynamicPath;
    if (!entry || !pPath) return false;
    entry.run = run;
    entry.velocityFp8 = computePlayerVelocity113c(run, velocityPercentBonus);
    entry.targetUnitType = null;
    entry.targetUnitId = null;
    entry.stopRange = 0;
    PATH_SetTargetUnit(pPath, null);
    PATH_SetVelocity(pPath, entry.velocityFp8);
    PATH_SetStepNum(pPath, 0);
    PATH_SetNewDistance(pPath, 73);
    PATH_SetType(pPath, PATHTYPE_STRAIGHT);
    D2COMMON_10170_PathSetTargetPos(pPath, tx, ty);
    const pts = D2Common_10142(pPath, entry.unit, 0);
    if (pts > 0) {
      entry.unit.dwAnimMode = moveMode;
      return true;
    }
    this.stopPlayer(unitId, neutralMode);
    return false;
  }

  planPlayerMoveToUnit(
    areaId: number,
    unitId: number,
    charClassId: number,
    curX: number,
    curY: number,
    targetUnitType: number,
    targetUnitId: number,
    fallbackX: number,
    fallbackY: number,
    run: boolean,
    velocityPercentBonus: number,
    moveMode: number,
    stopRange = 0,
  ): boolean {
    if (!this.isInBounds(areaId, curX, curY)) return false;
    const ctx = this.areas.get(areaId);
    if (!ctx) return false;
    const targetUnit = this.findTargetPathUnit(ctx, targetUnitType, targetUnitId);
    if (!targetUnit) {
      return this.planPlayerMoveToLocation(
        areaId,
        unitId,
        charClassId,
        curX,
        curY,
        fallbackX,
        fallbackY,
        run,
        velocityPercentBonus,
        moveMode,
      );
    }
    const neutralMode = TOWN_AREA_IDS_113C.has(areaId) ? 5 : 1;
    const entry = this.spawnOrSyncPlayer(areaId, unitId, charClassId, curX, curY, neutralMode);
    const pPath = entry?.unit.pDynamicPath;
    if (!entry || !pPath) return false;
    entry.run = run;
    entry.velocityFp8 = computePlayerVelocity113c(run, velocityPercentBonus);
    entry.targetUnitType = targetUnitType;
    entry.targetUnitId = targetUnitId;
    entry.stopRange = stopRange;
    PATH_SetVelocity(pPath, entry.velocityFp8);
    PATH_SetStepNum(pPath, Math.max(0, stopRange));
    PATH_SetNewDistance(pPath, 73);
    PATH_SetType(pPath, PATHTYPE_STRAIGHT);
    const tPos = targetUnit.pDynamicPath
      ? { x: targetUnit.pDynamicPath.wPosX, y: targetUnit.pDynamicPath.wPosY }
      : targetUnit.pStaticPath
        ? { x: targetUnit.pStaticPath.x, y: targetUnit.pStaticPath.y }
        : { x: Math.round(fallbackX), y: Math.round(fallbackY) };
    D2COMMON_10170_PathSetTargetPos(pPath, tPos.x, tPos.y);
    PATH_SetTargetUnit(pPath, targetUnit);
    const pts = D2Common_10142(pPath, entry.unit, 0);
    if (pts > 0) {
      entry.unit.dwAnimMode = moveMode;
      return true;
    }
    this.stopPlayer(unitId, neutralMode);
    return false;
  }

  /**
   * Advances the player DynamicPath by 1 server frame (40ms).
   * Returns { x, y, stillMoving } or null if player has no active DynamicPath.
   */
  stepPlayerTick(
    areaId: number,
    unitId: number,
    run: boolean,
    velocityPercentBonus: number,
  ): { x: number; y: number; stillMoving: boolean } | null {
    this.migratePlayerAreaIfSeamConnected(unitId, areaId);
    const ctx = this.areas.get(areaId);
    const entry = ctx?.players.get(unitId);
    const pPath = entry?.unit.pDynamicPath;
    if (!ctx || !entry || !pPath) return null;
    if (pPath.dwPathPoints <= 0 || pPath.dwCurrentPointIdx >= pPath.dwPathPoints) {
      return { x: pPath.wPosX, y: pPath.wPosY, stillMoving: false };
    }
    entry.run = run;
    entry.velocityFp8 = computePlayerVelocity113c(run, velocityPercentBonus);
    PATH_SetVelocity(pPath, entry.velocityFp8);
    const stepped = D2Common_10226(entry.unit, 0);
    D2COMMON_10193_PATH_AdjustDirection(pPath);
    if (stepped === 0) {
      return { x: pPath.wPosX, y: pPath.wPosY, stillMoving: false };
    }
    return {
      x: pPath.wPosX,
      y: pPath.wPosY,
      stillMoving: pPath.dwCurrentPointIdx < pPath.dwPathPoints,
    };
  }

  /**
   * Steps all Town NPC monsters (MonStats.ai === 'Npc') for 1 server frame.
   */
  stepTownNpcs(
    monsters: Iterable<TownNpcMonsterLike>,
    getUnitSeed: (unitId: number) => D2SeedStrc | undefined,
    players: readonly TownNpcPlayerContext[],
    currentFrame: number,
    difficulty: number,
    onNpcMoved?: (
      mon: TownNpcMonsterLike,
      prevX: number,
      prevY: number,
    ) => void,
  ): void {
    const diffIdx = Math.max(0, Math.min(2, difficulty));
    for (const mon of monsters) {
      if (mon.dead || !mon.townNpcAiEnabled) continue;
      const ctx = this.areas.get(mon.areaId);
      const entry = ctx?.monsters.get(mon.unitId);
      const pPath = entry?.unit.pDynamicPath;
      const ai = entry?.npcAi;
      if (!ctx || !entry || !pPath || !ai) continue;
      const unitSeed = getUnitSeed(mon.unitId);
      if (!unitSeed) continue;

      const interacting = players.some(
        (p) => p.areaId === mon.areaId && p.activeNpcId === mon.unitId,
      );
      if (interacting && mon.mode === MONMODE_WALK) {
        PATH_StopMovement(pPath);
        mon.mode = MONMODE_NEUTRAL;
        entry.unit.dwAnimMode = MONMODE_NEUTRAL;
      }

      let immediateAi = false;

      if (mon.mode === MONMODE_WALK) {
        const prevX = mon.x;
        const prevY = mon.y;
        const vel = computeMonsterWalkVelocity113c(mon.hcIdx);
        PATH_SetVelocity(pPath, vel);
        const stepped = D2Common_10226(entry.unit, 0x400);
        D2COMMON_10193_PATH_AdjustDirection(pPath);
        mon.x = pPath.wPosX;
        mon.y = pPath.wPosY;
        if (mon.x !== prevX || mon.y !== prevY) {
          onNpcMoved?.(mon, prevX, prevY);
        }
        if (stepped === 0) {
          mon.mode = MONMODE_NEUTRAL;
          entry.unit.dwAnimMode = MONMODE_NEUTRAL;
          immediateAi = true;
        }
      } else if (mon.mode >= MONMODE_SKILL1 && mon.mode <= MONMODE_SKILL4) {
        if (currentFrame >= ai.animEndFrame) {
          mon.mode = MONMODE_NEUTRAL;
          entry.unit.dwAnimMode = MONMODE_NEUTRAL;
          const aidel = MONSTATS_113C_ROWS[mon.hcIdx]?.aidel?.[diffIdx] ?? 15;
          ai.nextAiFrame = currentFrame + aidel;
        }
      }

      if (
        mon.mode !== MONMODE_WALK &&
        !(mon.mode >= MONMODE_SKILL1 && mon.mode <= MONMODE_SKILL4) &&
        (immediateAi || currentFrame >= ai.nextAiFrame)
      ) {
        this.runAiNpc113c(
          ctx,
          entry.unit,
          pPath,
          mon,
          unitSeed,
          ai,
          players,
          currentFrame,
        );
      }
    }
  }

  private runAiNpc113c(
    ctx: AreaPathContext113c,
    npcUnit: PathUnit,
    pPath: DynamicPath,
    mon: TownNpcMonsterLike,
    unitSeed: D2SeedStrc,
    ai: TownNpcAiState113c,
    players: readonly TownNpcPlayerContext[],
    currentFrame: number,
  ): void {
    // 1. Player interaction freeze (0x6FC3DB40)
    const interacting = players.some(
      (p) => p.areaId === mon.areaId && p.activeNpcId === mon.unitId,
    );
    if (interacting) {
      if (mon.mode === MONMODE_WALK) {
        PATH_StopMovement(pPath);
        mon.mode = MONMODE_NEUTRAL;
        npcUnit.dwAnimMode = MONMODE_NEUTRAL;
      }
      ai.nextAiFrame = currentFrame + 20;
      return;
    }

    // 2. Initialize node10 home anchor on first AI tick
    if (!ai.homeInitialized) {
      ai.homeInitialized = true;
      ai.homeX = pPath.wPosX;
      ai.homeY = pPath.wPosY;
      ai.nextAiFrame = currentFrame + 20;
      return;
    }

    // 3. QUESTS_NpcGreetingAi (0x6FC39C20) — Act 1 Warriv (hcIdx 155 in area 1)
    if (mon.hcIdx === 155 && mon.areaId === 1) {
      let nearestPlayer: TownNpcPlayerContext | null = null;
      let nearestPlayerUnit: PathUnit | null = null;
      let bestDist = Infinity;
      for (const p of players) {
        if (p.areaId !== mon.areaId || p.warrivGreeted) continue;
        const pEntry = ctx.players.get(p.unitId);
        if (!pEntry) continue;
        // AI_FindNearestPlayer (0x6FD130C0 -> 0x6FD11A90) uses 0x6FCD0A20(npc, player)
        // and rejects players with dist > 15 (cmp esi, 0x0f; jg).
        const d = unitSizeSubtractedOctileDist113c(npcUnit, pEntry.unit);
        if (d > 15) continue;
        if (d < bestDist) {
          bestDist = d;
          nearestPlayer = p;
          nearestPlayerUnit = pEntry.unit;
        }
      }
      if (nearestPlayer && nearestPlayerUnit) {
        const dist = bestDist;
        if (dist > 2 && dist < 24) {
          if (distApprox113c(pPath.wPosX, pPath.wPosY, ai.homeX, ai.homeY) > 16) {
            ai.node4 = { x: ai.homeX, y: ai.homeY, count: 12, delay: 10 };
            ai.nextAiFrame = currentFrame + 10;
            return;
          }
          const pPosPath = nearestPlayerUnit.pDynamicPath;
          const playerX = pPosPath ? pPosPath.wPosX : Math.round(nearestPlayer.x);
          const playerY = pPosPath ? pPosPath.wPosY : Math.round(nearestPlayer.y);
          const npcX = pPath.wPosX;
          const npcY = pPath.wPosY;
          const maxStep = dist >= 5 ? 3 : dist - 2;
          const step = Math.min(Math.abs(dist - 2), maxStep);
          const dx = Math.abs(npcX - playerX);
          const dy = Math.abs(npcY - playerY);
          const sum = Math.max(dx + dy, step);
          let stepX = sum > 0 ? Math.trunc((dx * step) / sum) : 0;
          let stepY = sum > 0 ? Math.trunc((dy * step) / sum) : 0;
          while (sum > 0 && stepX + stepY < step) {
            stepX += 1;
            stepY += 1;
          }
          const dirX = playerX > npcX ? 1 : playerX < npcX ? -1 : 0;
          const dirY = playerY > npcY ? 1 : playerY < npcY ? -1 : 0;
          const targetX = npcX + dirX * stepX;
          const targetY = npcY + dirY * stepY;
          const pts = startNpcWalkToPos113c(
            pPath,
            npcUnit,
            mon.hcIdx,
            targetX,
            targetY,
            PATHTYPE_STRAIGHT,
            1,
          );
          if (pts > 0) {
            mon.mode = MONMODE_WALK;
            npcUnit.dwAnimMode = MONMODE_WALK;
          } else {
            ai.nextAiFrame = currentFrame + 10;
          }
          return;
        }
        // dist <= 2 || dist >= 24 while greeting active: stand still and wait 20 frames
        if (mon.mode === MONMODE_WALK) {
          PATH_StopMovement(pPath);
          mon.mode = MONMODE_NEUTRAL;
          npcUnit.dwAnimMode = MONMODE_NEUTRAL;
        }
        ai.nextAiFrame = currentFrame + 20;
        return;
      }
    }

    // 4. AI_HandleNpcNodes (0x6FC36A30)
    if (ai.node4 && ai.node4.count > 0) {
      const n4 = ai.node4;
      if (
        n4.x !== 0 &&
        n4.y !== 0 &&
        distApprox113c(pPath.wPosX, pPath.wPosY, n4.x, n4.y) > 3
      ) {
        const pathType =
          (ai.node4RetryCounter & 3) === 0
            ? PATHTYPE_MON_CIRCLE_CW
            : PATHTYPE_STRAIGHT;
        ai.node4RetryCounter = (ai.node4RetryCounter + 1) | 0;
        const pts = startNpcWalkToPos113c(
          pPath,
          npcUnit,
          mon.hcIdx,
          n4.x,
          n4.y,
          pathType,
          0,
        );
        if (pts > 0) {
          mon.mode = MONMODE_WALK;
          npcUnit.dwAnimMode = MONMODE_WALK;
        } else {
          ai.nextAiFrame = currentFrame + n4.delay;
        }
      } else {
        ai.nextAiFrame = currentFrame + n4.delay;
      }
      n4.count -= 1;
      return;
    }

    if (ai.node7 && ai.node7.mode !== 0) {
      const n7 = ai.node7;
      if (n7.mode >= MONMODE_SKILL1 && n7.mode <= MONMODE_SKILL4) {
        const dist = distApprox113c(pPath.wPosX, pPath.wPosY, n7.x, n7.y);
        if (dist > 0) {
          if (n7.ticks > 0) {
            const pts = startNpcWalkToPos113c(
              pPath,
              npcUnit,
              mon.hcIdx,
              n7.x,
              n7.y,
              PATHTYPE_STRAIGHT,
              0,
            );
            if (pts > 0) {
              mon.mode = MONMODE_WALK;
              npcUnit.dwAnimMode = MONMODE_WALK;
            } else {
              ai.nextAiFrame = currentFrame + 25;
            }
            n7.ticks -= 1;
            return;
          }
          if (dist > 1) {
            n7.mode = 0;
          }
        }

        if (n7.mode !== 0) {
          if (mon.hcIdx === 154) {
            pPath.nDirection = 0x38;
          } else if (mon.hcIdx === 155) {
            pPath.nDirection = 0x34;
          } else if (mon.hcIdx === 178) {
            pPath.nDirection = 0x04;
          } else if (mon.hcIdx === 405) {
            if (n7.mode === MONMODE_SKILL1) pPath.nDirection = 0x34;
            else if (n7.mode === 9) pPath.nDirection = 0x30;
          }

          if (mon.hcIdx === 511 && rollLimitedSeed113c(unitSeed, 100) > 4) {
            n7.mode = 0;
            ai.nextAiFrame = currentFrame + 50;
            return;
          }

          if (mon.mode === n7.mode) {
            ai.nextAiFrame = currentFrame + 50;
            return;
          }
          const skillMode = n7.mode;
          n7.mode = 0;
          mon.mode = skillMode;
          npcUnit.dwAnimMode = skillMode;
          ai.animEndFrame =
            currentFrame + computeMonsterSkillAnimTicks113c(mon.hcIdx, skillMode);
          return;
        }
      } else {
        n7.mode = 0;
        ai.nextAiFrame = currentFrame + 50;
        return;
      }
    }

    // Fara (hcIdx === 178) spontaneous skill node7 trigger (falls through!)
    if (
      mon.hcIdx === 178 &&
      (!ai.node7 || ai.node7.mode === 0) &&
      rollLimitedSeed113c(unitSeed, 100) < 66
    ) {
      ai.node7 = {
        mode: MONMODE_SKILL1,
        x: pPath.wPosX,
        y: pPath.wPosY,
        ticks: 0,
      };
    }

    // 5. AI_FollowDs1NpcPath (0x6FC3BBC0)
    const mapAi = mon.mapAi;
    if (!mapAi || mapAi.length === 0) {
      ai.nextAiFrame = currentFrame + 20;
      return;
    }

    if (rollLimitedSeed113c(unitSeed, 100) >= 66) {
      ai.nextAiFrame = currentFrame + 8;
      return;
    }

    const wpIdx = rollLimitedSeed113c(unitSeed, mapAi.length);
    const wp = mapAi[wpIdx]!;
    if (wp.action <= 0 || wp.action >= 6) {
      ai.nextAiFrame = currentFrame + 8;
      return;
    }

    const canMove =
      wp.x !== 0 &&
      wp.y !== 0 &&
      distApprox113c(pPath.wPosX, pPath.wPosY, wp.x, wp.y) > 0;
    let pts = 0;
    if (canMove) {
      pts = startNpcWalkToPos113c(
        pPath,
        npcUnit,
        mon.hcIdx,
        wp.x,
        wp.y,
        PATHTYPE_STRAIGHT,
        0,
      );
      if (pts > 0) {
        mon.mode = MONMODE_WALK;
        npcUnit.dwAnimMode = MONMODE_WALK;
      }
    }

    if (wp.action === 2) {
      ai.node4 = { x: wp.x, y: wp.y, count: 20, delay: 10 };
    } else if (canMove) {
      ai.node4 = { x: wp.x, y: wp.y, count: 12, delay: 10 };
    }

    if (canMove && wp.action === 4) {
      const hasS1 =
        (getMonsterPathRecord(mon.hcIdx).modeFlags & (1 << MONMODE_SKILL1)) !== 0;
      ai.node7 = {
        mode: hasS1 ? MONMODE_SKILL1 : MONMODE_NEUTRAL,
        x: wp.x,
        y: wp.y,
        ticks: 4,
      };
    } else if (canMove && wp.action === 5) {
      const hasS2 = (getMonsterPathRecord(mon.hcIdx).modeFlags & (1 << 9)) !== 0;
      ai.node7 = {
        mode: hasS2 ? 9 : MONMODE_NEUTRAL,
        x: wp.x,
        y: wp.y,
        ticks: 4,
      };
    }

    if (pts <= 0) {
      ai.nextAiFrame = currentFrame + 8;
    }
  }

  /**
   * Raw `D2DynamicPathStrc` fields of a player (`unitType` 0) or monster (`unitType` 1) for AI ports that
   * read them through D2Common getters (kb/monsters/d2game-necropet-ai-113c.md §3):
   * `x`/`y` = `#10867` / `#10750` (`wPosX` / `wPosY`), `targetX`/`targetY` = `#10983` / `#10764`
   * (`tTargetCoord`), `finalX`/`finalY` = `#10690` / `#10999` (`tFinalTargetCoord`), `room` = `#10331`
   * `UNITS_GetRoom`. `null` when the unit has no dynamic path in `areaId` (or a seam-connected area).
   */
  getUnitPathState113c(
    areaId: number,
    unitType: number,
    unitId: number,
  ): {
    readonly x: number;
    readonly y: number;
    readonly targetX: number;
    readonly targetY: number;
    readonly finalX: number;
    readonly finalY: number;
    readonly room: PathRoom | null;
  } | null {
    const ctx = this.areas.get(areaId);
    if (!ctx) return null;
    const p = this.findTargetPathUnit(ctx, unitType, unitId)?.pDynamicPath;
    if (!p) return null;
    return {
      x: p.wPosX,
      y: p.wPosY,
      targetX: p.tTargetCoord.X,
      targetY: p.tTargetCoord.Y,
      finalX: p.tFinalTargetCoord.X,
      finalY: p.tFinalTargetCoord.Y,
      room: p.pRoom,
    };
  }

  /**
   * `D2Common #10916` (1.13c `0x6FD8C6D0`) as used by pet/hireable AI: `DUNGEON_GetRoomAtPosition`
   * (`0x6FD51330`) from `room`; returns `0` when `(x, y)` is in neither `room` nor an adjacent active
   * room. On a hit, delegates to `0x6FDD19C0` (`sub_6FD77110` on `pRoomEx->pLogicalRoomInfo`, returning
   * `coordList.nIndex` or `-1` when none) when DRLG rooms are active, or falls back to `ctx.areaId`.
   */
  tileZoneAtPosition113c(room: PathRoom | null, x: number, y: number): number {
    const hit = DUNGEON_GetRoomAtPosition(room, x | 0, y | 0);
    if (!hit) return 0;
    for (const ctx of this.areas.values()) {
      if (ctx.rooms.includes(hit)) {
        if (this.drlgTileZoneResolver !== null) {
          return this.drlgTileZoneResolver(ctx.areaId, x | 0, y | 0);
        }
        return ctx.areaId;
      }
    }
    throw new Error(`#10916: room at ${x},${y} belongs to no area context`);
  }

  private findTargetPathUnit(
    ctx: AreaPathContext113c,
    targetUnitType: number,
    targetUnitId: number,
  ): PathUnit | null {
    const lookup = (c: AreaPathContext113c): PathUnit | null => {
      if (targetUnitType === UNIT_MONSTER) {
        return c.monsters.get(targetUnitId)?.unit ?? null;
      }
      if (targetUnitType === UNIT_OBJECT) {
        return c.objects.get(targetUnitId) ?? null;
      }
      if (targetUnitType === UNIT_PLAYER) {
        return c.players.get(targetUnitId)?.unit ?? null;
      }
      return null;
    };
    const direct = lookup(ctx);
    if (direct) return direct;
    for (const candId of this.getSeamConnectedAreaIds(ctx.areaId)) {
      if (candId === ctx.areaId) continue;
      const cand = this.areas.get(candId);
      if (!cand) continue;
      const hit = lookup(cand);
      if (hit) return hit;
    }
    return null;
  }
}
