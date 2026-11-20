# Diablo II v1.13c light grid (`dLightMap.cpp`) — port reference (issue #830)

> Ground truth: `D2Client.dll` 1.13c (ImageBase `0x6fab0000`). The source-file string at `0x6fb84104` is
> `dLightMap.cpp`; the light code spans `0x6fb58210–0x6fb59ef7`. This document supersedes
> [`lighting_reverse_engineering_113c.md`](./lighting_reverse_engineering_113c.md) (its errors are listed in §9).
> Tags: **UNVERIFIED** = not proven from the binary; **INFERRED** = deduced, not traced.

## 1. Grid and coordinates

- One 48×48 grid at `0x6fbb5208`, 8 bytes per cell: `+0` dword obstacle flag (0/1), `+4` I, `+5` R, `+6` G, `+7` B.
- **A cell is one sub-tile corner.** Cell (gx, gy) is the corner of sub-tile `(oX + gx, oY + gy)`. Light positions are
  in x8 units (1/8 sub-tile): `x8 >> 3` is the sub-tile, `+8` is one sub-tile.
- Origin `oX/oY` (`0x6fbb4df0/4`) = local player path sub-tile − 24 (`0x6fb59e8e`); cull bounds `oX+48` / `oY+48`.
- A dynamic unit's light sits at `(precise >> 13) + 4` (`0x6fb59b9d`); a static unit's at `sub * 8 + 4`.
- **Port convention.** Port sub-tile N.0 is the centre of sub-tile N = D2 precise N + 0.5. Hence dynamic light
  `x8 = floor((x + 0.5) * 8) + 4` (`lightPos8(x + 0.5)`) and grid origin `floor(x + 0.5) − 24`.

## 2. Build pipeline

| Step | VA | Behaviour |
|---|---|---|
| Trigger | `0x6fb3b1ac` | Rebuild only when the client game frame (`0x6fbc97f8`, 25 Hz) is newer than the last build (`0x6fbcbef8`) |
| Prefill | `0x6fb59c90` | Whole grid = player room ambient (`0x6fb59a20`), then each near room (list order, player room skipped) fills its inclusive rect; skip test uses 48 (not 47); start clamped at 0, end at 47. No player/room → all zero |
| Obstacles | `0x6fb58880` | flag = `#10482(room, x, y, 0x22) != 0`; a missing room/collision returns 0x27 → blocked. Mask 0x22 = VISIBLE \| BLANK (no WALL, no DOOR) |
| Mode | `0x6fb58800` | Light Quality 0 → mode 0; else FPS ≤ 9 → 0, ≤ 12 → 1, ≤ 15 → the last mode if ≥ 1 (else 1), above → 2; a change needs > 2000 ms since the last one |
| FPS | `0x6fbc9808` | Rendered frames over a > 3000 ms window ÷ 3, starts at / resets to 25 (`0x6faf23a0–0x6faf23cc`) |
| Update | `0x6fb59b50` | Every record, newest first: follow the owner (not found → keep position), ramp r ±8 toward target (type 2 drops its cache), r ≥ 256 → 248, dying and r ≤ 0 → Free |
| Apply | `0x6fb59480` / `0x6fb58f60` / `0x6fb59860` | type 0 in mode 2: shadowed; type 2: cached occlusion (any mode); else unshadowed (mode 0: other player r ≤ 16, monster r = 8, missile skipped) |
| Falloff | `0x6fb598bb–0x6fb5990d` | window `(l.x & ~7) − r`, `diam = 2r >> 3`; `slope = (I << 16) / r`; `d = (983·max + 407·min) >> 10`; `v = ((r − d)·slope) >> 16` |
| Shadow | `0x6fb58310`, `0x6fb58470` | B = obstacle ×16; ring walk k = 2..rs with 8 propagations per (k, j); shaded `v = (v·(8 − (s >> 1))) >> 3`, skipped when s ≥ 16 |
| AddToCell | `0x6fb58a40` | `In = min(I + v, 255)`; `C = min(((C·I + Cl·v)·recip[In]) >> 16, 255)` with `recip[i] = 65536 // i`; always coloured (`0x6fb8e830` is statically 1) |
| GetLightAt | `0x6fb58230` | nearest cell, clamped to 0..47 — no interpolation |

