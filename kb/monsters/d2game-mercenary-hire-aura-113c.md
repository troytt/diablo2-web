# D2Game.dll 1.13c Mercenary Hire, `.d2s` Load, `Hireable` AI & Radial Party Auras

> Reverse-engineered from `samples/d2/D2Game.dll` (1.13c, image base `0x6FC20000`),
> `samples/d2/D2Common.dll` (1.13c, image base `0x6FD50000`), and official 1.13c MPQ
> data tables (`Hireling.txt`, `MonStats.txt`, `MonAI.txt`, `Skills.txt`, `Missiles.txt`, `States.txt`).
> Verified frame-by-frame against the original `Game.exe` 1.13c golden trace
> `tests/fixtures/oracle/golden/p52-paladin-merc-aura.oracle.ndjson.gz` (`1700` frames).

---

## 1. Hiring (`C2S 0x36`), `.d2s` Load Order & Spawn Seeds

### 1.1 `D2GAME_MERCS_Hire_6FCEDBF0` (`C2S 0x36`, `0x6FCEDBF0..0x6FCEE010`)
- Packet layout (`7` bytes): `[0x36, dwNpcId: u32, wMercNameId: u16]`.
- Validates that the player has an active NPC menu interaction with `dwNpcId` (`Kashya` `#150`, `Greiz` `#198`, `Asheara` `#252`, `Qual-Kehk` `#515`), resolves the candidate matching `wMercNameId` via `D2Common_10458` (`0x6FD7CCC0`), deducts `cost` from inventory/stash gold (`D2Common #10889` / `PLRTRADE_SpendGold`), dismisses any prior mercenary, calls `MERCS_CreateUnit` (`0x6FCE1250`), and persists `{ flags, dwMercSeed, wMercNameId, wHirelingId, dwExperience }` into `D2PlayerDataStrc` for `.d2s` serialization (`0x7A66` `"jf"` block).

### 1.2 Join Call Order: `SAVE_LoadMercData` (`0x6FD0D980`) Runs BEFORE `PLAYER_UpdateRooms`
During player game join (`SAVE_LoadPlayerData` -> `SAVE_LoadMercData` `0x6FD0D980..0x6FD0DC10`):
1. The player (`unitType = 0, unitId = 1`) is allocated first (`1` `gameSeed` draw).
2. **`SAVE_LoadMercData` (`0x6FD0D980`) runs immediately on the join frame (`frame = 1`), BEFORE `PLAYER_UpdateRooms` activates town rooms and spawns Town NPCs!**
   - Consequently, a live `.d2s` mercenary (`bDead == 0 && dwMercSeed != 0`) ALWAYS receives:
     - **`unitId = 1`** (`unitType = 1` monster namespace; Town NPCs subsequently receive `unitId = 2..9`).
     - The **22nd `gameSeed` draw** in `SUNIT_AllocUnitData` (`0x6FCE1444 -> 0x6FD00110`, after `1` player draw + `8 * 2 = 16` starter item draws; e.g. `{ lo: 3737442494, hi: 666 }` for `mapSeed = 42050`), **kept directly on `pMerc->tSeed`** (`dwMercSeed` from `.d2s` is stored only in `D2PetListStrc` at `0x6FCB7E20`, never overwriting `pMerc->tSeed`!).
3. **`MERCS_CreateUnit` (`0x6FCE1250..0x6FCE1509`) & `MERCS_InitFromSave` (`0x6FC68FC0..0x6FC69130`)**:
   - Spawns `pMerc` (`hcIdx = row.Class`, e.g. `271` `roguehire`) at the owner's spawn subtile (`(ownerX, ownerY)`, e.g. `(5653, 5918)` in Act 1 Rogue Encampment) in `MONMODE_NEUTRAL (1)` with **`pRoom = NULL`** (`xor eax, eax` at `0x6FCE1484`).
   - Because `pRoom == NULL`, `0x6FCEA5F0` returns `NULL` without consulting `pGame->pMonReg[nAct]`, and `MONSTER_ChooseOutfit` (`0x6FCCF7AA`) rolls the 16 component slots directly (`8` draws on `pMerc->tSeed`) + `MONSTER_InitStats` (`1` HP range draw on `pMerc->tSeed`; for `mercSeed.lo = 3737442494`, these `9` draws leave `pMerc->tSeed = { lo: 680238887, hi: 361870172 }`).
   - Calls `D2Common_10945(pMerc, STATE_SOURCEUNIT /* 105 in 1.13c pet/merc state list: 105 = alignment/merc marker */, 1)` and registers pet link (`PetType = 7`).
   - Calls `D2GAME_MERCS_SetStats_6FC68BA0` (overwriting stats with deterministic `Hireling.txt` values, **0 RNG draws**).
   - Schedules the first AI think event (`EVENT_SetEvent(..., EVENTTYPE_AITHINK = 2, dwGameFrame + 2)` -> fires on **`frame = 3`**).

