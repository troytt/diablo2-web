# D2Game.dll v1.13c GetHit (`GH`) Recovery Check, `HitClass` Divisors & Mode Priority

## Binary Evidence (`samples/d2/D2Game.dll` Base `0x6FC20000`, `samples/d2/D2Common.dll` Base `0x6FD50000`)

### 1. `SUNITDMG_CheckSkipGetHit` (`D2Game.dll` `0x6FCFB910`..`0x6FCFB9FC`)
- **Signature**: `int __fastcall SUNITDMG_CheckSkipGetHit(D2UnitStrc* pDefender, D2DamageStrc* pDmg, int dwHitClass)`
  - `ecx = pDefender`, `edx = pDmg`, `[esp+4] = dwHitClass`.
  - Returns `1` (`skip GetHit`) or `0` (`enter GetHit`).
- **Pre-checks (`0x6FCFB91A..0x6FCFB939`)**:
  1. **Freeze State (`0x6FCFB91A..0x6FCFB924`)**:
     Calls `D2Common_10494_CheckUnitState(pDefender, STATE_FREEZE=1)`. If non-zero, returns `1` (frozen units never enter GetHit).
  2. **Pure Poison Damage (`0x6FCFB926..0x6FCFB930`)**:
     Reads `pDmg->dwPoisDamage` (`[edx+0x28]`) and `pDmg->dwDmgTotal` (`[edx+0x40]`). If `dwPoisDamage != 0 && dwPoisDamage == dwDmgTotal`, returns `1` (pure poison hits never trigger GetHit).
  3. **Sub-1 HP Damage (`0x6FCFB932..0x6FCFB939`)**:
     If `pDmg->dwDmgTotal < 0x100` (`< 256` in 1/256 fixed-point life, i.e. `< 1` integer HP), returns `1`.

### 2. `HitClass` Divisor Table (`0x6FCFB948..0x6FCFB975`, Jump Table `0x6FCFBA04`)
- Queries `maxHp256 = D2Common_10913_GetMaxLife(pDefender)` (`0x6FCFB949`).
- Evaluates `switch (dwHitClass - 1)` for `dwHitClass` in `1..12` (`dec edx; cmp edx, 0xb; ja 0x6FCFB970`):

| `HitClass` ID | `HitClass.txt` `Code` | Description | Divisor `d` (`edi`) | Disassembly Target |
|---:|---|---|---:|---|
| `1` | `hth` | Hand To Hand | `16` (`0x10`) | `0x6FCFB970` (`default`) |
| `2` | `1hss` | One Hand Swing vs. Small | `8` (`0x08`) | `0x6FCFB959` |
| `3` | `1hsl` | One Hand Swing vs. Large | `16` (`0x10`) | `0x6FCFB970` (`default`) |
| `4` | `2hss` | Two Hand Swing vs. Small | `32` (`0x20`) | `0x6FCFB960` |
| `5` | `2hsl` | Two Hand Swing vs. Large | `64` (`0x40`) | `0x6FCFB967` |
| `6` | `1ht` | One Hand Thrust | `8` (`0x08`) | `0x6FCFB959` |
| `7` | `2ht` | Two Hand Thrust | `16` (`0x10`) | `0x6FCFB970` (`default`) |
| `8` | `club` | Club | `32` (`0x20`) | `0x6FCFB960` |
| `9` | `staf` | Staff | `16` (`0x10`) | `0x6FCFB970` (`default`) |
| `10` | `bow` | Bow | `8` (`0x08`) | `0x6FCFB959` |
| `11` | `xbow` | Crossbow | `8` (`0x08`) | `0x6FCFB959` |
| `12` | `claw` | Claw | `16` (`0x10`) | `0x6FCFB970` (`default`) |
| other (`0`, `13`, `>= 16`) | — | Default / Overlay / Elemental | `16` (`0x10`) | `0x6FCFB970` (`default`) |

