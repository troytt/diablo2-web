# D2Game 1.13c Shrine OperateFn 2 & Dispatch Table (`0x6fc8da00`, `0x6fd1a5f8`)

## Binary & MPQ Sources
- **Binary**: `samples/d2/D2Game.dll` (1.13c, image base `0x6fc20000`)
- **Data tables**:
  - `data\\global\\excel\\shrines.txt` (`D2Common.#10629` `DATATBLS_GetShrinesTxtRecord`, `0x118`-byte `D2ShrinesTxt`)
  - `data\\global\\excel\\states.txt` (rows `128..137`, `shrine_armor..shrine_experience`)
  - `data\\global\\excel\\itemstatcost.txt`
  - `data\\global\\excel\\misc.txt` (`BetterGem` column, `D2Common.#10602` `ITEMS_GetGemsTxtRecord`)
  - `data\\global\\excel\\missiles.txt` (IDs `45` `explosivepotion`, `48` `chokinggaspoition`, `62` `fireball`)

## `OperateFn 2` Entry Point (`0x6fc8da00`)
1. Requires `pObject->eMode == OBJMODE_NEUTRAL (0)`; otherwise returns `0`.
2. Sets object mode to `OBJMODE_OPERATING (1)` (`D2Common.#10349`).
3. Fetches `shrineCode = pObject->pObjectData->bShrineId` (`D2Common.#10421`) and `pShrinesTxt = DATATBLS_GetShrinesTxtRecord(shrineCode)` (`D2Common.#10629`).
4. Looks up `g_ShrineEffectTable[shrineCode]` at `0x6fd1a5f8` (`count = 24` at `0x6fd27d4c`, 12 bytes per entry: `{ pfnEffect, nStatId, nStateId }`):
   - If `shrineCode < 0 || shrineCode >= 24 || pfnEffect == NULL`, falls back to `0x6fc89c00` (`SHRINES_Refill`).
5. Calls `pfnEffect(pGame, pShrine, pPlayer, shrineCode)`.
6. If `pShrinesTxt->nResetTimeInMinutes > 0` (`+0x10`, read at `0x6fc8db60`):
   - Schedules `EVENTTYPE_ENDANIM (3)` at `pGame->dwGameFrame + nResetTimeInMinutes * 1200 + 1` (`0x6fc8db67..0x6fc8db7e` -> `0x6fc34840`).
   - Otherwise (`nResetTimeInMinutes == 0`), the shrine remains in `OBJMODE_OPENED (2)` permanently.
7. In `D2ShrinesTxt` (`0x118` bytes):
   - `+0x00`: `bCode` (`u8`)
   - `+0x02`: `bEffectClass` (`u8`)
   - `+0x04`: `dwArg0` (`u32`, read at `0x6fc8abfa`, `0x6fc8aca4`, `0x6fc8ad2f`)
   - `+0x08`: `dwArg1` (`u32`, read at `0x6fc8982e`, `0x6fc8ad39`)
   - `+0x0C`: `dwDurationInFrames` (`u32`, read at `0x6fc8ab63`, `0x6fc8ac14`, `0x6fc8aca9`, `0x6fc8ad2a`)
   - `+0x10`: `nResetTimeInMinutes` (`u8`, read at `0x6fc8db60`)
   - `+0x11`: `szStringPhrase` (`char[32]`)
   - `+0x10C`: `dwLevelMin` (`u32`, read at `0x6fc4ef15`)

## `0x6fd1a5f8` Shrine Dispatch Table (`Code 0..22`)