> **TS Implementation**: [`initOracleHireableMerc113c`](../../src/server/engine/game-instance/hireable-ai-113c.ts), invoked from [`connectPlayer`](../../src/server/engine/game-instance/area-and-session.ts) **before** `drlgRoomPopulator.activateNear`.

---

## 2. Experience-to-Level Loop & `D2GAME_MERCS_SetStats` (`0x6FC68BA0`)

### 2.1 `D2Common #11156` (`0x6FDA32C0`) — Bracket Lookup
Given `(bExpansion, subTypeId, level)`:
- Filters `Hireling.txt` rows with `Version == (bExpansion ? 100 : 0)` and `Id == subTypeId`.
- Returns the last row whose `row.Level <= level` (or `null` if none; when `level == 1` and lowest bracket is `Level = 3`, `SAVE_LoadMercData` falls back to the lowest row for `Id == subTypeId` at `0x6FD0DA4A`).

### 2.2 Dynamic-Bracket Experience -> Level Loop (`0x6FD0DA80..0x6FD0DACF`)
```c
int lvl = 1;
D2HirelingTxt* row = D2Common_11156_OrLowest(bExpansion, subTypeId, 1);
while (lvl + 1 <= 98) { // capped at min(98, ownerLevel) during gameplay
    int nextLvl = lvl + 1;
    uint32_t threshold = (uint32_t)((nextLvl + 1) * nextLvl * nextLvl * row->dwExpPerLvl);
    if (dwExperience < threshold) break;
    lvl = nextLvl;
    row = D2Common_11156_OrLowest(bExpansion, subTypeId, lvl); // re-queries bracket EVERY level!
}
```
- **Exact threshold verification**: On hire at `mercLevel = 35` (`Id = 1` Expansion Rogue Ice Normal, `row.Level = 3`, `Exp/Lvl = 105`), `Game.exe` initializes `dwExperience = (35 + 1) * 35 * 35 * 105 = 4,630,500`. On `.d2s` reload, `(nextLvl + 1) * nextLvl * nextLvl * row.ExpPerLvl` reaches `4,630,500` at `nextLvl = 35` and stops before `nextLvl = 36` (`37 * 36 * 36 * 105 = 5,034,960`), while re-querying `#11156` inside the loop switches brackets at `L36` (`row.Level = 36`) and `L67` (`row.Level = 67`).

### 2.3 `D2GAME_MERCS_SetStats_6FC68BA0` (`0x6FC68BA0..0x6FC68F9D`)
With `row = D2Common_11156(bExpansion, subTypeId, mercLevel)` and `delta = max(0, mercLevel - row.Level)`:
- `STAT_LEVEL (12) = mercLevel`
- `STAT_EXPERIENCE (13) = max(dwExperience, (mercLevel + 1) * mercLevel * mercLevel * row.ExpPerLvl ? ... : kept from save)` (on load, `STAT_EXPERIENCE` is set to saved `dwExperience`, `STAT_NEXTEXP (14)` is unused/0 in `t1` dump).
- `STAT_STRENGTH (0) = max(10, row.Str + trunc((delta * row.StrPerLvl) / 8))` (`0x6FC68CE2`)
- `STAT_ENERGY (1) = 0`, `STAT_VITALITY (3) = 0`, `STAT_MANA..STAT_MAXSTAMINA (8..11) = 0`
- `STAT_DEXTERITY (2) = max(10, row.Dex + trunc((delta * row.DexPerLvl) / 8))` (`0x6FC68D0E`)
- `STAT_MAXHP (7) = max(0x2800 /* 40 << 8 */, (row.HP << 8) + ((row.HPPerLvl << 8) * delta))` (`0x6FC68CA5`)
- `STAT_HITPOINTS (6) = STAT_MAXHP` (on fresh hire/load; clamped to `[256, maxhp]` on level-up)
- `STAT_HPREGEN (74) = max(0, trunc(STAT_MAXHP / 2000))` (`0x6FC68DC5`: `imul 0x10624dd3; sar 9` = signed `/ 2000` on 8.8 fixed `maxhp`; e.g. `85248 / 2000 = 42` -> `+42/256` HP/frame!)
- `STAT_ARMORCLASS (31) = max(0, row.Defense + delta * row.DefPerLvl)` (`0x6FC68D3A`)
- `STAT_TOHIT (19) = max(0, row.AR + delta * row.ARPerLvl)` (`0x6FC68D62`)
- `STAT_SECONDARY_MINDAMAGE (23) = max(0, row.DmgMin + trunc((delta * row.DmgPerLvl) / 8))` (`0x6FC68D8E`)
- `STAT_SECONDARY_MAXDAMAGE (24) = max(1, row.DmgMax + trunc((delta * row.DmgPerLvl) / 8))` (`0x6FC68DBA`)
- `STAT_FIRERESIST / LIGHTRESIST / COLDRESIST / POISONRESIST (39, 41, 43, 45) = max(0, row.Resist + trunc((delta * row.ResistPerLvl) / 4))` (`0x6FC68E10..0x6FC68E75`, before difficulty penalty)
- **Skills (`0x6FC68EA0..0x6FC68F60`)**: For `i = 0..5` with `row.Skill[i] > 0`:
  `slvl = min(32, row.Level_[i] + ((delta * row.LvlPerLvl[i]) >> 5))` (`0x6FC68EE8`).

