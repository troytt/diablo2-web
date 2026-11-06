# Diablo II 1.13c Object Interaction Range & Hit-Testing (`D2Client.dll`, `D2Common.dll`, `D2Game.dll`)

## 1. Overview

In Diablo II v1.13c, clicking a world object (`UNIT_OBJECT = 2`) in `D2Client.dll` and validating `C2S 0x13 Interact` on the server in `D2Game.dll` both rely on the same shared range-check routine in `D2Common.dll` (`#10594`, `0x6fd81000`, `UNITS_IsObjectInInteractRange`). Unlike monster/player melee range (`UNITS_IsInMeleeRange`), object interaction range is computed from the object's `SizeX` and `SizeY` columns in `Objects.txt` (`D2ObjectsTxt+0x0d0`, `+0x0d4`).

Screen-space cursor hit-testing for `UNIT_OBJECT` in `D2Client.dll` (`0x6fb568e0`) branches on `D2ObjectsTxt+0x19d` (`CollisionSubst`) and `D2ObjectsTxt+0x13a` (`IsDoor` in open modes `2, 4, 5`) between a fixed table bounding box (`0x6fb55720` `HitTestFixedBox`) and sprite-frame bounds (`0x6fb56730` `GetUnitFrameBounds`).

---

## 2. `D2ObjectsTxt` Struct Layout (`D2Common.dll` `0x6fd8fc00..0x6fd90900`)

`DATATBLS_LoadObjectsTxt` (`0x6fd8fc00`) compiles `Objects.txt` into `0x1c0`-byte `D2ObjectsTxt` records with the following interaction and hit-test fields:

| Offset | Type | `Objects.txt` Column | Usage |
| :--- | :--- | :--- | :--- |
| `+0x0d0` | `int32` | `SizeX` | Subtile width used by `D2Common #10594` (`0x6fd81000`) |
| `+0x0d4` | `int32` | `SizeY` | Subtile height used by `D2Common #10594` (`0x6fd81000`) |
| `+0x13a` | `uint8` | `IsDoor` | Door flag checked by `D2Client HitTest` (`0x6fb56bd5`) |
| `+0x148` | `int32` | `Xoffset` | Sprite X offset added by `GetUnitFrameBounds` (`0x6fb56730`) |
| `+0x14c` | `int32` | `Yoffset` | Sprite Y offset added by `GetUnitFrameBounds` (`0x6fb56730`) |
| `+0x168` | `int32` | `NameOffset` | Overhead label Y offset |
| `+0x16e` | `uint8` | `OperateRange` | Legacy column (unused by `#10594`) |
| `+0x170..+0x177` | `uint8[8]` | `Selectable0..Selectable7` | Mode selectability mask (`0x6fb56b31`) |
| `+0x19d` | `uint8` | `CollisionSubst` | Fixed-hitbox selector checked by `D2Client HitTest` (`0x6fb56c0f`) |
| `+0x1a0` | `int32` | `Left` | Fixed hitbox left offset (`0x6fb55720`) |
| `+0x1a4` | `int32` | `Top` | Fixed hitbox top offset (`0x6fb55720`) |
| `+0x1a8` | `int32` | `Width` | Fixed hitbox width (`0x6fb55720`) |
| `+0x1ac` | `int32` | `Height` | Fixed hitbox height (`0x6fb55720`) |

> **Important:** When `CollisionSubst == 0` and the object is not an open door, `Left`, `Top`, `Width`, and `Height` are repurposed by specific object handlers (for example, `Well` rows `Id = 130, 132, 137, 138, 322` store `(750, 128, 1, 3)` refill parameters). `HitTestFixedBox` must **only** be used when `CollisionSubst != 0` or (`IsDoor != 0` and `dwAnimMode in {2, 4, 5}`).

---

## 3. Object Interaction Range (`D2Common.dll` `#10594` @ `0x6fd81000`)

### Call Sites
- **Client (`D2Client.dll` `0x6facab50` -> `0x6facab9a`)**: When left-clicking `UNIT_OBJECT`, calls `D2Common_10594_IsObjectInInteractRange(pPlayer, pObject)`.
  - If nonzero, immediately sends `C2S 0x13 Interact` (`0x6fac3e50`).
  - If zero, sends `C2S 0x02/0x04 MoveToUnit` and polls `D2Common #10594` each tick until in range.
- **Server (`D2Game.dll` `0x6fcf0200` `SUNIT_InteractWithObject` at `0x6fcf0251` & `0x6fc8a720` `OBJECTS_OperateObject` at `0x6fc8a765`)**: Calls `D2Common #10594` before operating the object (e.g. `OperateFn = 22` `OBJMODE_OperateInifussTree` for `Id = 30`).