| Code | Name | `Arg0` | `Arg1` | `Duration` | `Reset (min)` | `statId` | `stateId` | Handler VA | Behavior Summary |
|---:|---|---:|---:|---:|---:|---:|---:|---|---|
| 0 | `Shrine` | 100 | 100 | 0 | 2 | -1 | 0 | `0x00000000` | Null entry; `0x6fc8db1c` falls back to `0x6fc89c00` (Refill HP + Mana) |
| 1 | `Refilling Shrine` | 100 | 100 | 0 | 2 | -1 | 0 | `0x6fc89c00` | Restores `stat 6` (HP) to `maxhp` and `stat 8` (Mana) to `maxmana` (does not modify stamina) |
| 2 | `Health Shrine` | 200 | 400 | 0 | 5 | -1 | 0 | `0x6fc898a0` | Adds `maxhp - hp` to `stat 6` -> restores 100% full life |
| 3 | `Mana Shrine` | 200 | 400 | 0 | 5 | -1 | 0 | `0x6fc89860` | Adds `maxmana - mana` to `stat 8` -> restores 100% full mana |
| 4 | `Health Exchange Shrine` | 50 | 500 | 0 | 0 | -1 | 0 | `0x6fc89800` | Takes `((hp >> 8) * Arg0 / 100) << 8` from HP and adds `take * Arg1 / 100` (`5x`) to Mana |
| 5 | `Mana Exchange Shrine` | 50 | 500 | 0 | 0 | -1 | 0 | `0x6fc897a0` | Takes `mana * Arg0 / 100` from Mana and adds `take * Arg1 / 100` (`5x`) to HP |
| 6 | `Armor Shrine` | 100 | 1 | 2400 | 5 | 171 (`skill_armor_percent`) | 128 | `0x6fc8abb0` | Clears prior shrine state (`0x6fc8a960`), sets `stat 171 = +100%` for 2400 frames |
| 7 | `Combat Shrine` | 200 | 200 | 2400 | 5 | -1 | 129 | `0x6fc8ace0` | Clears prior shrine state, sets `stat 19 (tohit) = +200%` and `stat 25 (damagepercent) = +200%` for 2400 frames |
| 8 | `Resist Fire Shrine` | 75 | 0 | 3600 | 5 | 39 (`fireresist`) | 131 | `0x6fc8abb0` | Sets `stat 39 = +75` for 3600 frames |
| 9 | `Resist Cold Shrine` | 75 | 0 | 3600 | 5 | 43 (`coldresist`) | 132 | `0x6fc8abb0` | Sets `stat 43 = +75` for 3600 frames |
| 10 | `Resist Lightning Shrine` | 75 | 0 | 3600 | 5 | 41 (`lightresist`) | 130 | `0x6fc8abb0` | Sets `stat 41 = +75` for 3600 frames |
| 11 | `Resist Poison Shrine` | 75 | 0 | 3600 | 5 | 45 (`poisonresist`) | 133 | `0x6fc8abb0` | Sets `stat 45 = +75` for 3600 frames |
| 12 | `Skill Shrine` | 2 | 0 | 2400 | 5 | 127 (`item_allskills`) | 134 | `0x6fc8ab60` | Sets `stat 127 = +2` for 2400 frames |
| 13 | `Mana Recharge Shrine` | 400 | 0 | 2400 | 5 | 27 (`manarecoverybonus`) | 135 | `0x6fc8abb0` | Sets `stat 27 = +400` for 2400 frames |
| 14 | `Stamina Shrine` | 200 | 0 | 4800 | 5 | 162 (`skill_staminapercent`) | 136 | `0x6fc8ac30` | Immediately refills `stat 10` (`stamina`) to `maxstamina`, sets `stat 162 = 200` and `stat 28 (staminarecoverybonus) = 1000` for 4800 frames |
| 15 | `Experience Shrine` | 50 | 50 | 3600 | 0 | 85 (`item_addexperience`) | 137 | `0x6fc8abb0` | Sets `stat 85 = +50` for 3600 frames |
| 16 | `Enirhs Shrine` | 0 | 0 | 0 | 0 | -1 | 0 | `0x6fc89770` | Calls `_strrev` (`0x6fc22e10`) + `strncpy(..., 0x10)` on `pPlayerData->szName`; does not heal |
| 17 | `Portal Shrine` | 0 | 0 | 0 | 0 | -1 | 0 | `0x6fc8b9b0` | Opens a town portal pair from the shrine room to the act town |
| 18 | `Gem Shrine` | 0 | 0 | 0 | 0 | -1 | 0 | `0x6fc8b430` | Upgrades a carried gem with `Misc.txt` `BetterGem != "non "` one tier; if none, drops `["gcw","gcr","gcg","gcb","gcy","gcv"][rand(6)]` (`0x6fc8b554`) |
| 19 | `Fire Shrine` | 50 | 2000 | 0 | 0 | -1 | 0 | `0x6fc8c900` | Cuts current HP of all living units within radius `14` (`0x0e`) by `Arg0%` (`50%`, min `0x100` / `1 HP`) and fires `fireball` (`missileId = 62`) ring to perimeter `-20..20` step `5` |
| 20 | `Monster Shrine` | 0 | 0 | 0 | 0 | -1 | 0 | `0x6fc8b8a0` | Finds nearest normal monster (`0x6fc8a440`) and upgrades it in place (`0x6fc44b70` -> `0x6fc43ca0`: 20% Champion / 80% Unique) |
| 21 | `Exploding Shrine` | 5 | 10 | 0 | 0 | -1 | 0 | `0x6fc8c580` | Drops `5 + rand(5)` (`5..9`) `opm` potions and fires 6 `explosivepotion` (`missileId = 45`) missiles via `0x6fc8f930` |
| 22 | `Poison Shrine` | 5 | 10 | 0 | 0 | -1 | 0 | `0x6fc8c200` | Drops `5 + rand(5)` (`5..9`) `gpm` potions and fires 6 `chokinggaspoition` (`missileId = 48`) missiles via `0x6fc8f930` |
