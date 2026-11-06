# Diablo II 1.13c Light Records of Units and Their Stat Callbacks (`D2Client.dll`)

Companion to [`docs/lighting_grid_113c.md`](../../docs/lighting_grid_113c.md) (grid pipeline, issue #830). This note
records the per-unit light facts found while porting the light grid.

## 1. Positions and grid origin

- Light record position: `(precise >> 13) + 4` in x8 units (`0x6fb58c9a` at creation, `0x6fb59b9d` per update).
  Static units (objects, items, tiles) use `sub-tile * 8 + 4`.
- Grid origin: local player path sub-tile − 24 (`0x6fb59e8e`); the path sub-tile of a dynamic unit is the integer
  part of its precise position (D2Common #10867 / #10750).
- A cell is a sub-tile corner; `x8 >> 3` picks it.

## 2. Player light and stats 89 / 90

- Created at `0x6fac92f5`: radius 13 (`0x6fac92f3`), I 255, white; type 0 for the local player, type 1 for others.
- Stat callback `0x6fac8c20` dispatches on `stat >> 16` (tables `0x6fac8da8` / `0x6fac8d94`):
  - stat 89 `item_lightradius` → `0x6fac8bc0`: SetRadius(base + v), base 13 for players. SetRadius `0x6fb58b60`
    ignores ≤ 0, so a total ≤ 0 leaves the previous radius.
  - stat 90 `item_lightcolor` → `0x6fac89a0` → SetColor (`0x6fac89ed`): 0 → white, else R = v >> 16, G = v >> 8,
    B = v (bytes).
- Remote player parity (issue #879):
  - In 1.13c, other players in the room share identical light record callback handling.
  - In network play, remote players' active equipment (excluding inactive weapon swap slots 11 & 12) along with
    socketed gems and jewels are aggregated for stat 89 (`item_lightradius`) and stat 90 (`item_lightcolor`).
  - `reconcileLights` invokes `applyPlayerStats` uniformly across all player emitters (`unitType === 0 && slot === 'unit'`),
    ensuring other players' light radius and tint match 1.13c client behavior.

## 3. Monster lights

- Base light `0x6fafc24e`: type 0, radius max(#11077 component light, MonStats2 `Light` +0x11e), RGB +0x11f..+0x121;
  none when the radius is 0.
- MonUMod client handlers: table `0x6fbaa340`, dispatcher `0x6fad0f20`. When the first of the 9 mod bytes is
  non-zero, the fixed list {1, 2, 3, 4} (`0x6fb86d2c`) runs, then each mod byte's handler.
- Handler 3 `0x6fad0510` needs the unique type flag (0x08, its argument): it frees the light and creates radius 7
  (`push 0x7` at `0x6fad05a1` / `0x6fad05dd`). A champion (flag 0x04) takes B, G, R = RAND(unit seed, 256) in that
  order (`0x6fad05df`); others take MonStats2 RGB (`0x6fad05a8`). Champions always arrive with 0x04 | 0x08 (see
  [`monsters/d2client-champion-monster-name-113c.md`](../monsters/d2client-champion-monster-name-113c.md)).

## 4. Missile lights

- `0x6fb63647–0x6fb636a7`: only when Light Quality is High (`[0x6fb8d854]`), `!(params[0] & 0x4000)` and (Light or
  `params+0x50`): type 1, Missiles `Light` (+0x130) at full radius, RGB +0x132..+0x134.
- Flicker `0x6fb60df0` (from `0x6fb61b3d` when Flicker +0x131 ≠ 0 and `!(unit+0x44 & 0x300)`): once
  `r >> 3 >= Light`, target = Light + RAND(&unit->seed, Flicker).
- Missile end Kills the light (`0x6fb616c9` / `0x6fb6177b`): it fades 8 x8 units per build at its last position.
- The meteor-centre client hit spawns its light missile and calls SetRadius(12) right after (`0x6fb666f2–0x6fb66702`).

## 5. Overlays and `States.txt` / `states.bin` Mapping (issue #878)

- **Light record creation (`0x6fb1b49f–0x6fb1b4e0`)**: Only when `overlay.bin` `Radius` (`+0x74`) ≠ 0 — `CreateLight` type 1 with `InitRadius` (`+0x70`), I 255, RGB (`+0x7d..+0x7f`), then `SetTargetRadius(Radius)` when it differs.
- **`States.txt` / `states.bin` (60-byte records in `Patch_D2.mpq`, 185 states)**:
  - `wOverlay[0..3]` at offsets `+0x02..+0x08` (`uint16`, `0xFFFF` = none) store the 0-based `overlay.bin` row indices for `overlay1..overlay4` (`0x6fb1b360`).
  - `wPgsvOverlay` at offset `+0x0e` (`uint16`, `0xFFFF` = none) stores the base `overlay.bin` row index for progressive charge states (`pgsv = 1`, states `122..127`), which `setfunc = 1` (`0x6fb23410`) indexes as `wPgsvOverlay + chargeCount - 1` across 3 consecutive rows (`[baseIdx, baseIdx + 1, baseIdx + 2]`).
  - In particular, states `41` (`stamina`), `117` (`maul`), and `120` (`feralrage`) reference `overlay.bin` rows:
    - State `41` (`stamina`): `staminafront` (`101`, `Stamina_front.dcc`), `staminaback` (`102`, `Stamina_back.dcc`)
    - State `117` (`maul`): `maul1` (`260`, `expansion\Maul_A_Front.dcc`), `maul5` (`264`, `expansion\Maul_E_Front.dcc`), `maul1back` (`277`, `expansion\Maul_A_Back.dcc`), `maul5back` (`281`, `expansion\Maul_E_Back.dcc`)
    - State `120` (`feralrage`): `feralrage1` (`265`, `expansion\feral_rage_A_Front.dcc`), `feralrage5` (`269`, `expansion\feral_rage_E_Front.dcc`), `feralrage1back` (`282`, `expansion\feral_rage_A_Back.dcc`), `feralrage5back` (`286`, `expansion\feral_rage_E_Back.dcc`)
  - All 10 of those `overlay.bin` rows have `InitRadius = 0` and `Radius = 0` (emitting zero light), and all overlay drawing parameters (`frames`, `animRate`, `preDraw`, `trans`, `xOffset`, `yOffset`, `height[0..3]`) are sourced directly from `overlay.bin`.

## 6. Skill-cast light (0x6fb50f60, issue #876)

- Called from client skill initiation `0x6fb51cf0` @ `0x6fb521fd` when Skills record +0xe8 (`cltmissile`, verified in `D2Common.dll` field linker at `0x6fdb40d5` and `skills.bin` offset `+0xe8`) > 0.
- Reads `Missiles.txt` row by id (+0xe8). If out of bounds or `Light` (+0x130) == 0, returns without creating light.
- Creates light `0x6fb58c20(unit, type 1, radius 1, I 255, Red, Green, Blue)` taking RGB from `Missiles.txt` (+0x132..+0x134).
- Target radius set to `[light+0x1c] = min(Light, 18) << 3` (ramps from radius 1 by ±8 per build frame).
- Calls `D2Common.#10327(0x6fd9e300)(unit, light)` storing the light at `unit->pSkills(+0xa8)+0x14` and returning old light; if old light exists, immediately frees it via `0x6fb58630`.
- Release points: freed via `#10327(unit, 0)` and `Free(oldLight)` on skill DoFunc (`0x6fb52de0` @ `0x6fb52e34`), unit cleanup/free (`0x6fb56d60` @ `0x6fb56d78`), unit death / mode change (`0x6fb57d84`, `0x6fac918e`, `0x6facc3a7`).

## 7. Unit Seed (`unit+0x20`, Issue #874) & Open Items

- **Unit seed (`unit+0x20`, Issue #874):** VERIFIED in `D2Common.dll` (`UNITS_AllocUnit` `0x6fd85e10` → `SEED_InitSeed` `{ lo: 1, hi: 666 }`) and `D2Client.dll` (`0x6fb57400`, `0x6fb57630`, `0x6fb57780` → `SEED_InitLowSeed(&unit->seed, D2Common.#10485(pRoom1)[0])` from `pRoom1->pSeed` `[+0x6c, +0x70]`, `DRLGROOM_AllocRoom1` `0x6fd7e27c`).
- The owners of the lights at `0x6fb649ca` / `0x6fb78c49` remain UNVERIFIED.