> **TS Implementation**: [`resolveHirelingRecord113c`](../../src/common/units/hireling-table.ts), [`resolveHirelingLevelFromExp113c`](../../src/common/units/hireling-table.ts), [`computeMercSetStats113c`](../../src/common/units/hireling-table.ts).

---

## 3. `AITHINK_Fn057_Hireable` (`0x6FC3DD40`) & `AIMERC_HireablePetMove` (`0x6FC3D3C0`)

### 3.1 `AITHINK_Fn057_Hireable` (`0x6FC3DD40..0x6FC3E139`)
1. **Owner check (`0x6FC3DD53..0x6FC3DE36`)**: Resolves live owner player; if missing or dead (`owner.mode == 0` or `17`), plays vocalization (`5` for `hcIdx == 271`, else `6`), calls `AI_Stall(10)` (`0x6FD122C0`), and returns.
2. **Unhide (`0x6FC3DE39..0x6FC3DE4D`)**: If `STATES_CheckState(pMerc, STATE_HIDE = 12)` is non-zero, clears state `12`.
3. **Moving guard (`0x6FC3DE4F..0x6FC3DE62`)**: Reads `mercMode = pMerc->dwAnimMode`. If `mercMode == MONMODE_WALK (2)` or `MONMODE_RUN (15)`, returns immediately (**0 RNG draws**). When a walk/run path finishes in `MONSTER_StepPath`, `pMerc` switches to `MONMODE_NEUTRAL (1)` and runs `AITHINK_Fn057_Hireable` on that same frame.
4. **Distance thresholds (`0x6FC3DE68..0x6FC3DEA0`)**: Reads `p1 = pAiParam->pMonStatsAiParam1` (`aip1`, `0` for all vanilla mercenaries):
   - If `16 < p1 < 20`: `midDist = p1`, `farDist = 2 * p1`, `orbitBase = p1 >> 1`.
   - Else (all vanilla mercenaries): **`farDist = 24` (`0x18`), `midDist = 16` (`0x10`), `orbitBase = 5` (`0x05`)**.
5. **Leash & Owner-Follow Checks (`0x6FC3DEA1..0x6FC3DF47`)**:
   `ownerDist = AI_GetUnitSizeDistance(pMerc, pOwner)` (`0x6FCD0A20`):
   - `ownerDist > 100` (`0x6FC3DEA9`): `AIMERC_HireablePetMove(pMerc, pGame, pOwner, state = 3, 0, 0, 0)` and return.
   - `ownerDist > 24` (`0x6FC3DED4`): `AIMERC_HireablePetMove(pMerc, pGame, pOwner, state = 1, isRun = 1, velBonus = 60, 0)` and return.
   - `ownerDist > 16` (`0x6FC3DEF7`):
     - If `owner.mode == PLRMODE_WALK (2)` or `PLRMODE_TOWNWALK (6)`: `AIMERC_HireablePetMove(..., state = 0, isRun = 0, velBonus = 0, 0)` and return.
     - If `owner.mode == PLRMODE_RUN (3)`: `AIMERC_HireablePetMove(..., state = 0, isRun = 1, velBonus = 60, 0)` and return.