- **How `dwHitClass` is Resolved (`0x6FCFCFB5..0x6FCFD008`, `D2Common #10862` `0x6FD821E0`)**:
  - If `pDmg->dwHitClass == 0`, `SUNITDMG_ExecuteEvents` calls `D2Common_10862_GetHitClass(pAttacker)` (`0x6FD821E0`):
    - `UNIT_PLAYER (0)`: gets active weapon via `INVENTORY_GetCompositItem(pInventory, 0)` (`0x6FD81B90`) and returns `ITEMS_GetHitClass(pWeapon)` (`0x6FD72380`, `Weapons.txt` `hit class` byte at `+0x13C`), or `1` (`hth`) if unarmed.
    - `UNIT_MONSTER (1)`: looks up `MonStats2.txt` via `0x6FD513B0` and returns `BYTE PTR [pMonStats2 + 0x14]` (`MonStats2.txt` `HitClass` column).
  - If `(dwHitClass & 0xF0) == 0` and `pDmg->wResultFlags & 0x20` (`50%` random roll at `0x6FCFC43A`) and attacker has an elemental damage bit set (`0x400=cold->0x30`, `0x800=fire->0x20`, `0x1000=ltng->0x40`, `0x2000=pois->0x50`, `0x4000=stun->0x60`), the upper nibble is OR'd into `dwHitClass` (`0x6FCFCFD6..0x6FCFD008`), causing `dec edx; cmp edx, 0xb` in `0x6FCFB94F` to take the `ja default` branch (`d = 16`).

### 3. Three-Tier Life Thresholds & Cascading LCG Rolls (`0x6FCFB97A..0x6FCFB9D3`)
Let `dmg = pDmg->dwDmgTotal` (256ths), `maxHp = D2Common_10913_GetMaxLife(pDefender)` (256ths), and `d` be the divisor from the table above (`8`, `16`, `32`, or `64`):
1. **Tier 0 (`0x6FCFB97A..0x6FCFB982`) — `< 1/d` Max Life**:
   - `if (dmg < maxHp / d) return 1;` -> **`0%` chance** to enter GetHit.
2. **Tier 1 (`0x6FCFB988..0x6FCFB9AB`) — `[1/d, 2/d)` Max Life**:
   - `if (dmg < maxHp / (d / 2))`: rolls `SEED_RollRandom(&pDefender->pSeed, 2)` (`rand(2)`).
   - If the roll is `0`, returns `1` (skip).
   - If the roll is `1`, execution **falls through** to `0x6FCFB9AD` (Tier 2 check)!
3. **Tier 2 (`0x6FCFB9AD..0x6FCFB9D3`) — `[2/d, 4/d)` Max Life**:
   - `if (dmg < maxHp / (d / 4))`: rolls `SEED_RollRandom(&pDefender->pSeed, 4)` (`rand(4)`).
   - If the roll is `0`, returns `1` (skip).
4. **Tier 3 (`>= 4/d` Max Life)**:
   - Both `< maxHp / (d / 2)` and `< maxHp / (d / 4)` are false -> no RNG roll -> proceeds directly to the mode check (`100%` chance).

Consequently, the exact effective GetHit probabilities by damage fraction are:
- `dmg < maxHp / d`: **`0%`**
- `maxHp / d <= dmg < 2 * maxHp / d`: `(1/2) * (3/4) = 3/8` (**`37.5%`**)
- `2 * maxHp / d <= dmg < 4 * maxHp / d`: `3/4` (**`75%`**)
- `dmg >= 4 * maxHp / d`: **`100%`**

For the default divisor `d = 16`:
- `< 1/16` max life: `0%`
- `[1/16, 1/8)` max life: `37.5%`
- `[1/8, 1/4)` max life: `75%`
- `>= 1/4` max life: `100%`

