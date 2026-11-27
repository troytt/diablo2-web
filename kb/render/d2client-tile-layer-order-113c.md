# D2Client 1.13c — tile layer order, wall routing, wall occlusion fade, and POPS roof/building reveal (issues #919, #1009)

Ground truth: `samples/d2/D2Client.dll` / `D2Common.dll` 1.13c (D2Client ImageBase `0x6fab0000`, D2Common ImageBase `0x6fd50000`), disassembled with
`objdump -d -M intel`. Port: `src/common/world/d2map.ts` (`isLowerWallType`), `src/common/drlg/drlg-map.ts`
(`fadeBox`, `logicalIndex`, `pops`), `src/client/view/scene-source.ts`, `src/client/scene/world-renderer.ts`,
`src/client/scene/wall-fade-113c.ts`. Audit: `tools/verify-z-order-919.ts` (all 136 levels).

## 1. Routing a room wall tile (`0x6fb2a72e`)

Per room, wall tiles whose `dwFlags & 0x1c000` (wall layer) is non-zero are routed by `nTileType` (`[tile+0x1c]`):

| `nTileType` | Builder | Cell list | Drawn by |
|---|---|---|---|
| `15` (roof) | `0x6fb29d30` | `cell+0x1c` | `0x6fac3a00` (roof pass) |
| `16..19` (`*_WALL_DOWN`, lower walls) | `0x6fb29e20` | `cell+0x20` | `0x6fb4ec10` (lower-wall pass) |
| everything else, incl. `10`/`11` (`WALL_LEFT_EXIT`/`WALL_RIGHT_EXIT`) | `0x6fb2a340` | upper-wall list | `0x6fb4ee90` |

Types `10`/`11` are **not** lower walls (the port had them as "lower walls" and drew `16..19` as upper walls). The DT1
`roofHeight` header field never selects a pass.

## 2. Frame pass order (`0x6fb3b110`)

1. lower walls: loop over the draw grid calling `0x6fb4ec10` (`0x6fb3b21f`) — **before** the floor;
2. floor pass `0x6fac4050`;
3. weather ground cels `0x6fb2fc70` (twice);
4. `0x6fb4f270` (flag-gated), then walls/units `0x6fb4ee90`;
5. roofs `0x6fac3a00` (when the roof flag `[0x6fb7ee50]+4` is set).

Because lower walls precede the floor, a cliff face (`16..19`) only shows where no floor tile covers it — through a
chasm or void. Drawing them after the floor (sorted with units) produced the Act 4 "red rock pillars standing on the
plateau" artefact (Outer Steppes / Plains of Despair).

## 3. Upper-wall occlusion fade

- Per frame (`0x6fb2ab9c..0x6fb2ac51`): `0x6fbc3b18 = playerPathX / 5`, `0x6fbc3b20 = playerPathY / 5`,
  `0x6fbc3b1c = D2Common.#10916(room, x, y)` (`0x6fd8c6d0` -> `0x6fdd19c0`): the `nIndex` of the logical-room coord
  list at the player's cell (`pLogicalRoomInfo->pCoordList` if `flags & 1` (HAS_COORD_LIST), else
  `pIndexY[y/5 - nPosY][x/5 - nPosX]`), `-1` if none.
- `0x6fb2a340`: if `dwFlags & 0x4` (MAPTILE_TREES) is clear, call `0x6fb29f20`. Its gate `0x6fb924f4` is a static `1`
  in `.data` with exactly one reference (the read at `0x6fb29f27`), so the first branch is always taken:
  `pList = tile->unk0x10; if (!pList || pList->nIndex == [0x6fbc3b1c]) return 0;
  return [0x6fbc3b18] < pList->pBox[0].nPosX || [0x6fbc3b20] < pList->pBox[0].nPosY;`
- Fade on (`[tile+0x24] & 1` clear): `from = 0xff`, `to = 0x80`, `end = now + 500` (+ `(alpha - 0xff) * 500 / 127` when
  mid-ramp), flags `|= 3`. Fade off (bit 0 set): `from = 0x80`, `to = 0xff`, `end = now + 500 + (0x80 - alpha) * 500 / 127`,
  flags `= (flags & ~1) | 2`.
- Draw (`0x6fb4ef21..0x6fb4ef7e`, also `0x6fac3ac2` for roofs and `0x6fb4ec39` for lower walls): if bit 1 and renderer mode `>= 4` (3D) and `now < end`:
  `alpha = from + (to - from) * (now - end + 500) / 500`; else `alpha = to`, bit 1 cleared. `alpha == 0` sets `0x400`
  (hidden). The wall is drawn at `[tile+0x28]` and lit from the faded light table `0x6fb8eef8` while bit 0 is set.
- `tile->unk0x10` is written only by `DRLGLOGIC_SetCoordListForTiles` (D2Common `0x6FD76C50`) for rooms whose
  LvlPrest row has `Logicals = 1` (dungeons, Kurast city, Act 4 Fortress / Mesa, Act 1 cottages ...). Rooms built with
  `DRLGLOGIC_AllocCoordLists` (all outdoor rooms and presets with `Logicals = 0`, e.g. Rogue Encampment, Lut Gholein,
  **Kurast Docks** (`Act3\docktown`), Harrogath) keep `unk0x10 = 0`: their walls never fade via `0x6fb29f20`.

## 4. POPS roof & upper-story building reveal (`0x6fd5a6a0` / `0x6fd5a180`, issue #1009)