6. **Non-Neutral guard (`0x6FC3DF4A..0x6FC3DF8C`)**: If `mercMode != MONMODE_NEUTRAL (1)`, frees pending type-2 AI events, calls `AI_Stall(5)`, and returns.
7. **Crowded check (`0x6FC3DF8F..0x6FC3E016`)**:
   - Tests `D2Common_10851(pRoom, x, y, unitSize, COLLIDE_PET = 0x40)` (`0x6FC2AC6A`).
   - If non-zero: sets `bCrowded = 1`; rolls `(SEED_RollRandomNumber(&pMerc->tSeed) & 0x7F) < ((hcIdx == 338 || hcIdx == 560 || hcIdx == 561) ? 6 : 12)` (**1 RNG draw**). If true, calls `AI_IdleWander(pGame, pMerc, range = 5)` (`0x6FD11B10`, **4 RNG draws**) and returns.
8. **Combat Target Scan (`0x6FC3E019..0x6FC3E069`)**:
   - If `!DUNGEON_IsTownLevelId(levelId)` (`0x6FC2A808`): calls `AI_FindNearestTarget` (`0x6FCD1BC0`, search cap `aidist` or `35`).
   - If a target is found with `targetDist < 25` (`0x6FC3E043: cmp [esp+0x18], 0x19; jae skip`): calls `AIMERC_EngageTarget` (`0x6FC3C8A0`) and returns.
9. **Deferred Crowded Wander (`0x6FC3E06C..0x6FC3E084`)**: If `bCrowded != 0`, calls `AI_IdleWander(pGame, pMerc, 5)` and returns.
10. **Zone / Sub-Room Mismatch (`0x6FC3E087..0x6FC3E0DD`)**:
    - Compares `D2Common_10916(ownerRoom, ownerX, ownerY)` vs `D2Common_10916(mercRoom, mercX, mercY)` (`0x6FD8C6D0 -> 0x6FDD19C0`, returning `D2RoomCoordListStrc.nIndex` via `sub_6FD77110` — e.g. triggering the `F0151` sub-room catch-up inside Rogue Encampment when the Paladin crosses an internal POPS/coord-list boundary).
    - If different: calls `AIMERC_HireablePetMove(..., state = 0, isRun = 1, velBonus = 60, 0)` and returns.
11. **Close / Idle Reposition (`0x6FC3E0E0..0x6FC3E137`)**:
    - Recomputes `ownerDist = AI_GetUnitSizeDistance(pMerc, pOwner)`:
    - If `ownerDist <= 1` (`0x6FC3E0E8`): calls `AIMERC_HireablePetMove(..., state = 5, 0, 0, orbitRad = orbitBase - 1 /* 4 */)` and returns.
    - Else (`ownerDist > 1`): calls `SEED_RollLimitedRandomNumber(&pMerc->tSeed, 100)` (`0x6FC3E115`, **1 RNG draw**):
      - If `>= 5` (`95%`): jumps to `0x6FC3DF78` -> `AI_Stall(5)`.
      - If `< 5` (`5%`): calls `AIMOV_WalkAroundTarget(pOwner, pGame, pMerc, radius = midDist /* 16 */)` (`0x6FD12870`, **4 RNG draws**) and returns.

### 3.2 `AIMERC_HireablePetMove` (`0x6FC3D3C0..0x6FC3DB3B`) & `AIMOV_WalkAroundTarget` (`0x6FD12870`)
Jump table at `0x6FC3DB24` (`finalX = PATH_GetTargetX(pOwner->pPath)`, `finalY = PATH_GetTargetY(pOwner->pPath)`):
- **`state = 0` (`0x6FC3D408` — Project Ahead of Owner)**:
  - Computes `dir8 = D2Common_10266(D2Common_10192(pOwner, finalX, finalY))` and iterates `8` octants via `0x6FD1CEE0` (`[4, 3, 2, 1, 0, 7, 6, 5]`), projecting `(tx, ty) = (finalX + dx[d] * 8, finalY + dy[d] * 8)`.
  - Notice that in `Hireable` `state 0` (`0x6FC3D4E5`), **both** `isRun == 0` and `isRun == 1` pass **`nMode = MONMODE_WALK (2)`** (`push 2` at `0x6FC3D4E5`!) with `ovVelocity = velBonus` (`+60` when `isRun == 1`), `ovNewDist = 40` (`0x28`), `stepNum = 1`, `flags = 4`! (If `(tx, ty)` fails, falls back to `AI_IdleWander(4)` after all 8 octants.)