The type-2 cache (`0x6fb59100`) reads collision words directly over a 64×64 window at (unit − 32), not the grid flags.

## 3. Light records and API

0x34-byte record (`0x6fb58c56`): owner type/id, type 0/1/2, x8/y8, r and target (x8 units), dying, I/R/G/B, next,
cache valid/buffer. The port (`src/common/drlg/light-grid.ts`, class `LightList`):

| 1.13c | VA | Port |
|---|---|---|
| CreateLight | `0x6fb58c20` | `create(owner, type, radius, I, R, G, B, x8, y8)`: radius ≤ 0 → null; clamp 18; inserted at the head |
| SetRadius | `0x6fb58b60` | `setRadius(l, radius)`: ≤ 0 → no change; immediate; type 2 drops its cache |
| SetTargetRadius | `0x6fb58be0` | `setTargetRadius(l, radius)`: ≤ 0 ignored; ramps ±8 per build |
| SetColor / GetRadius | `0x6fb586c0` / `0x6fb58710` | `setColor` / `getRadius` |
| Kill | `0x6fb585f0` | `kill(l)`: dying, target 0, fades at its last position (missile end only, `0x6fb616c9` / `0x6fb6177b`) |
| Free | `0x6fb58630` | `free(l)`: immediate unlink |
| LIGHTMAP_Build loop | `0x6fb59ec3` | `build(grid, mode, env)` |
| Type-2 cache | `0x6fb59100` / `0x6fb58f60` | `buildLightType2Cache`, `applyLightCached`; port hook `invalidateOcclusionCaches()` |

## 4. Light sources (SPEC §6) and their port