While `0x6fb2a340` only fades upper walls `0xff <-> 0x80`, **D2Common** fades roofs (`nTileType == 15`), POPS-indexed
second-story walls (`style == popSubIndex`), and hidden cutaway walls (`dwFlags & 0x200`) when the player enters or
leaves a preset's **POPS** bounding box:

- **Preset POPS boxes (`DRLGPRESET_BuildArea` `0x6fd5b060..0x6fd5b1dd`)**: Special tiles with `mainIndex == 8..29` carry
  `pPopsIndex[i] = (mainIndex - 8) + 1` (`1..22`), `pPopsSubIndex[i] = subIndex` (0 if `>= 64`, negative if matched pair `< 0`),
  and `pPopsPos[i]` (`D2DrlgCoordStrc` from the pair of markers, shifted by sub-cell pad `pPad[i]` in sub-unit coords).
  Only preset maps whose `LvlPrest.txt` row has `Pops > 0` allocate `pPopsIndex` (`0x6fd5ae0a`).
- **Per-unit update (`D2Common.#10562` `DUNGEON_TogglePops` `0x6fd8c2f0` -> `DRLGPRESET_UpdatePops` `0x6fd5a6a0`)**:
  Called in `D2Client` at `0x6fac898d` and `0x6fb57f37` whenever the player moves. Tests the player's sub-tile position
  `(subX, subY)` against each POPS box `[x*5, (x+w)*5 + pad) x [y*5, (y+h)*5 + pad)`. All POPS entries in the same
  preset map (`mapIndex`) sharing the active `pPopsIndex` toggle together (`0x6fd5a7a6..0x6fd5a8c4`).
- **Tile transition (`DRLGPRESET_TogglePopsVisibility` `0x6fd5a180`)**: Iterates all rooms intersecting the expanded tile
  box `[nPosX - 1, nPosX + nWidth] x [nPosY - 1, nPosY + nHeight]` (inclusive; `endX = (nPosX - 1) + (nWidth + 2)` with
  `jge`), and for each wall/roof tile in that room inside the expanded box:
  - **Cutaway walls (`dwFlags & 0x200`, `MAPTILE_UNK_0x200`)**:
    - Entering POPS box (`bVisible == 0`, `0x6fd5a23a..0x6fd5a246`): `unk0x24 &= ~4; dwFlags &= ~8` (shown immediately at `0xff`).
    - Leaving POPS box (`bVisible == 1`, `0x6fd5a225..0x6fd5a232`): `unk0x24 |= 4; unk0x2C = GetTickCount() + 500`, and
      in the wall pass (`0x6fb4ec5f` / `0x6fb4ef8a..0x6fb4efa7`) once `now >= unk0x2C`, sets `dwFlags |= 8` (`MAPTILE_HIDDEN`).
  - **Roofs & POPS-indexed walls (`!(dwFlags & 0x300) && style == popSubIndex`, `0x6fd5a24d..0x6fd5a263`)**:
    - Entering POPS box (`bVisible == 0`, `0x6fd5a2f5..0x6fd5a334`): ramps `0xff -> 0x00` over 500ms (`[tile+0x29] = 0xff`,
      `[tile+0x2a] = 0x00`, `[tile+0x24] |= 2`, `end = GetTickCount() + 500 + (alpha - 0xff) * 500 / 255`). Note: in
      `Logicals = 1` rooms, 100% of these POPS walls also have `dwFlags & 0x4` (`MAPTILE_TREES`), so `0x6fb2a340` skips
      them (`0x6fb2a3a7`) and never overwrites their `0x00` target with `0x80`.
    - Leaving POPS box (`bVisible == 1`, `0x6fd5a2b9..0x6fd5a2f3` & `0x6fd5a338`): clears `0x400` (`MAPTILE_OUTSIDE_ROOF`)
      and ramps `0x00 -> 0xff` over 500ms (`[tile+0x29] = 0x00`, `[tile+0x2a] = 0xff`, `[tile+0x24] |= 2`,
      `end = GetTickCount() + 500 - alpha * 500 / 255`).
- **Roof pass `0x400` clearing (`0x6fac3ac2..0x6fac3b36`)**: In `0x6fac3a00`, after advancing `[tile+0x28]` (`alpha`),
  `if (alpha == 0) dwFlags |= 0x400; else dwFlags &= ~0x400;`, and then `if (dwFlags & 0x408) skip`.

## 5. Notes on the #919 and #1009 screenshots

- Act 4 Outer Steppes "pillars" (#919): lower walls drawn after the floor (fixed by §1–2).
- Act 3 Kurast Docks, Lower/Bazaar/Upper Kurast, Causeway, Travincal, Act 1 cottages, and Act 2 Lut Gholein (#1009):
  Preset buildings with `Pops > 0` in `LvlPrest.txt` carry POPS marker boxes (`mainIndex 8..29`) that fade `type == 15`
  roofs and `style == popSubIndex` upper-story walls (`0xff <-> 0x00`) and reveal `0x200` cutaway walls (`0x00 <-> 0xff`)
  via `DRLGPRESET_UpdatePops` (`0x6fd5a6a0`) + `DRLGPRESET_TogglePopsVisibility` (`0x6fd5a180`) (fixed by §4).
- Act 5 Harrogath black diamonds next to the stairs: cells (8,17)/(8,18)/(9,18) carry `buildingses.dt1` floors #24/#25
  that DRLG pins exactly (oracle-verified tile choice); #25 has only 2 of 25 floor blocks and #24 11, nothing else is in
  those cells (no lower wall, no second floor layer). The holes are in the tile data, not a draw-order defect.