- **`state = 1` (`0x6FC3D55D` — Breadcrumb Trail Run/Walk)**:
  - If `owner.mode == PLRMODE_WALK (2)`: sets `ovNewDist = 77` (`0x4D`), walks (`MONMODE_WALK`) to `(finalX, finalY)`.
  - Else: if `velBonus == 0`, rolls `velBonus = rollLimited(mercSeed, 15) + 50` (**1 RNG draw**). Scans backward `20` slots through `pPlayerData->tHistoryPos` (`0x6FC99BF0`: updated when `dx^2 + dy^2 > 45` and `>= 1` tick elapsed, or on player warp `0x6FD01B07`): for the first `(hx, hy)` with `dist(merc, hx, hy) > 5`, tries `PATHTYPE_TOWARD_FINISH (13)` (`MONMODE_WALK`), then `PATHTYPE_WALL_FOLLOW (15)` (`isRun ? MONMODE_RUN : MONMODE_WALK`), then `PATHTYPE_IDASTAR (1)` once; fallback `AI_IdleWander(max(4, ownerDist >> 2))` with `ovVelocity = 15`.
- **`state = 3` (`0x6FC3D8D4` — Leash Teleport)**:
  - `D2GAME_FindFreeCoords` + `SUNIT_WarpUnit` near `(ownerX, ownerY)`, then `AI_Stall(5)`.
- **`state = 5` (`0x6FC3DA56` — Step Off Owner)**:
  - Sets `ovPathType = 7` (`PATHTYPE_STRAIGHT`), calls `AIMOV_WalkAroundTarget(pOwner, pGame, pMerc, radius = orbitRad /* 4 */)` (`0x6FD12870`); if blocked, tries `AI_WalkAwayFrom(pOwner, orbitRad, 1)` (`0x6FD12D80`), then walks to `(finalX, finalY)` (`ovNewDist = 40`).
- **`AIMOV_WalkAroundTarget(pCenter, pGame, pUnit, radius)` (`0x6FD12870..0x6FD1299E`)**:
  - Consumes **4 RNG draws** on `pUnit->tSeed` (identical draw pattern to `AI_IdleWander`, but centered on `(centerX, centerY)` instead of `(unitX, unitY)`!):
    1. `s1 = SEED_RollRandomNumber(seed)`: if `(s1 & 1) != 0`, `dx = radius, dy = rollLimited(seed, radius)`; else `dx = rollLimited(seed, radius), dy = radius`.
    2. If `(SEED_RollRandomNumber(seed) & 1) != 0`, `dx = -dx`.
    3. If `(SEED_RollRandomNumber(seed) & 1) != 0`, `dy = -dy`.
  - Calls `AI_ApproachTarget(pGame, pUnit, NULL, MONMODE_WALK (2), centerX + dx, centerY + dy, 1, 0)`.

---

## 4. `AIMERC_EngageTarget` (`0x6FC3C8A0`) & `AIMERC_ChooseSkill` (`0x6FC3C4E0`)

### 4.1 `AIMERC_EngageTarget` (`0x6FC3C8A0..0x6FC3CACB`)
1. **Engage probability (`0x6FC3C8BD..0x6FC3C8FE`)**:
   - Melee mercenaries (`hcIdx == 338 || hcIdx == 560 || hcIdx == 561`): `engagePct = 98` (`0x62`).
   - Ranged mercenaries (`hcIdx == 271` Rogue Scout, `hcIdx == 359` Iron Wolf):
     `engagePct = min(95, aip1 + 40 + 2 * mercLevel)` (`0x5F`; at `mercLevel >= 28`, `engagePct = 95`).
2. **Action roll (`0x6FC3C943..0x6FC3C988`)**:
   - `canAct = (SEED_RollRandomNumber(&pMerc->tSeed) % 100) < engagePct` (**1 RNG draw**, unsigned `div 100` at `0x6FC3C963`).
   - Resets `pAiGeneral->dwIdleCounter = 0` on success, else `+= 10`.