| Source | Site | Port |
|---|---|---|
| Local player | `0x6fac92f5` | type 0, r 13 (`lighting-presets.ts`); stat 89 `0x6fac8bc0`: 13 + v, ≤ 0 → unchanged; stat 90 `0x6fac89a0`: 0 → white, else 0xRRGGBB |
| Other player | `0x6fac92f5` | type 1, r 13, white (`unit-drawables.ts`); their stat 89/90 are not modelled |
| Monster | `0x6fafc24e` | type 0, MonStats2 `Light` + RGB (`light-sources-113c.ts`, GENERATED); the #11077 component-light term is not modelled |
| MonUMod 3 | handler table `0x6fbaa340`, entry 3 `0x6fad0510` | radius 7 when mod[0] ≠ 0 and the unique flag (0x08) is set; champions (0x04, always sent with 0x08) take B, G, R = RAND(seed, 256) per run, runs = 1 + count(mod 3) |
| Missile | `0x6fb63647–0x6fb636a7` | type 1, Missiles `Light` at full radius, RGB, `Flicker` (`0x6fb60df0`: once r >> 3 ≥ Light, target = Light + RAND(seed, Flicker)); Light Quality 2 only; Kill on removal |
| Meteor centre | SetRadius(12) at `0x6fb666f2–0x6fb66702` | `missileLightRadius = 12` on the whitelightmissile it spawns |
| Overlay | `0x6fb1b49f–0x6fb1b4e0` | type 1, overlay.bin `InitRadius` → `SetTargetRadius(Radius)`, RGB |
| Object (#827) | `0x6fad496a` | type 2 at sub·8+4; a new `ClientUnit.objectLight` identity = Free + Create (list head); the #827 eased radius is mirrored with SetRadius |
| Skill-cast light (#876) | `0x6fb50f60` | type 1, radius 1 → min(Light, 18), RGB from Missiles.txt via Skills.txt cltmissile (+0xe8); stored at unit->pSkills+0x14 (#10327), single light per unit, freed on new cast, cast end, or death |
| `0x6fb649ca`, `0x6fb78c49` | — | not ported (SPEC §11 Q11) |

The unit seed of the RAND calls is a port stand-in `{ lo: unitId, hi: 666 }` (UNVERIFIED, SPEC §11 Q8).

## 5. Consumers

- **Floor (3D renderers, `0x6fac35e0` / `0x6fac37a0`).** Vertex colour `T[I][C] = floor(I·C/255)` per sub-tile corner,
  modulated with the texel. Port: RGBA8 48×48 texture (`exportTextureBuffer`, RGB = T[I][C], A = I), texel centre =
  corner (`v_lightUv = (sub − origin + 0.5) / 48`), LINEAR + CLAMP_TO_EDGE (Gouraud approximation, SPEC §11 Q2), no
  separate ambient term (the ambient is in the grid).
- **Units (`0x6fb4f120` / `0x6fb4f2b0`, issue #877).** One flat light per sprite: `unitFlatLight` (`lighting-presets.ts`) →
  `SpriteRenderer.setUnitLight`, tint × T[I][C]/255, prelit bit 32 (`UNIT_LIGHT_PRELIT`); additive sprites are unlit.
  `entry+0x4` (`entry.x`) and `entry+0x8` (`entry.y`) are verified as **x8 units (`subtile << 3`)** (`unitDrawEntryPos8`),
  so `(entry.x >> 3) − oX` and `(entry.y >> 3) − oY` (clamped to `0..47`) read the cell of the unit's integer path
  sub-tile (`pStaticPath->dwPosX/Y` for static units, `D2Common.#10867/#10750` `wPosX/wPosY` for dynamic units).
- **Walls (`0x6fb4e940`, `0x6fb4e970`, `0x6fb4ec10`, `0x6fb4ee90`, issue #877).** Indexed by `pTileGfx->nLightDirection`
  (`[[tile+0x18] + 0x0]`, `0..9` — NOT `tile.nTileType` at `[tile+0x1c]`). Sample count `N = dword[0x6fb80a70 + dir*4]`
  is `[0, 6, 6, 6, 6, 0, 6, 6, 6, 6]`. Each wall tile draw entry has `(entry.x, entry.y) = (cellX * 40, cellY * 40)`
  in x8 units (`tileDrawEntryPos8`), and samples `N = 6` points `(entry.x + dx_i, entry.y + dy_i)` from the 10-entry
  default table `0x6fb8ed18` (`0x6fb8ed18..0x6fb8eef8`) or the 10-entry faded table `0x6fb8eef8`
  (`0x6fb8eef8..0x6fb8f0d8`, selected when `([tile+0x24] & 1) != 0`, the player-occlusion fade flag set by `0x6fb29f20`).
  In `D2gfx.#10001` (vtable `+0x9c`) and `D2gfx.#10058` (vtable `+0xa0`), each 32px DT1 block column `col = block.posX >> 5`
  (`0..4`) uses `lightDwords[col]` on its left edge and `lightDwords[col + 1]` on its right edge (`wallColumnTints113c` →
  `DrawOptions.columnTints`).
- **Roofs (`0x6fac3a00` → `D2gfx.#10023` vtable `+0xa4`, issue #877).** Roof tiles (`nTileType == 15`, `nLightDirection == 5`)
  are routed by `0x6fb2a72e` to `0x6fb29d30` (`cell+0x1c`), NEVER to `0x6fb2a340` (`0x6fb4ebf0` and `0x6fb4f1e0` are
  `ASSERT(tile->nTileType != 15)` at line 249). `0x6fac3a00` subtracts `pTileGfx->wRoofHeight` from the screen Y and
  samples the `6×6` vertex light grid at `(tileSubX + ix) << 3, (tileSubY + iy) << 3` on the ground cell (`DrawOptions.roofHeight`).
- **Software renderers (`0x6fac38c0`, I >> 3 PL2 rows, RGB ignored).** Not ported.

## 6. Port mapping

| File | Role |
|---|---|
| `src/common/drlg/light-grid.ts` | Grid, records, shadows, modes, FPS counter, RAND, `tileDrawEntryPos8`, `unitDrawEntryPos8`, `WALL_LIGHT_SAMPLE_COUNTS_113C`, `WALL_LIGHT_OFFSETS_DEFAULT_113C`, `WALL_LIGHT_OFFSETS_FADED_113C`, `wallLightSamplePoints113c`, `LightGrid.sampleWallLights` |
| `src/common/units/light-sources-113c.ts` | GENERATED by `src/baker/extract/gen-light-sources.ts` (`npm run extract:light-sources`) |
| `src/client/scene/lighting-presets.ts` | `applyLightingInputs` (one build per game frame), light lifecycle, `unitFlatLight`, `wallColumnTints113c`, `getLightingPassState` |
| `src/client/view/unit-drawables.ts` | `BuildSceneDrawablesResult.lightEmitters` (all non-local lights; `pointLights` stays #827's snapshot) |
| `src/client/render/renderer.ts`, `src/client/scene/world-renderer.ts` | Lightmap texture, flat unit light (`setUnitLight`), 5-column wall Gouraud strips (`columnTints`), and roof UV ground-projection (`roofHeight`) |
| `src/client/settings/client-settings.ts` | `lightQuality` 0/1/2, default 2 (store only, no menu; registry default UNVERIFIED, Q7) |

## 7. Deviations and open items

- Origin `floor(x + 0.5)` instead of SPEC §8.2's `floor(x)` (port convention, §1).
- The local player's light is created once `playerUnitId` is known. Corpses keep their monster light (whether 1.13c
  frees it at death is UNVERIFIED).
- Port coordinates are level-local: dying records are dropped on a level change, and all type-2 caches are rebuilt
  when the level or its collision array changes (the 1.13c callback `0x6fb58d70` triggers are UNVERIFIED, Q10).
  Corners outside the level's collision data count as blocked.
- Missile `params[0] & 0x4000`, `params+0x50` and the `unit+0x44 & 0x300` flicker gate are not modelled; the
  meteor-centre grow (`0x6fb6905b`) is not ported.
- Level 8 monster radius 3 (`[0x6fbc5591]`, Q5) is not modelled.
- Two FPS counters exist: the light one (`0x6fbc9808`, 3000 ms window) and the lightning-flash one
  (`0x6fb0a9a0`, `fps-counter-113c.ts`).

## 8. Tests

`tests/light-grid-113c.test.ts` (goldens V1–V8 of `golden_830.json` + wall 6-point offset tables and sample points),
`tests/scene-lighting.test.ts`, `tests/client/light-grid-consumers-830.test.ts` (emitters, reconcile, `unitFlatLight`,
`wallColumnTints113c`, 5-column wall quads, skill-cast light `#876`), `tests/light-grid-136-spectrum.test.ts` (all 136 level ambients,
synthetic collision) and the headless audit `tools/verify-environment-browser.ts` (Gates 3–7).

## 9. Corrections to `lighting_reverse_engineering_113c.md`

| Old claim | Correction |
|---|---|
| `dLightMap.c` | `dLightMap.cpp` (`0x6fb84104`) |
| Light debug `0x6faef000–0x6faefee0`, floor rasterizer `0x6fb10000–0x6fb10500` | UNVERIFIED; floor consumers are `0x6fac35e0`, `0x6fac37a0`, `0x6fac38c0`; light code `0x6fb58210–0x6fb59ef7` |
| A cell steps by 8 sub-tiles | `>> 3` converts x8 to sub-tiles; one cell = one sub-tile corner |
| `uint8 nFlags; pad[3]` | Dword obstacle flag 0/1 (`0x6fb58880`, `0x6fb58560`) |
| Obstacle factor ≥ 16 blocks | It is the propagated shade s: skip if s ≥ 16, else × (8 − (s >> 1)) >> 3 |
| Blend division | `recip[In] = 65536 // In`, `>> 16`; always applied (white on black → 254) |
| Bilinear interpolation at `0x6fb58373` | That is shadow propagation (`0x6fb58310`); sampling is nearest-cell clamp |
| Player radius 10–13 | 13 (`0x6fac92f3`) + stat 89, ≤ 0 → unchanged, clamp 18 |
| Monster default radius 8 (`0x6fb59894`) | That is the mode-0 override; monster radius = max(component light, MonStats2 Light) |
| Flicker ±1 every frame | Missiles only: target = Light + RAND(seed, Flicker) through the ±8 ramp |
| 2D fallback R = G = B = I | Moot: `0x6fb8e830` is statically 1; software renderers use I >> 3 PL2 rows |

## 10. Verified Draw-Entry Units & Wall/Roof Lighting (SPEC §11 Q1, Q6, Q11 — Issue #877)

- **Q1 (Draw-Entry Coordinate Units `entry+0x4`, `entry+0x8`):** VERIFIED in `D2Client.dll` (`0x6fb29c80`..`0x6fb2a5d0`).
  Every 20-byte (`0x14`) draw entry stores `(entry.x, entry.y)` at `+0x04/+0x08` in **x8 units (`subtile << 3`)**:
  - **Tiles** (`0x6fb29c80` floor, `0x6fb29d30` roof, `0x6fb29e20` lower wall, `0x6fb2a340` upper wall):
    `entry.x = (roomSubX + tile.nPosX * 5) << 3 = cellX * 40`, `entry.y = (roomSubY + tile.nPosY * 5) << 3 = cellY * 40`.
  - **Units** (`0x6fb2a180`, `0x6fb2a260`, `0x6fb2a500`): static units (`dwUnitType` 2, 4, 5) store
    `(pStaticPath->dwPosX << 3, pStaticPath->dwPosY << 3)`; dynamic units (`dwUnitType` 0, 1, 3) call
    `D2Common.#10867` (`0x6fd84bb0`: `wPosX`) and `D2Common.#10750` (`0x6fd84b80`: `wPosY`) and store `(wPosX << 3, wPosY << 3)`.
- **Q6 (Roof Branch `0x6fb4ebf0` / `0x6fb4f1e0` and Roof Lighting `0x6fac3a00`):** VERIFIED. `0x6fb4ebf0` and `0x6fb4f1e0`
  are `ASSERT(tile->nTileType != 15)` (`Fog.#10023` + `exit(-1)` at line 249). Roofs (`nTileType == 15`) are routed by
  `0x6fb2a72e` to `0x6fb29d30` (`cell+0x1c`) and drawn by `0x6fac3a00`, which subtracts `pTileGfx->wRoofHeight`, builds a
  `6×6` vertex light grid on the ground cell `(tileSubX + ix) << 3, (tileSubY + iy) << 3` via `0x6fac37a0` / `0x6fac35e0`,
  and calls `D2gfx.#10023` (vtable `+0xa4`).
- **Q11 (Render Backend Consumption of Wall `lightDwords[0..5]`):** VERIFIED in `D2Direct3D.dll` (`0x6f88e643–0x6f88e793`),
  `D2Glide.dll` (`0x6f85690c–0x6f856a45`), `D2Gdi.dll` (`0x6f875f0c`, `0x6f87602c`), and `D2DDraw.dll` (`0x6f8c73dc`,
  `0x6f8c74fc`). For each 32×32 DT1 wall block at `block.posX ∈ {0, 32, 64, 96, 128}`, `col = block.posX >> 5` (`0..4`)
  selects `lightDwords[col]` for the left vertices (`posX`) and `lightDwords[col + 1]` for the right vertices (`posX + 32`),
  Gouraud-interpolated horizontally across each 32px column and flat vertically.

