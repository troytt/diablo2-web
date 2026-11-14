/**
 * Capture of the level state read by 1.13c `DUNGEON_FindActSpawnLocationEx` (D2Common `0x6FD6A130`,
 * see `src/common/world/act-spawn-location.ts` and
 * `kb/world/d2common-act-spawn-location-raytrace-113c.md`), taken from the ported DRLG level.
 *
 * All coordinates are converted to level-local tiles relative to `(originX, originY)` — the same origin
 * the `DrlgLevelInput` tiles use.
 */

import type { D2SeedStrc } from '../rng/d2-rng.ts'
import type { ActSpawnLevelData, ActSpawnRoomRect, ActSpawnTileInfo } from '../world/act-spawn-location.ts'
import { DATATBLS_GetLevelDefRecord, objectSubClass, type DrlgTables } from './drlg-tables.ts'
import {
  DRLGROOMFLAG_HAS_WARP_0,
  DRLGROOMFLAG_HAS_WARP_MASK,
  DRLGROOMFLAG_HAS_WAYPOINT_MASK,
  type D2DrlgLevelStrc,
} from './drlg-types.ts'
import { DRLGWARP_GetWarpDestinationFromArray } from './drlg-warp.ts'

/** `UNIT_OBJECT` preset-unit type tested at `0x6FD69FE1` (`cmp [ecx+0x14],2`). */
const UNIT_OBJECT = 2
/** `cmp eax,0x23d` at `0x6FD69FEA`: preset object ids `>= 573` are skipped. */
const PRESET_OBJECT_LIMIT = 573
/** `Objects.txt` `SubClass` (record `+0x167`) waypoint bit tested at `0x6FD69FFF`. */
const OBJECT_SUBCLASS_WAYPOINT = 0x40

/** The captured spawn data plus the level seed (`pLevel + 0x1C4/0x1C8`) at capture time. */
export interface DrlgActSpawnCapture {
  readonly level: ActSpawnLevelData
  readonly seed: readonly [lo: number, hi: number]
}

/**
 * Snapshot `pLevel` for `DUNGEON_FindActSpawnLocationEx`.
 *
 * - `tileInfo`: `pLevel->pTileInfo[0 .. nTileInfo)` (absolute act tiles in 1.13c).
 * - waypoint room (`0x6FD69FA0`): first room with `dwFlags & 0x30000`; its first type-2 preset unit with
 *   `classId < 573` and `Objects.txt` `SubClass & 0x40` gives `room.x + x/5`, `room.y + y/5`.
 * - warp room (`0x6FD69AD0`): first room with a `dwFlags` warp bit `0x10 << i` whose level warp slot `i`
 *   (`0x6FD69950`) is not -1.
 * - centre probe (`0x6FD6A1F1`): `pLevelCoords.x + w/2 - 2`, `pLevelCoords.y + h/2 - 2`.
 */
export function DRLG_CaptureActSpawnLevel(
  pLevel: D2DrlgLevelStrc,
  tables: DrlgTables,
  originX: number,
  originY: number,
): DrlgActSpawnCapture {
  const levelDef = DATATBLS_GetLevelDefRecord(tables, pLevel.nLevelId)
  const tileInfo: ActSpawnTileInfo[] = []
  for (let i = 0; i < pLevel.nTileInfo; i += 1) {
    const t = pLevel.pTileInfo[i]!
    tileInfo.push({ x: t.nPosX - originX, y: t.nPosY - originY, index: t.nTileIndex })
  }

  const rooms: ActSpawnRoomRect[] = []
  let waypointRoom = -1
  let waypointTile: { x: number; y: number } | null = null
  let warpRoom = -1
  let r = 0
  for (let pRoom = pLevel.pFirstRoomEx; pRoom; pRoom = pRoom.pDrlgRoomNext, r += 1) {
    const c = pRoom.pDrlgCoord
    rooms.push({ x: c.nPosX - originX, y: c.nPosY - originY, w: c.nWidth, h: c.nHeight })
    if (waypointRoom < 0 && (pRoom.dwFlags & DRLGROOMFLAG_HAS_WAYPOINT_MASK) !== 0) {
      waypointRoom = r
      for (let u = pRoom.pPresetUnits; u; u = u.pNext) {
        if (u.nUnitType !== UNIT_OBJECT || u.nIndex >= PRESET_OBJECT_LIMIT) continue
        if ((objectSubClass(tables, u.nIndex) & OBJECT_SUBCLASS_WAYPOINT) === 0) continue
        waypointTile = {
          x: c.nPosX + Math.trunc(u.nXpos / 5) - originX,
          y: c.nPosY + Math.trunc(u.nYpos / 5) - originY,
        }
        break
      }
    }
    if (warpRoom < 0 && (pRoom.dwFlags & DRLGROOMFLAG_HAS_WARP_MASK) !== 0) {
      let i = 0
      for (let bit = DRLGROOMFLAG_HAS_WARP_0; (bit & DRLGROOMFLAG_HAS_WARP_MASK) !== 0; bit <<= 1, i += 1) {
        if ((pRoom.dwFlags & bit) !== 0 && DRLGWARP_GetWarpDestinationFromArray(pLevel, i) !== -1) {
          warpRoom = r
          break
        }
      }
    }
  }

  const lc = pLevel.pLevelCoords
  const seed: D2SeedStrc = pLevel.pSeed
  return {
    level: {
      position: levelDef.dwPosition,
      tileInfo,
      rooms,
      waypointRoom,
      waypointTile,
      warpRoom,
      centreX: lc.nPosX + Math.trunc(lc.nWidth / 2) - 2 - originX,
      centreY: lc.nPosY + Math.trunc(lc.nHeight / 2) - 2 - originY,
    },
    seed: [seed.lo >>> 0, seed.hi >>> 0],
  }
}