3. **Ranged vs Melee Dispatch (`0x6FC3C98E..0x6FC3CAC4`, `MonStats.aip1[diff] == 0` for `271`/`359`, non-zero for `338`/`560`/`561`)**:
   - **Ranged (`aip1 == 0`, `0x6FC3C905..0x6FC3CA4A`)**:
     - Recomputes **`targetDist = UNIT_GetSizeSubtractedOctileDist(pMerc, pTarget)` (`0x6FC3C905 -> 0x6FCD0A20`)** — note that `AITHINK_Fn057_Hireable` at `0x6FC3E03A` gates `< 25` on center-to-center octile distance (`0x6FCD08F0`), whereas `AIMERC_EngageTarget` subtracts unit footprints (`size 2 + size 2` -> `-2`, e.g. center dist `5` becomes `3 < 4` on `F1082`)!
     - If `targetDist < 4` (`0x6FC3C9A6`): rolls `(SEED_RollRandomNumber(&pMerc->tSeed) % 100) < 50` (**1 RNG draw** at `0x6FC3C9CB`). If `< 50`, attempts kite step `AIMOV_WalkAroundTarget(pOwner, pGame, pMerc, 4)` (`ecx = pOwner` at `0x6FC3C9D2`, **4 RNG draws**) -> fallback `AI_WalkAwayFrom(pTarget, 4, 1)`, returning immediately if a path started (`0x6FC3C9E1` / `0x6FC3CA19`), or proceeding straight to `AIMERC_ChooseSkill` if both kite paths failed (`0x6FC3CA1F`)!
     - If `!canAct`: calls `AI_Stall(10)` and returns.
     - Else: calls `AIMERC_ChooseSkill` (`0x6FC3C4E0`).
   - **Melee (`aip1 != 0`, `0x6FC3CA4B`)**:
     - If `targetDist < 3` and `COLLISION_CheckLineOfSight(pMerc, pTarget, 0)` is clear: if `canAct`, calls `AIMERC_ChooseSkill`, else `AI_Stall(10)`.
     - Else: sets `PATH_SetNewDistance(pMerc->pPath, MonStats2.MeleeRng)` and calls `AI_ApproachTarget(pGame, pMerc, pTarget, MONMODE_RUN (15), 0, 0, 1, 1)`.

### 4.2 `AIMERC_ChooseSkill` (`0x6FC3C4E0..0x6FC3C89B`)
1. Looks up `row = D2Common_11156(bExpansion, subTypeId, mercLevel)` and `delta = max(0, mercLevel - row.Level)`.
2. Accumulates cumulative weights `cum[0..5]` starting from `total = row.DefaultChance`:
   - For slot `i = 0..5` (`skillId = row.Skill[i] > 0`):
     - Requires `slvl > 0`.
     - If `Skills[skillId].bAura == 1` (`+0x230 == 1`) and `STATES_CheckState(pMerc, Skills[skillId].nAuraState)` is already active: `cum[i] = 0`, skip (`0x6FC3C5D8..0x6FC3C60B`).
     - If `skillId == 41` (`Inferno`) and `dist(pMerc, pTarget) > (slvl >> 1) + 4`: `cum[i] = 0`, skip (`0x6FC3C60D..0x6FC3C641`).
     - `w = row.Chance[i] + trunc((delta * row.ChancePerLvl[i]) / 4)` (`cdq; and edx, 3; add eax, edx; sar ecx, 2` at `0x6FC3C64E..0x6FC3C65E`).
     - `total += w; cum[i] = total`.
3. **Inclusive Roll (`0x6FC3C682..0x6FC3C6C7`)**:
   - `pick = SEED_RollLimitedRandomNumber(&pMerc->tSeed, total + 1)` (`inc ecx` at `0x6FC3C686`, **1 RNG draw**, range `0..total` inclusive!).
4. **Selection (`0x6FC3C6CB..0x6FC3C89B`)**:
   - If `pick < row.DefaultChance`:
     - `hcIdx == 271` (`0x6FC3C7BE`): calls `AI_UseSkill(pGame, pMerc, mode = MonStats[271].Sk1mode /* 4 */, skillId = MonStats[271].Skill1 /* 6 Magic Arrow / bow shot */, pTarget, 0, 0)` (`0x6FD12380`).
     - `hcIdx == 338, 359, 560, 561` (`0x6FC3C804`): if LOS clear, starts `MONMODE_ATTACK1 (4)` on `pTarget`, else `AI_Stall(10)`.
   - Else (`pick >= row.DefaultChance`):
     - Picks slot `0` if `pick <= cum[0]` (`0x6FC3C6DA: cmp edx, eax; jle 0x6FC3C6FB`), else first `i` in `1..5` with `pick <= cum[i]` (`0x6FC3C6EE`).
     - If aura skill (`Skills[skillId].dwFlags & 0x01` aura/immediate): activates aura (`0x6FCC2100`) and calls `AI_Stall(10)`.
     - Else: calls `AI_UseSkill(pGame, pMerc, row.Mode[i], skillId, pTarget, 0, 0)` (`0x6FD12380`).