### Exact Disassembly Logic (`0x6fd81000..0x6fd811a0`)
Given actor subtile `(unitX, unitY)` with `unitSizeX = D2Common_GetUnitSizeX(pUnit)` (`2` for players) and object subtile `(objX, objY)` with `objSizeX = pObjectTxt->dwSizeX`, `objSizeY = pObjectTxt->dwSizeY`:

1. **Zero-distance fast path (`0x6fd8101c`)**:
   - If `D2Common_10407_GetUnitDistance(pUnit, pObject) == 0` (`unitX == objX && unitY == objY`), return `1`.
2. **Object footprint origin (`0x6fd8107e..0x6fd810af`)**:
   - `minX = objX - trunc(objSizeX / 2)` (`cdq; sub eax, edx; sar eax, 1; sub edi, eax`)
   - `minY = objY - trunc(objSizeY / 2)`
3. **Zero-extent objects (`objSizeX < 1 || objSizeY < 1`, `0x6fd810af..0x6fd810ee`)**:
   - Return `unitX >= minX - 1 && unitX <= minX + 1 && unitY >= minY - 1 && unitY <= minY + 1`.
4. **Standard/large objects (`objSizeX >= 1 && objSizeY >= 1`, `0x6fd810f3..0x6fd81174`)**:
   - Outer `[-2, +Size + 2]` bounding check:
     - If `unitX < minX - 2 || unitX > minX + objSizeX + 2`, return `0`.
     - If `unitY < minY - 2 || unitY > minY + objSizeY + 2`, return `0`.
   - If `unitSizeX > 2`, return `1`.
   - For `unitSizeX <= 2` (including `Player` where `unitSizeX == 2`), exclude the 4 extreme corners `(minX - 2, minY - 2)`, `(minX + objSizeX + 2, minY - 2)`, `(minX - 2, minY + objSizeY + 2)`, `(minX + objSizeX + 2, minY + objSizeY + 2)`:
     - If `unitY < minY - 1` (`unitY == minY - 2`): return `unitX >= minX - 1 && unitX <= minX + objSizeX + 1`.
     - If `unitY <= minY + objSizeY + 1`: return `1`.
     - Else (`unitY == minY + objSizeY + 2`): return `unitX >= minX - 1 && unitX <= minX + objSizeX + 1`.

### Why `Id = 30` (Tree of Inifuss) Requires `#10594`
- In `Objects.txt`, `Id = 30` (`Inifuss`, token `IT`) has `SizeX = 5, SizeY = 5, HasCollision0 = 1`.
- Its `5x5` collision footprint `[objX - 2 .. objX + 2, objY - 2 .. objY + 2]` prevents a `SizeX = 2` player from stepping closer than `dist = 3.0` subtiles (`|dx| = 3` or `|dy| = 3`, diagonal `4.24`).
- Under `#10594`, `minX = objX - 2`, `minY = objY - 2`, so the valid interaction box is `[objX - 4, objX + 5] x [objY - 4, objY + 5]` (minus the 4 extreme corners), which accepts every walkable subtile immediately outside the `5x5` collision boundary.

---

## 4. Object Screen-Space Hit-Testing (`D2Client.dll` `0x6fb568e0`)

In `D2Client.dll` `HitTest` (`0x6fb568e0` at `0x6fb56b15..0x6fb56d43`):
1. Looks up `pObjectTxt = D2Common_10497_GetObjectTxt(dwTxtFileNo)` and checks `pObjectTxt->nSelectable[dwAnimMode] != 0` (`0x6fb56b31`).
2. **Open Door branch (`0x6fb56bd5..0x6fb56c0c`)**:
   - If `pObjectTxt->bIsDoor != 0` (`+0x13a`) and `dwAnimMode in {2, 4, 5}`, calls `0x6fb55720` (`HitTestFixedBox`).
3. **`CollisionSubst` branch (`0x6fb56c0f..0x6fb56c34`)**:
   - If `pObjectTxt->bCollisionSubst != 0` (`+0x19d`), calls `0x6fb55720` (`HitTestFixedBox`).
   - `HitTestFixedBox` (`0x6fb55720`) projects `(unitX, unitY)` via `D2Common_11087_CoordToIso` (`0x6fd9db70`) and checks:
     - `cursorX in [isoX + Left, isoX + Left + Width]`
     - `cursorY in [isoY + Top, isoY + Top + Height]`
   - In 1.13c `Objects.txt`, the 12 `CollisionSubst = 1` objects are:
     - `Id = 30` (`Inifuss`): `(-40, -40, 80, 80)`
     - `Id = 59, 60` (`Portal`): `(-40, -100, 80, 110)`
     - `Id = 174` (`loose rock`): `(-18, -20, 36, 30)`
     - `Id = 192, 304, 305, 306` (`teleport pad`): `(-30, -80, 60, 80)`
     - `Id = 289` (`bed`): `(-50, 0, 100, 80)`
     - `Id = 298` (`portal`): `(-30, -80, 60, 80)`
     - `Id = 342` (`portal`): `(-40, -80, 80, 80)`
     - `Id = 547` (`To The Worldstone Keep Level 1`): `(-30, -100, 70, 100)`
