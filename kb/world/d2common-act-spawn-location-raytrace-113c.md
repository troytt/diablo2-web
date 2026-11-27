# D2Common 1.13c: act spawn location, special-tile index table and COLLISION_RayTrace

Ground truth: `samples/d2/D2Common.dll` (1.13c, image base `0x6FD50000`), `samples/d2/D2Game.dll`
(image base `0x6FC20000`), `Levels.txt` from `Patch_D2.mpq`.

> Note: many `D2Common.0x6FD4xxxx`/`0x6FD8xxxx` comments in `src/common/drlg/*` are D2MOO **1.10**
> addresses. In 1.13c the `.text` section is `0x6FD51000..0x6FDD9000`, so e.g. `0x6FD413E0` cannot be a
> 1.13c D2Common address and `0x6FD81330` is mid-function. The 1.13c equivalents are listed below.

## 1. Special tiles -> `pLevel->pTileInfo[]` (DRLG preset load, `0x6FD5C45F..0x6FD5C50D`)

While scanning a preset DS1 (`LvlPrest.txt` `Scan = 1`), every wall-layer special tile whose
orientation/style field is in `30..33` (`cmp esi,0x1e` / `cmp esi,0x21`) appends one
`{ nPosX, nPosY, nTileIndex }` record (stride `0xC`) to the level:

| level field | offset |
|---|---|
| `pTileInfo[i].nPosX` | `pLevel + 0x2C + 0xC*i` (DS1 x + `pDrlgMap->pDrlgCoord.nPosX`) |
| `pTileInfo[i].nPosY` | `pLevel + 0x30 + 0xC*i` |
| `pTileInfo[i].nTileIndex` | `pLevel + 0x34 + 0xC*i` |
| `nTileInfo` (count) | `pLevel + 0x1D8` (no bounds check in 1.13c) |

`nTileIndex` (jump table `0x6FD5C67C`): style 30 -> `sequence`, 31 -> `sequence + 5`, 32 -> `10`,
33 -> `11` (a fifth case writing `12` exists but is unreachable because of the `<= 33` guard).

## 2. Tile-index group table (`0x6FDE4F48`, 14 x `{ bMatchGroup, nGroup }`)

```
idx : 0  1  2  3  4  5  6  7  8  9  10 11 12 13
flag: 1  0  0  0  0  0  1  0  0  0  0  0  0  0
grp : 0  0  0  0  0  0  1  1  1  1  2  3  4  5
```

A request for index `n` matches a record whose index equals `n`, or (when `flag[n] != 0`) any record
in the same group. So index `0` matches every style-30 entry tile (sequences `0..5`) and index `6`
matches every style-31 entry (`6..9`).

## 3. `sub_6FD69B60` — pick a tile-info record (`ecx = pLevel`, `ebx = nTileIndex`)

1. Count the matching records (`0x6FD69B61..0x6FD69B9D`).
2. `count == 0` -> pick record `0`; `count == 1` -> the match; `count > 1` -> roll the **level seed**
   (`pLevel + 0x1C4/0x1C8`, LCG `0x6AC690C5`) `1 + (rand % count)` (power-of-two fast path uses `&`).
3. Walk the records again decrementing on each match; output `pTileInfo[k].nPosX/nPosY` (**tile
   coordinates**) and resolve the containing room (`0x6FD7E5C0`).

## 4. `DUNGEON_FindActSpawnLocationEx` core (`0x6FD6A130`) and exports

- `#10942` (`0x6FD8CEE0`) = raw: `(pAct, nLevelId, nTileIndex, &tileX, &tileY)` -> room.
- `#10816` (`0x6FD8CDF0`) = `(pAct, nLevelId, nTileIndex, &x, &y, nUnitSize)`: calls the core, converts
  tile -> sub-tile `x*5+3, y*5+3`, then `COLLISION_GetFreeCoordinates` (`0x6FD9D140`) with mask
  `0x1C09` (both masks), radius `0x32` (50), then re-resolves the room.

Core logic: find (or build) the level, then branch on `LevelDefs[nLevelId] + 0x90` (`Levels.txt`
**`Position`** column; `1` for levels 1, 38, 40, 46, 54, 73, 74, 75, 102, 103, 109, 121, 125, 126, 127,
132, 134, 135):

- `Position != 0`: `nTileIndex == 13` -> waypoint lookup (`0x6FD69FA0`); otherwise `sub_6FD69B60`.
- `Position == 0`: waypoint lookup (`0x6FD69FA0`), else warp-room lookup (`0x6FD69AD0`), else the level
  centre `(x + w/2 - 2, y + h/2 - 2)` (`0x6FD7D600`), else `0x6FD69A50`.

Waypoint lookup (`0x6FD69FA0`): first room with `dwFlags & 0x30000`, then its preset units of type `2`,
`classId < 573`, `Objects.txt` record byte `+0x167 & 0x40`; returns `room.tileX + unit.x/5`,
`room.tileY + unit.y/5` (tile coordinates).

D2Game callers of `#10816` (stdcall, 3rd argument = `nTileIndex`):

| call site | nLevelId | nTileIndex |
|---|---|---|
| `0x6FC6B571`, `0x6FC6B6FE`, `0x6FC8BC22`, `0x6FC8D362` | variable | `0` (entry tile) |
| `0x6FCC2318`, `0x6FCC23C8` | variable | `11` (town portal mouth, style 33) |
| `0x6FCE8000` | `40` | `12` (unreachable index -> falls back to `pTileInfo[0]`) |
| `0x6FCBE018`, `0x6FCBE22A` | variable | variable |

## 5. `COLLISION_RayTrace` (`0x6FD9AD20`, stdcall `(pRoom, pBegin, pInOutEnd, nMask)`)

Exported wrappers: `#10864` (`0x6FD9E750`: `(pRoom, x0, y0, x1, y1, nMask)` returns `!hit`),
`#10479` (`0x6FD9F160`: unit -> coordinate), `#10374` (`0x6FD806D0`).

- Tests the **begin sub-tile first** (the vertical/horizontal fast paths loop `|d|+1` cells starting at
  the begin cell; the general path tests the current cell before stepping).
- General case is a single-major-axis Bresenham: step the major axis by 1 every iteration, add the
  minor delta to an accumulator that starts at **0**, and step the minor axis when
  `acc >= majorDelta` (`acc -= majorDelta`). No half-step rounding and no supercover/corner cells.
- The end cell is included. Crossing into a sub-tile that is in no reachable room
  (`DUNGEON_GetRoomAtPosition` = NULL) counts as a hit.
- On a hit, writes the hit sub-tile to `*pInOutEnd` and returns `1`; otherwise returns `0`.

## 6. Act link tables (verified equal to the D2MOO-derived TS tables)

`.rdata` `0x6FDDCBE8` (Act I wilderness 4,3,2,1,17), `0x6FDDCCD8` (Act I monastery 39,26,7,6,5),
`0x6FDDCDC8` (Act II 40..45), `0x6FDDD098` (Act IV 103..106), `0x6FDDD278` (Act V 109..112).
1.13c linker addresses: `0x6FD657D0` (by LevelDef offset), `0x6FD65680`, `0x6FD64F90`, `0x6FD65250`,
`0x6FD644C0`, `0x6FD64E30`, `0x6FD65480`, `0x6FD64D00`, `0x6FD64B00`, `0x6FD90FC0`
(link by level coords), `0x6FD90E10` (link by offset coords; offsets table `0x6FDE380C` =
`{0,-160},{-96,-64},{-64,-96},{-160,0}`, rand 0 -> 64x160, rand 1 -> 160x64).