> **TS Implementation**: [`chooseMercSkill113c`](../../src/common/units/hireling-table.ts), [`stepOracleHireableMerc113c`](../../src/server/engine/game-instance/hireable-ai-113c.ts).

---

## 5. Rogue Scout Skill Execution & Missile Seeds (`A1` Mode `4`)

- **Animation Timing (`AnimData.d2` `RGA1BW` / `0x6FC95E10`)**:
  - Total frames = `15`, action frame = `6`.
  - Starting `MONMODE_ATTACK1 (4)` at frame `F` fires the skill action on `F + 6`, returns to `MONMODE_NEUTRAL (1)` on `F + 15`, and schedules the next AI think event on **`F + 16`** (`finishFrame + 1`, verified on `F0771 -> F0777 -> F0786 -> F0787` and `F1082 -> F1088 -> F1097 -> F1098`).
- **`#8 Inner Sight` (`SKILLS_SrvDo006`, `0x6FC6CA30`)**:
  - **0 RNG draws**. Scans hostile monsters within `Param5 = 20` subtiles, applies `STATE_INNERSIGHT (17)` (`STAT_ARMORCLASS` `-edmn`, duration `(Param3 + (slvl - 1) * Param4)` = `200 + (slvl - 1) * 100` frames) to each target without overriding an equal/stronger `Inner Sight`.
- **`#11 Cold Arrow` (`SKILLS_SrvDo110`, `0x6FC6B8E0`) & `#6 Magic Arrow` / Default Bow (`#1` `arrow`)**:
  - Allocates a server missile (`unitType = 3`): **1 `gameSeed` draw** (`missileSeed`), velocity `missileSpeedSubtilesPerFrame113c(Vel + trunc((VelLev * slvl) / 8))` (`16.16` fixed-point `(rawVel << 10) / 16` -> `1.5` subtiles/frame for `Vel = 24`), and non-piercing `CollideKill = 1` termination on first integer sub-tile footprint contact (`Math.round`, LIFO room unit order).
  - `D2Common #10413` (`0x6FDBBAA0`, `MISSILE_BuildStatsDamage`) rolls `SEED_RollLimitedRandomNumber(&pMerc->tSeed, 100)` unconditionally for the missile critical check (**1 `mercSeed` draw** on launch frame `F + 6`, verified on `F0777` `los=[1993401281]` and `F1088` `los=[747652009]`).
  - **Unarmed vs Armed Physical Damage (`#10413` `SrcDamage`)**: Newly Kashya-hired Rogue Scouts have no `pInventory` weapon equipped, so `STAT_MINDAMAGE` / `STAT_MAXDAMAGE` are `0` (unlike `MonStats` `A1MinD/A1MaxD`, which `MONSTER_RollChannelDamage` uses only for direct monster melee, NOT `#10413` `SrcDamage` missiles unless a bow item is equipped on the mercenary); thus unarmed `#11 Cold Arrow` deals `0` physical damage and `100%` skill cold damage (`eMin256 + rollLimited(&pMissile->tSeed, eMax256 - eMin256)` — exact span `max256 - min256`, NOT `+ 1`, verified on `F0782` `ret = 6272 + 243 = 6515` and `F1091` `ret = 6272 + 161 = 6433`).
  - On impact (`MISSMODE_SrvDmg01` `0x6FC594B0` -> `SUNITDMG`):
    1. `SUNITDMG_RollToHit` (`0x6FCFDE90`): **1 `mercSeed` draw** (`rollLimited(100)`, verified on `F0782` `los=[1385079289]` and `F1091` `los=[4079218123]`).
    2. Weapon/elemental damage settlement (`SUNITDMG_FillPacket`) includes active party aura bonuses on `pMerc` (`#113 Concentration` `+225% ED / +145% AR` at `slvl 12`; `#122 Fanaticism` `+101% ED` ally bonus at `slvl 10`).
    3. Lethal cold hit order (`SUNITDMG_ExecuteEvents` `0x6FCFD750` -> `MONSTER_ApplyDeath` `0x6FC66640`): when `coldDmg256 > 0` kills a normal monster, `SEED_RollLimitedRandomNumber(&pDefender->tSeed, 100) < 20` (**Draw 1**, cold-shatter check) executes **before** `TREASURE_DropItem` (**Draw 2**, `NoDrop` roll on `pDefender->tSeed`), verified on `zombie 10` (`F0782`: roll `92 >= 20`, then `NoDrop`) and `zombie 12` (`F1091`), and `MONSTER_ApplyDeath` clears timed `STATE_INNERSIGHT (17)` (`F1091`: `[1, 12, 17, 105] -> [1, 12, 105]`).
    4. Experience award (`0x6FCFC030`): mercenary receives killer share (`+2` XP on L1 Blood Moor zombie at L35/L40), owner receives party share (`+1` XP).