4. **Sprite-frame bounds branch (`0x6fb56c37..0x6fb56d43`)**:
   - When `CollisionSubst == 0` (and not an open door), calls `0x6fb56730` (`GetUnitFrameBounds`), which takes the active DCC/DC6 frame `(anchorX, anchorY, frameWidth, frameHeight)` and `pObjectTxt->dwXoffset, dwYoffset`:
     - `left = anchorX + xOffset - 12`, `width = frameWidth + 24` (if `width < 32`, expands symmetrically around center to `32`)
     - `top = anchorY + yOffset - 12`, `height = frameHeight + 24` (if `height < 32`, expands symmetrically around center to `32`)

---

## 5. Server Interaction Line-of-Sight (`D2Game.dll` `0x6fcf01d0` & `D2Common.dll` `#10324` @ `0x6fd819c0`)

When `D2Game.dll` processes `SUNIT_Interact` (`0x6fcf01d0`), range checks are paired with `D2Common_10324_CheckUnitCollisionRay` (`0x6fd819c0`, imported via `0x6fc2ab1a`) using collision mask **`0x0804`** (`COLLIDE_DOOR | COLLIDE_MISSILE_BARRIER`), **not** walk collision (`0x0001` `COLLIDE_WALL`):

- **`UNIT_OBJECT = 2` (`0x6fcf024f..0x6fcf0268`)**:
  1. Calls `D2Common_10594_IsObjectInInteractRange(pPlayer, pObject)` (`0x6fcf0251`). If `0`, queues pending approach via `0x6fcee120` (`0x6fcf0298`).
  2. Pushes `0x0804` (`0x6fcf025a: push 0x804`) and calls `D2Common_10324_CheckUnitCollisionRay(pPlayer, pObject, 0x0804)` (`0x6fcf0261`). If nonzero, queues pending approach (`0x6fcf0268`).
  3. Otherwise stops the player path (`0x6fcf026e`) and invokes `OBJECTS_OperateObject` (`0x6fc8a720` at `0x6fcf0280`).
- **`UNIT_ITEM = 4` (`0x6fcf035b..0x6fcf036e`)**:
  - Checks `D2Common_10407_GetUnitDistance <= 4`, then calls `D2Common_10324_CheckUnitCollisionRay(pPlayer, pItem, 0x0804)` (`0x6fcf0360: push 0x804`).
- **Inside `D2Common #10324` (`0x6fd819c0..0x6fd81b34`)**:
  1. Resolves subtile coordinates for both endpoints (`0x6fd819f2..0x6fd81a97`).
  2. Queries `UNITS_GetCollisionMask` (`0x6fd7ff30`) for `pUnit1` (`0x6fd81aa0`) and `pUnit2` (`0x6fd81abb`); whenever `(nCollisionMask & unitMask) != 0`, temporarily unstamps that unit's footprint from the room collision grid via `0x6fd85800` (`0x6fd81ab0`, `0x6fd81acb`).
  3. Traces `COLLISION_CheckRay(pRoom1, x1, y1, x2, y2, 0x0804)` (`0x6fd80730` at `0x6fd81afd`).
  4. Re-stamps `pUnit1` and `pUnit2` via `0x6fd859d0` (`0x6fd81b0a`, `0x6fd81b1c`) before returning the ray result.
- **Practical Implications**:
  - Walk-only solid footprints (`0x0001` `COLLIDE_WALL` without `0x0004`, such as `Tree of Inifuss` `Id = 30`'s `5x5` trunk in `Inifuss.ds1`, water pools, and low obstacles) do **not** block `0x0804` interaction line-of-sight from standable perimeter subtiles (`|dx| = 4` or `|dy| = 4` around a `5x5` blocked square).
  - Intervening dungeon walls (`0x0004` `COLLIDE_MISSILE_BARRIER`) and closed doors (`0x0800` `COLLIDE_DOOR`, other than the target door itself unstamped by `#10324`) continue to block interaction.
