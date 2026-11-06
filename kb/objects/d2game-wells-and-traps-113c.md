# D2Game 1.13c Water Wells (`InitFn 16` / `OperateFn 22`) and Object Traps (`OperateFn 30` / `OperateFn 7` / `0x6fd142d0`)

Ground truth: `samples/d2/D2Game.dll` (1.13c, image base `0x6FC20000`), `samples/d2/D2Common.dll` (1.13c, image base `0x6FD50000`), `samples/d2/excel/Objects.txt`, `samples/d2/excel/States.txt`.

---

## 1. Water Wells (`InitFn 16`, `OperateFn 22`, `Object Event 2`)

### 1.1 `Objects.txt` Rows with `OperateFn = 22`

All 14 water wells in `Objects.txt` share identical `InitFn`, `OperateFn`, and `Parm0..Parm3` columns:

| `Id` | `Name` | `InitFn` | `OperateFn` | `Parm0` (`regenFrames`) | `Parm1` (`healNumerator256`) | `Parm2` (`chargesPerStage`) | `Parm3` (`healMask`) |
| ---: | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| 111 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 113 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 115 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 118 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 130 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 132 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 137 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 138 | Cave Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 322 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 426 | Desert Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 493 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 498 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 513 | Well | 16 | 22 | 750 | 128 | 1 | 3 |
| 519 | Glacial Caves Well | 16 | 22 | 750 | 128 | 1 | 3 |

### 1.2 `OBJECTS_InitFn16_Well` (`0x6fc4e760`)

```text
6fc4e760: mov eax, [ecx+0x4]        ; pObject
6fc4e763: mov edx, [ecx+0x8]        ; pObjectsTxt
6fc4e766: mov eax, [eax+0x14]       ; pObjectData
6fc4e769: mov cl, [edx+0x60]        ; pObjectsTxt->dwParm[2] (1)
6fc4e76c: add cl, cl                ; Parm2 << 1 = 2 charges
6fc4e76e: mov [eax+0x4], cl         ; pObjectData->bInteractType = 2
```

- Initializes `pObjectData->bInteractType = Parm2 << 1 = 2` (2 charges when full in `OBJMODE_NEUTRAL (0)`).

### 1.3 `OBJECTS_OperateFn22_Well` (`0x6fc8cee0`) & `OBJECTS_UseWell` (`0x6fc8a560`)