---

## 6. Paladin Radial Party Auras onto Mercenary (`AURA_RadialPulse` `0x6FCC0C70`)

- Every `perdelay` frames (`Skills.txt` `perdelay = 50` frames for `#113 Concentration`, `#122 Fanaticism`, `#98 Might`), `AURA_RadialPulse` (`0x6FCC0C70..0x6FCC0E75`) iterates allied units (`D2GAME_ForEachAllyInRadius`, `aurafilter = 0x12003` including `0x02` monsters/mercenaries/pets and `0x2000` town-room skip) within `aurarange` subtiles (`evaluateCalc(skill.auraRangeCalc)`).
- Applies `aurastate` (`States.txt`: `42` `concentration`, `49` `fanaticism`, `33` `might`) with grid-aligned duration `d * trunc((F + d - 1) / d) - F + 2` (`0x6FCBE970`), plus `aurastat1..6` bonuses (`#113` grants full `damagepercent` `ln34` and `skill_concentration` `par5` to allies; `#122` grants `ln56/2` half `damagepercent` + `attackrate` `dm34` + `item_tohit_percent` `toht` to allies while caster receives `passivestat1` self `damagepercent` `ln56`).
- Switching Paladin right-hand aura from `#113` to `#122` at `F1120` immediately replaces the caster's self aura state (`42 -> 49`), while the mercenary retains state `42` from the `F1101` pulse alongside newly pulsed state `49` (`st = [42, 49, 105]` on `F1120..F1151`) until `1101 + 51 = F1152` (`syncUnitStateTimerFromExpireFrame113c` marks the frame in `stateTimerAppliedFrame113c` whenever `StateBus` sync writes `expireFrame - currentFrame` so the later `stepMercenaries` / `stepMonsters` pass does not double-decrement `rem` on the same frame).

---

## 7. RNG Consumption Summary (`pMerc->tSeed` & `pGame->tSeed`)

| Site | Address | Seed | Condition | Draw Formula |
|---|---|---|---|---|
| `MERCS_CreateUnit` unit alloc | `0x6FCE1444` | `gameSeed` | On hire or `.d2s` join | `1` LCG step (`0x6FD00110`), then `mercSeed = { saveSeed, 666 }` |
| `MONSTER_ChooseOutfit` + `InitStats` | `0x6FCE148A` | `mercSeed` | On hire or `.d2s` join | `8` outfit draws + `1` HP draw (`9` total) |
| `Hireable` crowded check | `0x6FC3DFF9` | `mercSeed` | `#10851(0x40) != 0` | `stepLcg & 0x7F` (`1` draw; `+4` if `< 6/12`) |
| `Hireable` idle poll (`ownerDist > 1`) | `0x6FC3E115` | `mercSeed` | Every idle think (`5`f) | `rollLimited(100)` (`1` draw; `+4` in `WalkAroundTarget` if `< 5`) |
| `AIMOV_WalkAroundTarget` | `0x6FD1290D` | `mercSeed` | `state 5` / `< 5%` orbit / kite | `coin & 1`, `rollLimited(r)`, `signX & 1`, `signY & 1` (`4` draws) |
| `AIMERC_EngageTarget` `canAct` | `0x6FC3C963` | `mercSeed` | Hostile target `< 25` | `stepLcg % 100` (`1` draw) |
| `AIMERC_EngageTarget` ranged kite | `0x6FC3C9CB` | `mercSeed` | Ranged & `targetDist < 4` | `stepLcg % 100` (`1` draw; `+4` if `< 50`) |
| `AIMERC_ChooseSkill` slot roll | `0x6FC3C6A6` | `mercSeed` | `canAct == true` | `rollLimited(totalWeight + 1)` (`1` draw) |
| Merc missile spawn | `0x6FC6B8E0` | `gameSeed` + `mercSeed` | Arrow / Cold Arrow / Fire Arrow | `1` `gameSeed` alloc draw + `1` `mercSeed` `#10413` damage draw |
| `MISSMODE_SrvDmg01` missile hit | `0x6FC594B0` | `mercSeed` | Arrow collides with monster | `1` `mercSeed` `RollToHit(100)` draw (+ defender `GetHit` draw if applicable) |
