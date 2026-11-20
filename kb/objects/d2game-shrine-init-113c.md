# Diablo II v1.13c Server Shrine Initialization (`D2Game.dll` `InitFn 1` @ `0x6fc4ef90`)

## Binary & Data Ground Truth

- **Binary**: `samples/d2/D2Game.dll` (v1.13c, PE image base `0x6FC20000`)
- **InitFn Dispatch Table**: `0x6fd2e050` (80 entries, `0..79`), indexed by `Objects.txt` `InitFn` (`pObjectsTxt + 0x173`)
  - `InitFn 1` -> `0x6fc4ef90` (`OBJECTS_InitFn01_Shrine`)
- **Shrine Effect-Class Region Builder**: `0x6fc2b9a0..0x6fc2bbe8`
- **Shrine Effect-Class Candidate Selector**: `0x6fc4ed70..0x6fc4ef82`
- **Data Tables**:
  - `data\global\excel\Objects.txt` (`Parm0` at `pObjectsTxt + 0x178`, `OperateFn` at `pObjectsTxt + 0x174`, `InitFn` at `pObjectsTxt + 0x173`)
  - `data\global\excel\Shrines.txt` (23 rows, `Code 0..22`, compiled record size `0x118` bytes: `effectclass` at `+0x0A`, `LevelMin` at `+0x10C`)

---

## 1. `Shrines.txt` `effectclass` Buckets (`0x6fc2b9a0`)

At game/act initialization (`0x6fc2b9a0`), `D2Game.dll` queries `D2Common.#10631` (total shrine rows = `23`) and iterates `Shrines.txt` rows `0..22` in table order, reading `pShrinesTxt->nEffectClass` (`byte [ecx + 0x0A]`) and appending the row index into the corresponding `effectclass` (`1..4`) array in `D2ShrinesRegionStrc`:

| `Code` | Shrine Type | `effectclass` (`+0x0A`) | `LevelMin` (`+0x10C`) | Post-Remap (`0x6fc4f089`) |
|---:|---|---:|---:|---|
| `0` | None | `0` | `0` | `0` |
| `1` | Refilling | `4` | `1` | `1` |
| `2` | Health | `2` | `1` | `2` |
| `3` | Mana | `3` | `1` | `3` |
| `4` | Health Exchange | `2` | `2` | `-> 2` (Health) |
| `5` | Mana Exchange | `3` | `2` | `-> 3` (Mana) |
| `6` | Armor | `4` | `5` | `6` |
| `7` | Combat | `4` | `8` | `7` |
| `8` | Resist Fire | `4` | `5` | `8` |
| `9` | Resist Cold | `4` | `26` | `9` |
| `10` | Resist Lightning | `4` | `32` | `10` |
| `11` | Resist Poison | `4` | `21` | `11` |
| `12` | Skill | `4` | `1` | `12` |
| `13` | Mana Recharge | `4` | `1` | `13` |
| `14` | Stamina | `4` | `1` | `14` |
| `15` | Experience | `4` | `1` | `15` |
| `16` | Enirhs | `1` | `1` | `-> 18` (Gem) |
| `17` | Portal | `1` | `3` | `17` |
| `18` | Gem | `1` | `4` | `18` |
| `19` | Fire | `1` | `1` | `19` |
| `20` | Monster | `1` | `3` | `20` |
| `21` | Exploding | `1` | `1` | `21` |
| `22` | Poison | `1` | `1` | `22` |

Resulting per-`effectclass` candidate lists:

- `effectclass 1` (7 rows): `[16, 17, 18, 19, 20, 21, 22]`
- `effectclass 2` (2 rows): `[2, 4]`
- `effectclass 3` (2 rows): `[3, 5]`
- `effectclass 4` (11 rows): `[1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]`

---

## 2. Shrine Selection & `LevelMin` Gating (`0x6fc4ef90` & `0x6fc4ed70`)

1. **`Parm0` Branching (`0x6fc4efbe..0x6fc4f084`)**:
   - Reads `Parm0 = pObjectsTxt->dwParm[0]` (`[eax + 0x178]`) and `levelId = D2Common.#10057(pRoom)` (`areaId`).
   - **`Parm0 == 0`** (`0x6fc4efc9..0x6fc4f035`):
     Loops up to 8 times (`tries = 8`), rolling `code = 1 + SEED_RollLimitedRandomNumber(pObjectSeed, nShrines - 1)` (`1..22`) and breaking as soon as `levelId >= pShrinesTxt[code].dwLevelMin`.
   - **`Parm0 == 1`** (`0x6fc4f039`):
     Calls `sub_6FC4ED70(pAct, pObjectSeed, effectclass = 2, levelId)`.
   - **`Parm0 == 2`** (`0x6fc4f046`):
     Calls `sub_6FC4ED70(pAct, pObjectSeed, effectclass = 3, levelId)`.
   - **`Parm0 >= 3`** (`0x6fc4f056..0x6fc4f07e`):
     Rolls `SEED_RollLimitedRandomNumber(pObjectSeed, 10)`. If `== 0` (10% chance), selects `effectclass = 1`; otherwise (90% chance), selects `effectclass = 4`. Calls `sub_6FC4ED70(pAct, pObjectSeed, effectclass, levelId)`.

2. **`sub_6FC4ED70` (`0x6fc4ed70..0x6fc4ee6e`)**:
   - Looks up the candidate array `list = pShrineRegion->pList[effectclass]` and `count = pShrineRegion->nCount[effectclass]`.
   - Loops up to 8 times (`tries = 8`):
     - Rolls `idx = SEED_RollLimitedRandomNumber(pSeed, count)`.
     - Sets `code = list[idx]`.
     - Reads `pShrinesTxt[code].dwLevelMin` (`[eax + 0x10C]`).
     - Breaks immediately when `levelId >= dwLevelMin`.

3. **Deprecated Shrine Code Remapping (`0x6fc4f089..0x6fc4f0b1`)**:
   - `if (code == 5) code = 3` (Mana Exchange -> Mana)
   - `else if (code == 4) code = 2` (Health Exchange -> Health)
   - `else if (code == 16) code = 18` (Enirhs -> Gem)
   - Stores `code` into `pObjectData->bInteractType` (`shrineType`) and sets `pShrineData` (`D2Common.#10635`).

---

## 3. Sweep of `Objects.txt` `OperateFn = 2` Rows & `InitFn` Table (`0x6fd2e050`)

- All 92 rows in `Objects.txt` with `OperateFn = 2` also have `InitFn = 1`:
  - `Parm0 = 1` (Health Shrine, 21 rows, including Dummy rows `120, 301, 319`): always resolve to `Code 2`.
  - `Parm0 = 2` (Mana Shrine, 21 rows): always resolve to `Code 3`.
  - `Parm0 = 3` (Magic/Booster Shrine, 50 rows, including Dummy row `86`): resolve 10% `effectclass 1` / 90% `effectclass 4`.
- Out of all 80 `InitFn` entries at `0x6fd2e050`, only two read `pObjectsTxt->dwParm` (`+0x178..+0x194`):
  - `InitFn 1` (`0x6fc4ef90`, Shrine): reads `Parm0` (`+0x178`).
  - `InitFn 16` (`0x6fc4e760`, Well): reads `Parm2` (`+0x180`).