At `0x6fc8cee0..0x6fc8cfa8`:
1. Reads `pObjectData->bInteractType` (`bl`, current remaining charges). If `bl == 0`, returns `0` immediately (`0x6fc8cef9`).
2. Calls `0x6fc8a560(pPlayer, pObjectsTxt)` (`OBJECTS_UseWell`):
   - Sets `bUsed = 0`.
   - **Life (`STAT_HITPOINTS = 6` vs `STAT_MAXHP = 7`)**:
     - If `hp < maxhp` and `(Parm3 & 2) != 0` (`test byte ptr [ebp+0x64], 0x2` at `0x6fc8a597`):
       - `deltaHp = (maxhp * Parm1) >> 8` (`(maxhp * 128) >> 8 = 50%` of `maxhp`).
       - `newHp = min(maxhp, hp + deltaHp)`.
       - `D2Common.#10517(pPlayer, 6, newHp, 0)` and sets `bUsed = 1`.
   - **Mana (`STAT_MANA = 8` vs `STAT_MAXMANA = 9`)**:
     - If `mana < maxmana` and `(Parm3 & 1) != 0` (`test byte ptr [ebp+0x64], 0x1` at `0x6fc8a5d8`):
       - `deltaMana = (maxmana * Parm1) >> 8` (`(maxmana * 128) >> 8 = 50%` of `maxmana`).
       - `newMana = min(maxmana, mana + deltaMana)`.
       - `D2Common.#10517(pPlayer, 8, newMana, 0)` and sets `bUsed = 1`.
   - **Stamina (`STAT_STAMINA = 10` vs `STAT_MAXSTAMINA = 11`)**:
     - If `stamina < maxstamina` (unconditional on `Parm3`, `0x6fc8a615..0x6fc8a642`):
       - `deltaStamina = (maxstamina * Parm1) >> 8` (`(maxstamina * 128) >> 8 = 50%` of `maxstamina`).
       - `newStamina = min(maxstamina, stamina + deltaStamina)`.
       - `D2Common.#10517(pPlayer, 10, newStamina, 0)` and sets `bUsed = 1`.
   - **Status Cure (`0x6fc8a646..0x6fc8a684`)**:
     - Checks `STATE_POISON (2)` (`0x6fc8a646`): if active, removes state `2`, expires poison statlist (`0x6fc8a661`), and sets `bUsed = 1`.
     - Checks `STATE_FREEZE (1)` (`0x6fc8a669`): if active, removes state `1`, expires freeze statlist (`0x6fc8a67b`), and sets `bUsed = 1`.
     - Calls `0x6fcdc920(pPlayer)` (`STATES_ClearCurableStates` at `0x6fc8a683`): iterates all states and removes any state whose `States.txt` row has `curable == 1` (`bit 11 = 0x800` in state flags at `+0x04`):
       - `9` (`amplifydamage`)
       - `19` (`weaken`)
       - `55` (`ironmaiden`)
       - `60` (`decrepify`)
       - `61` (`lowresist`)
       - `113` (`defense_curse`)
       - `114` (`blood_mana`)
       - Returns `1` if any curable state was removed (`bUsed |= removed`).
   - **Pet & Mercenary Heal + Cure (`0x6fc8a691` -> `0x6fc4bd10` with callback `0x6fc89de0`)**:
     - Iterates all pets/hirelings belonging to `pPlayer` (`0x6fc89de0..0x6fc89e7c`):
       - If `hp < maxhp`, sets `hp = maxhp` (`100%` full heal for pets/mercenaries) and sets `*pbUsed = 1`.
       - Cures `STATE_POISON (2)`, `STATE_FREEZE (1)`, and `curable == 1` states (`0x6fcdc920`) on the pet/mercenary, setting `*pbUsed = 1` if any state was cured.
3. Back in `0x6fc8cee0` (`0x6fc8cefc`):
   - If `bUsed == 0`, returns `0` immediately (`0x6fc8cefe`) — **does not decrement charges, does not change mode, and does not schedule an event timer**.
   - Otherwise:
     - Decrements `bl` (`dec bl` at `0x6fc8cf3b`).
     - Reads `Parm2` (`ecx = [ebp+0x60] = 1`).
     - If `bl <= (Parm2 << 1)` and `bl % Parm2 == 0` (`0x6fc8cf4e..0x6fc8cf5d`):
       - Sets object mode to `2 - (bl / Parm2)` (`D2Common.#10908` at `0x6fc8cf64`):
         - `2 -> mode 0` (`OBJMODE_NEUTRAL`)
         - `1 -> mode 1` (`OBJMODE_OPERATING`, half-full well)
         - `0 -> mode 2` (`OBJMODE_OPENED`, empty well)
     - Stores `pObjectData->bInteractType = bl` (`0x6fc8cf69`).
     - Schedules `Object Event 2` (`0x6fc89ca0`) at `pGame->dwGameFrame + Parm0 + 1` (`currentFrame + 751`, `0x6fc8cf73..0x6fc8cf84`).

### 1.4 `OBJECTS_Event2_WellRegen` (`0x6fc89ca0`)

```text
6fc89ce8: mov cl, [esi+0x4]         ; bInteractType
6fc89ceb: mov eax, [eax+0x60]       ; Parm2 (1)
6fc89cee: lea edx, [eax+eax]        ; Parm2 << 1 (2)
6fc89cf1: movzx ecx, cl
6fc89cf4: cmp ecx, edx
6fc89cf6: jge 6fc89d1c
6fc89cf8: inc ecx                   ; charges + 1
6fc89cf9: mov [esi+0x4], cl
```

- When a scheduled `Event 2` timer fires, if `bInteractType < (Parm2 << 1)`:
  - Increments `bInteractType` by `1`.
  - If `bInteractType <= (Parm2 << 1)` and `bInteractType % Parm2 == 0`, updates object mode to `2 - (bInteractType / Parm2)` (`1 -> mode 1`, `2 -> mode 0`).

---