### 4. Monster `mGH` Mode Flag & `neverCount` Checks (`0x6FCFB9D5..0x6FCFB9F7`, `0x6FCFFA90`)
- At `0x6FCFB9D5..0x6FCFB9ED`: if `pDefender->dwUnitType == UNIT_MONSTER (1)`, calls `0x6FC21560(eax = pDefender->dwClassId, edx = MONMODE_GETHIT=3)`, which checks bit 3 (`1 << 3 = 0x08`, `MonStats2.txt` column `mGH`) of `pMonStats2->dwModeFlags` (`+0xF0`).
  - All Act bosses (Andariel `#156`, Duriel `#211`, Mephisto `#242`, Diablo `#243`, Baal `#544`) and Uber bosses have `mGH = 1` in `MonStats2.txt` and **can** enter GetHit when damage reaches their thresholds.
  - Static turrets, traps, barricades, and catapults have `mGH = 0` and are skipped.
- In `SUNITDMG_ExecuteMissileDamage` (`0x6FCFE180`), `0x6FCFFA90(pDefender)` checks `MonStats.txt` `neverCount` (`0x10` in `+0x1A`); if set, hit reaction events are skipped.

### 5. Caller Mode Priority, Knockback Fallback & `STATE_STUNNED` (`0x6FCFCF20` `SUNITDMG_ExecuteEvents`)
- **Monster Defender (`0x6FCFD00E..0x6FCFD145`)**:
  1. **Knockback `mKB` Check (`0x6FCFD00E..0x6FCFD02E`)**:
     If `pDmg->wHitFlags & 0x08` (`HITFLAG_KNOCKBACK`), calls `0x6FC21560(dwClassId, MONMODE_KNOCKBACK=13)` (`MonStats2.txt` `mKB`, bit 13 = `0x2000`). If `mKB == 0`, clears `0x08` and sets `0x04` (`HITFLAG_GETHIT`) so knockback-immune monsters fall back to GetHit!
  2. **Priority Order (`0x6FCFD087..0x6FCFD145`)**:
     - `wResultFlags & 0x02` (`DEATH`) -> `MONMODE_DEATH (12)`
     - `else if (wHitFlags & 0x08)` (`KNOCKBACK`) -> `MONMODE_KNOCKBACK (13)`
     - `else if (wResultFlags & 0x10)` (`BLOCK`) -> `MONMODE_BLOCK (6)`
     - `else if (wHitFlags & 0x04)` (`GETHIT`):
       Checks `D2Common_10494_CheckUnitState(pDefender, STATE_STUNNED=21)` (`0x6FCFD0FC`). If stunned (`!= 0`), **skips** `SUNITDMG_CheckSkipGetHit` and unconditionally enters `MONMODE_GETHIT (3)` (provided `pDmg->dwDmgTotal >= 256` or caller set `0x04`). Otherwise calls `SUNITDMG_CheckSkipGetHit(pDefender, pDmg, dwHitClass)` (`0x6FCFD10A`) and enters `MONMODE_GETHIT (3)` when it returns `0`.
- **Player Defender (`0x6FCFD346..0x6FCFD426`)**:
  1. **Priority Order**:
     - `wResultFlags & 0x02` (`DEATH`) -> `PLRMODE_DEATH (17)`
     - `else if (wHitFlags & 0x08)` (`KNOCKBACK`) -> `PLRMODE_KNOCKBACK (19)`
     - `else if (wHitFlags & 0x04)` (`GETHIT`):
       Checks `D2Common_10494_CheckUnitState(pDefender, STATE_STUNNED=21)` (`0x6FCFD3EF`). If stunned (`!= 0`), unconditionally enters `PLRMODE_GETHIT (4)`. Otherwise calls `SUNITDMG_CheckSkipGetHit(pDefender, pDmg, dwHitClass)` (`0x6FCFD3FE`) and enters `PLRMODE_GETHIT (4)` (`0x6FC97FA0` -> `0x6FC98550`) when it returns `0`.
  2. **Player `PLRMODE_GETHIT (4)` Recovery Duration (`0x6FC98550`)**:
     - Sets unit mode to `PLRMODE_GETHIT = 4` (`GH` animation token), cancels current action/cast/walk path, and schedules mode completion using `CharStats.txt` / `AnimData.d2` `GH` frame count and `STAT_FASTERHITRECOVERY` (`#99`, `item_fastergethitrate`) via diminishing-returns `EFHR = floor(120 * FHR / (120 + FHR))`.
