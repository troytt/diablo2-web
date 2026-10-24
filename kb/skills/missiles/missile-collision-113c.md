# Missile Collision: `CollideType` Table (`0x6FD2D928`), Enemy/Ally Filter (`0x6FC58FB0`), and `Size` Footprint Overlap (`0x6FDCF6A0`) (1.13c)

Sources: `samples/d2/D2Game.dll` (image base `0x6FC20000`), `samples/d2/D2Common.dll` (`0x6FD50000`),
`samples/d2/excel/Missiles.txt`. Implemented in `src/server/engine/missile-engine.ts` (Issue #1422).

## 1. `g_aMissileCollideTypes[9]` (`D2Game.dll` `0x6FD2D928`)

At missile creation (`MISSILE_CreateMissileFromParams`, `0x6FC8FD52..0x6FC8FD77`), the server reads `MissilesTxt.nCollideType`
(`+0x185`, byte `0..8`) and calls `D2Common.#10212` (`MISSILE_SetCollisionMask`, `0x6FD9DC50`) with the 32-bit mask from
`0x6FD2D92C + nCollideType * 8`:

| `CollideType` | `pfnUnitCallback` (`+0x00`) | `dwCollisionMask` (`+0x04`) | Meaning (`COLLIDE_*` flags) | `Missiles.txt` examples |
| :---: | :---: | :---: | --- | --- |
| `0` | `0x00000000` | `0x0000` | No unit or terrain collision (`COLLIDE_NONE`) | `blood1`, `meteorcenter`, `blizzardcenter`, `fistoftheheavensdelay` |
| `1` | `0x6FC5AD70` | `0x0084` | `COLLIDE_PLAYER (0x80) \| COLLIDE_MISSILE_BARRIER (0x04)` (also hits good-aligned mercs/minions via `0x6FC5AD70`) | `spidergoolay`, `arcanelightningbolt`, `desertfireball`, `pantherjav5` |
| `2` | `0x6FC5ADD0` | `0x0104` | `COLLIDE_MONSTER (0x100) \| COLLIDE_MISSILE_BARRIER (0x04)` | Monster-only collision mask |
| `3` | `0x6FC5AD30` | `0x0184` | `COLLIDE_MONSTER (0x100) \| COLLIDE_PLAYER (0x80) \| COLLIDE_MISSILE_BARRIER (0x04)` | Standard projectiles (`arrow`, `fireball`, `holybolt`, `bonespear`, 339 rows) |
| `4` | `0x00000000` | `0x0000` | Unused (`COLLIDE_NONE`) | — |
| `5` | `0x6FC5ADD0` | `0x0104` | `COLLIDE_MONSTER (0x100) \| COLLIDE_MISSILE_BARRIER (0x04)` | Same as `2` |
| `6` | `0x00000000` | `0x0004` | `COLLIDE_MISSILE_BARRIER (0x04)` terrain-only; `pfnUnitCallback == NULL`, never collides with units in flight | `oilpotion`..`stranglinggaspotion` (#44..#49), `catapult*`, `bomb in air`, `impfireball` (24 rows) |
| `7` | `0x6FC59510` | `0x0040` | `COLLIDE_MISSILE (0x40)` — collides with other missiles that have `CanDestroy` (`+0x04` bit `0x08`) | Destructible missile sweeper |
| `8` | `0x6FC5AD30` | `0x0185` | `COLLIDE_MONSTER (0x100) \| COLLIDE_PLAYER (0x80) \| COLLIDE_MISSILE_BARRIER (0x04) \| COLLIDE_WALL (0x01)` | Ground-hugging emitters/projectiles (`firewallmaker`, `moltenboulder`, `firestormmaker`, `wake of destruction maker`, 14 rows) |

If `MissilesTxt.dwFlags & 0x02` (`Collision = 1` column in `Missiles.txt`), `MISSILE_CreateMissileFromParams` (`0x6FC8FD79..0x6FC8FDA0`)
additionally sets `UNITFLAG_ISVALIDTARGET (0x80)` on the missile and registers `0x0040` (`COLLIDE_MISSILE`) in the room collision grid.
If `MissilesTxt.dwFlags & 0x01` (`LastCollide = 1`), `0x6FC8FDA3` initializes the missile's `LastCollide` reference (`D2Common.#10200`)
to `(pOwner->dwUnitType, pOwner->dwUnitId)` so the missile cannot collide with its own caster at spawn.

## 2. Movement Step & Terrain vs. Unit Dispatch (`MISSMODE_MoveMissile`, `0x6FC5F320`)

1. `D2Common.#10229` (`PATH_StepMissile`, `0x6FD80F80` -> `0x6FD5D420` -> `0x6FD5D580` / `0x6FD8E110`):
   - Halves the per-tick displacement `(dx, dy)` (`sar 1`) until both `|stepX| < 0x10000` (`1` subtile in 16.16 fixed point) and `|stepY| < 0x10000`.
   - Advances step-by-step across subtiles, testing `D2Common.#10134` (`COLLISION_CheckMaskWithSize`, `0x6FD9CE00`) with the missile's `dwCollisionMask` (`D2Common.#10211`) and `MissilesTxt.nSize`.
2. At `0x6FC5F3FB..0x6FC5F426`:
   - Reads `nCollideType` (`MissilesTxt + 0x185`). If `nCollideType <= 8` and `g_aMissileCollideTypes[nCollideType].pfnUnitCallback != NULL` (`0x6FD2D928 + nCollideType * 8`), invokes `pfnUnitCallback(pGame, pMissile, pRoom)`.
   - When `pfnUnitCallback == NULL` (`CollideType` `0`, `4`, `6`), unit collision is completely skipped; for `CollideType = 6`, any `PATH_StepMissile` collision return (`0x0004` terrain barrier) goes directly to `MISSMODE_SrvHitDispatch(pGame, pMissile, NULL)` (`0x6FC5EDE0` with `pTarget = NULL`).

## 3. Unit Target Filtering & Enemy/Ally Rules (`0x6FC5AD30..0x6FC5ADD0`, `0x6FC5AA20`, `0x6FC58FB0`, `0x6FC5EDE0`)

### 3.1 Unit Category Callbacks (`0x6FC5AD30`, `0x6FC5AD70`, `0x6FC5ADD0`)
Each unit callback calls `0x6FC5AA20(pGame, pMissile, pRoom, pfnFilter)`:
- `0x6FC5AD30` (`CollideType` `3`, `8`): filter `0x6FC5AC50` accepts `dwUnitType == 0` (player) or `dwUnitType == 1` (monster) with targetable/alive flags (`UNITFLAG_TARGETABLE 0x04`, not dead/corpse) and not matching `LastCollide`.
- `0x6FC5AD70` (`CollideType` `1`): filter `0x6FC5ACB0` accepts `dwUnitType == 0` (player) or `dwUnitType == 1` (monster) whose alignment (`D2Common.#10695`) is `UNIT_ALIGNMENT_GOOD (2)` (mercenaries/player summons).
- `0x6FC5ADD0` (`CollideType` `2`, `5`): filter `0x6FC5AC00` accepts `dwUnitType == 1` (monster) only.

### 3.2 Friendly/Enemy Pre-Filter (`0x6FC5AA87..0x6FC5AAAE` & `0x6FC5EEBD..0x6FC5EEEC`)
Before testing spatial overlap (`0x6FC5AAAE`) and again inside `MISSMODE_SrvHitDispatch` (`0x6FC5EDE0`):
1. Calls `0x6FC58FB0(pMissile, pTarget)`:
   - Resolves the missile's owner (`pOwner`).
   - If `pOwner` is a player or monster, calls `SUNIT_IsEnemy(pOwner, pTarget)` (`0x6FD00A60`).
   - Fallback when `pOwner` is missing: compares `D2Common.#10695(pMissile)` vs `D2Common.#10695(pTarget)`.
2. If `0x6FC58FB0(pMissile, pTarget) == 0` (the target is **not** an enemy of the missile's owner):
   - Checks `MissilesTxt.bCollideFriend` (`+0x187`).
   - If `bCollideFriend == 0`, the target is skipped (`return 0` / no collision).
   - Thus:
     - Monster missiles with `CollideFriend = 0` (e.g. `arrow`, `skbowarrow1..5`, `LightningBolt`, `BigHead1`) never collide with other hostile monsters.
     - Player missiles with `CollideFriend = 0` (e.g. `arrow`, `fireball`, `bonespear`) never collide with the caster, party members, mercenaries, or friendly summons.
     - Missiles with `CollideFriend = 1` (e.g. `holybolt` #55, `fistoftheheavensbolt` #234, `shout` #149, `battleorders` #237, `battlecommand` #236, `healingbolt` #357, `healing vortex` #425) pass the filter on allies and let their `pSrvHitFunc` decide the effect.

### 3.3 `MISSMODE_SrvHit07_HolyBolt` (`0x6FC5E220`, `pSrvHitFunc = 7`)
Used by `holybolt` (#55) and `fistoftheheavensbolt` (#234), both configured with `CollideType = 3`, `CollideFriend = 1`, `CollideKill = 1`, `Holy = 1` (or `3`):
1. If `pTarget == NULL` (terrain impact): returns `3` (destroy missile).
2. Calls `0x6FC58FB0(pMissile, pTarget)` (is enemy?):
   - **Enemy (`!= 0`)**: calls `D2Common.#11056` (`MONSTERS_IsUndead`, `0x6FD60950`). If not undead, returns `0` (passes straight through non-undead enemies without colliding or expiring). If undead, computes magic damage (`0x6FC58AC0` + `0x6FC58DF0`), applies `SUNITDMG`, and returns `3` (or `2` if pierced).
   - **Friendly (`== 0`)**: tests `MissilesTxt.nHoly & 1` (`+0x184`). For `holybolt` (`nHoly = 1`) and `fistoftheheavensbolt` (`nHoly = 3`), heals the friendly unit (`stat_hitpoints` capped at `stat_maxhp`) and returns `3` (destroy missile).

## 4. `Size` Subtile Footprint Overlap (`D2Common.#10389`, `0x6FDCF6A0`)

Candidate units in the missile's room/adjacent rooms are tested with `D2Common.#10389(pMissilePath, pTargetUnit)` (`0x6FDCF6A0`):
- Reads `mSize = PATH_GetStepNum(pMissilePath)` (`Missiles.txt` `Size` column, `1..3`) and `tSize = D2Common.#10336(pTargetUnit)` (unit subtile footprint `SizeX` in `1..3`; players have `SizeX = 2`, monsters use `MonStats2.SizeX` `1..3`).
- Computes subtile distance `dx = |mx - tx|`, `dy = |my - ty|`.
- Dispatches via the 9-case jump table at `0x6FDCF8E8` (`index = (mSize - 1) * 3 + (tSize - 1)`):
  - `(1, 1)` (case 0): `dx == 0 && dy == 0`
  - `(1, 2)` / `(2, 1)` (cases 1, 3): `dx + dy <= 1`
  - `(2, 2)` (case 4): `dx + dy <= 2`
  - `(1, 3)` / `(3, 1)` (cases 2, 6): `dx <= 1 && dy <= 1`
  - `(2, 3)` / `(3, 2)` (cases 5, 7): `(dx <= 2 && dy <= 1) || (dy <= 2 && dx <= 1)`
  - `(3, 3)` (case 8): `dx <= 2 && dy <= 2`