## 2. Object Trap Damage (`0x6fd142d0` & `0x6fd14260`), `OperateFn 30`, and `OperateFn 7`

### 2.1 `SUNITDMG_ApplyObjectTrapDamage` (`0x6fd142d0`) & `0x6fd14260`

`0x6fd142d0(pGame, pObject, pTarget, nDamageType)` computes and applies trap damage from an object to a target unit (`pTarget`):
1. Reads `hpFixed = D2Common.#10564(pTarget, STAT_HITPOINTS = 6, 0)` (`1/256` fixed-point current life). If `hpFixed <= 0`, returns (`0x6fd142ff`).
2. Computes `minDmg256` and `maxDmg256` from current life (`0x6fd14305..0x6fd1431b`):
   - `minDmg256 = max(1, hpFixed >> 5)` (`1/32 = 3.125%` of current life).
   - `maxDmg256 = max(minDmg256 + 1, hpFixed >> 3)` (`1/8 = 12.5%` of current life).
3. Rolls uniform random damage in `[minDmg256, maxDmg256]` (`range = maxDmg256 - minDmg256 + 256`, `0x6fd1431d..0x6fd14350`).
4. Scales by the area's monster level `monLvl = D2Common.#10820(areaId, bExpansion, nDifficulty)` (`Levels.txt` `MonLvl1..3` / `MonLvl1Ex..3Ex`, `0x6fd14352..0x6fd1438f`):
   - `dmg256 = max(256, (rolled256 * monLvl) / 100)`.
5. Calls `0x6fd14260(pGame, pObject, pTarget, dmg256, nDamageType)`:
   - `nDamageType == 0`: physical damage (`D2DamageStrc.dwPhysDamage` at `+0x08`, `dwHitFlags |= 0x20`).
   - `nDamageType == 1`: fire damage (`D2DamageStrc.dwFireDamage` at `+0x10`).
   - Runs the combat damage pipeline (`0x6fcf62f0` + `0x6fcfd000`).

### 2.2 `OBJECTS_OperateFn30_Trap` (`0x6fc8e0e0`) & `OBJECTS_Event9_ExplodingChest` (`0x6fc8e150`)

Used by `Objects.txt` ID `250` (`a trap`, `OperateFn = 30`) and ID `454` (`explodingchest`, `OperateFn = 30`):
1. If `obj.mode != 0` (`OBJMODE_NEUTRAL`), returns `0`.
2. Sets `obj.mode = 1` (`OBJMODE_OPERATING`).
3. Calls `0x6fd142d0(pGame, pObject, pPlayer, 0)` (physical damage) and `0x6fd142d0(pGame, pObject, pPlayer, 1)` (fire damage).
4. Schedules `Object Event 9` (`0x6fc8e150`):
   - Transitions `obj.mode` to `2` (`OBJMODE_OPENED`).
   - For `classId == 454` (`explodingchest`), calls `0x6fc8b570(pGame, pObject, pPlayer)` to drop chest loot (`100%` chest drop).

### 2.3 `OBJECTS_OperateFn7_ExplodingBarrel` (`0x6fc8d740`, `0x6fc8ad60`, `0x6fc8ae60`)

Used by `Objects.txt` ID `11` (`BarrelExploding`, `OperateFn = 7`):
1. If `obj.mode != 0`, returns `0`.
2. Calls `0x6fc8ad60(pGame, pObject)` (`OBJECTS_DetonateExplodingBarrel`):
   - Sets `obj.mode = 1`, then `2` (`OBJMODE_OPENED`), removing unit collision.
   - Scans a 3-subtile bounding box around `(obj.x, obj.y)` with callback `0x6fc8ae60`:
     - For any living player (`unitType == 0`) or killable monster (`unitType == 1`, `D2Common.#10457 != 0`) within Euclidean subtile distance `<= 3` (`D2Common.#10409 <= 3`), calls `0x6fd142d0(pGame, pObject, pUnit, 0)` (physical trap damage).
     - For any other neutral (`mode == 0`) exploding barrel (`classId == 11`) within distance `<= 2`, recursively triggers `0x6fc8ad60` (chain detonation).
   - Does **not** call `0x6fc8b570` (no item drop).
