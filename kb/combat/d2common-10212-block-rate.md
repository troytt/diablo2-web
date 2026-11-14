# 1.13c Block Rate & Block Mode Dispatch (`D2Common.dll #10212` & `D2Game.dll`)

## 1. `D2Common.dll #10212` (`UNITS_GetBlockRate` @ `0x6FD81D20`)

Disassembled from `samples/d2/D2Common.dll` (`0x6FD81D20..0x6FD81DF8`):

- **Unit Type Gate (`0x6FD81D2A`)**:
  - Checks `pUnit->dwUnitType == UNIT_PLAYER` (`0`).
- **Non-Player Branch (`0x6FD81D2F..0x6FD81D7E`)**:
  - If the unit has an inventory (`pUnit->pInventory != NULL`, e.g. hirelings), calls `INVENTORY_GetCompositItem(pInventory, COMPOSIT_SHIELD)` (`#10397`) and returns `0` if no shield is equipped.
  - Otherwise (monsters without inventory, or shield-equipped hirelings) reads `STATLIST_GetUnitStatUnsigned(pUnit, STAT_TOBLOCK (20), 0)` (`#10973`).
  - Clamps the returned value to `[0, 75]` (`0x6FD81D6F..0x6FD81D78`).
  - Note: Monster `STAT_TOBLOCK` (`20`) is initialized during monster spawn from `MonStats.txt` `ToBlock` / `ToBlock(N)` / `ToBlock(H)` gated by `MonStats2.txt` `mBL` (`D2Game.dll` `0x6FC69A64..0x6FC69AA5`).
- **Player Branch (`0x6FD81D84..0x6FD81DF8`)**:
  - Requires an equipped shield in `pUnit->pInventory` (`0x6FD81D92`); returns `0` if no shield is equipped.
  - Lookups `CharStatsTxt* pCharStats` for `pUnit->dwClassId` (`0..6`) and reads `pCharStats->nBlockFactor` (`byte [ecx+0x35]`):
    - Amazon: `25`, Sorceress: `20`, Necromancer: `20`, Paladin: `30`, Barbarian: `25`, Druid: `20`, Assassin: `25`.
  - Adds `STATLIST_GetUnitStatUnsigned(pUnit, STAT_TOBLOCK (20), 0)` (`0x6FD81DB5..0x6FD81DBB`):
    - In 1.13c item generation (`D2Common.dll` `0x6FD6FF40` `sub_6FD6FF40`), `Armor.txt` `block` (`dword [eax+0x134]`) is baked into shield items as base `STAT_TOBLOCK` (`20`), which accrues alongside item magic modifiers (`icb` / `toblock`) and active skill states (e.g. Paladin `Holy Shield` `stateId = 101`).
    - `totalShieldBlock = armorBlock + itemToBlock + stateToBlock + CharStats.BlockFactor` (NOT pre-clamped to `75` before the Expansion dexterity scaling).
  - When `bExpansion != 0` (`0x6FD81DC3..0x6FD81DE5`):
    - Reads `dex = STATLIST_GetUnitStatUnsigned(pUnit, STAT_DEXTERITY (2), 0)` and `clvl = max(1, STATLIST_GetUnitStatUnsigned(pUnit, STAT_LEVEL (12), 0))`.
    - Computes `block = ((dex - 15) * totalShieldBlock) / (2 * clvl)` via signed integer division (`cdq; idiv ecx`).
  - Clamps `block` to `[0, 75]` (`0x6FD81DE7..0x6FD81DF0`).

## 2. Running `1/3` Penalty (`D2Game.dll` `SUNITDMG_ApplyBlockOrDodge` @ `0x6FCFB790`)

Disassembled from `samples/d2/D2Game.dll` (`0x6FCFB790..0x6FCFB811`):

- Calls `D2Common_10212(pDefender, bExpansion)` (`0x6FCFB7CA`).
- If `block > 0`, checks `pDefender->dwUnitType == UNIT_PLAYER` and `pDefender->dwAnimMode == PLRMODE_RUN (3)` (`0x6FCFB7D0..0x6FCFB7DE`).
- When the player is running (`PLRMODE_RUN = 3`), divides `block` by `3` using signed integer division (`mov ecx, 3; cdq; idiv ecx` @ `0x6FCFB7EC..0x6FCFB7F2`).
- Walking (`PLRMODE_WALK = 2`, `PLRMODE_TWALK = 6`) is NOT penalized and retains full block chance.

## 3. Avoidance Roll Order & Unclamped Skill Stats (`D2Game.dll` `0x6FCFB030` & `0x6FCFA540`)

- `SUNITDMG_GetWeaponBlock` (`0x6FCFA540`): reads `STAT_PASSIVE_WEAPONBLOCK (348)` and returns the accrued stat value directly without an artificial `65%` cap.
- `SUNITDMG_ApplyDodge` (`0x6FCFB030`): reads `STAT_PASSIVE_EVADE (340)`, `STAT_PASSIVE_DODGE (338)`, and `STAT_PASSIVE_AVOID (339)` directly from `STATLIST_GetUnitStatUnsigned` without a `75%` cap.

## 4. Block Action Mode Dispatch (`D2Game.dll` `SUNITDMG_ExecuteEvents` @ `0x6FCFCF20`)

- When `HitFlags & 0x10` (blocked hit) is set:
  - Monster defender (`0x6FCFD0D4`): transitions to `MONMODE_BLOCK = 6` (`'BL'`).
  - Player defender (`0x6FCFD31E`): transitions to `PLRMODE_BLOCK = 9` (`'BL'`).
