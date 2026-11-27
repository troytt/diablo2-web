# Diablo II v1.13c Server Kill Experience Pipeline (`D2Game.dll` `0x6FCFC030`)

## Overview
Authoritative reverse-engineering note for the v1.13c monster kill experience calculation, level-difference scaling tables, `Experience.txt` `ExpRatio`, `stat 85` (`item_addexperience`) & Experience Shrine (`state 137`), party experience distribution, and mercenary experience in `samples/d2/D2Game.dll` (image base `0x6FC20000`) and `samples/d2/D2Common.dll` (image base `0x6FD50000`).

## Function Map (`D2Game.dll`)
| Address | Symbol / Role | Summary |
|---|---|---|
| `0x6FCFA9E0` | `SUNITDMG_ApplyExpRatio` | Multiplies `exp` by `Experience.txt` `ExpRatio[clvl]` and shifts right by row 0's `ExpRatio` (`10`, i.e., `/ 1024`). Returns `0` when `exp <= 0` (no `Math.max(1)` floor). |
| `0x6FCFAA40` | `SUNITDMG_ComputeLevelDiffExp` | Applies character vs. monster level-difference scaling using `.rdata` `0x6FD1A01C` (`clvl >= mlvl`), `.rdata` `0x6FD1A048` (`clvl < 25 && mlvl > clvl`), or `exp * clvl / mlvl` (`clvl >= 25 && mlvl > clvl`). |
| `0x6FCFB6B0` | `SUNITDMG_ClampMercenaryExpGain` | Caps single-kill mercenary experience to `(D2Common_10448(mercLvl + 1, expPerLvl) - D2Common_10448(mercLvl, expPerLvl)) >>> 6`. |
| `0x6FCFC030` | `SUNITDMG_CalculateExperienceGain` | Full per-kill experience pipeline for players (`unitType == 0`) and mercenaries (`unitType == 1`). |
| `0x6FCFDCB0` | `SUNITDMG_AddMercenaryExperience` | Adds experience to `STAT_EXPERIENCE` (`13`) on a mercenary and levels up while `mercLvl < ownerLvl` and `mercLvl < 98`. |
| `0x6FCFDCF0` | `SUNITDMG_AddPlayerExperience` | Adds experience to `STAT_EXPERIENCE` (`13`) on a player, clamps at `D2Common_10786(classId, 98)` (`3,520,485,254`), and levels up via `0x6FCFDBB0`. |
| `0x6FCFAED0` | `SUNITDMG_PartyExpCallback` | Collects living same-party members in the same level within `dx^2 + dy^2 <= 0x1900` (`6400`, `80` sub-tiles, `0x6FCFAFCA: cmp eax, 0x1900; ja 0x6FCFB024`), up to `8` members (`0x6FCFAFD8: cmp [esi+0x44], 8`). |
| `0x6FCFE8F0` | `SUNITDMG_DistributeExperience` | Party experience pool (`baseExp + ((baseExp * (N - 1) * 89) >> 8)`) and level-proportional split (`trunc(memberLvl * (float(pool) / float(sumLvls)))`) across members collected by `0x6FCFAED0`. |
| `0x6FCFEA00` | `SUNITDMG_AddExperienceForKill` | Orchestrates mercenary experience (`100%` on merc kill, `trunc(exp * 86 / 256)` on player/pet kill) and solo/party player experience. |
| `0x6FC57F80` | `PLAYER_DropGoldPile` | Spawns a ground `'gld'` item at `pPlayer`'s coordinates with `STAT_GOLD (14) = nGold` when `nGold > 0`. |
| `0x6FC58180` | `PLAYER_ApplyDeathGoldPenalty` | Applies `min(clvl, 20)%` gold penalty to `STAT_GOLD (14) + STAT_GOLDBANK (15)`, dropping remaining carried gold (or PK loot) on the ground and deducting any shortfall from stash gold. |
| `0x6FC583A0` | `PLAYER_ApplyDeathPenalties` | Orchestrates corpse creation (`0x6FC58090`), death gold penalty (`0x6FC58180`), and non-PK death experience penalty (`0x6FC57730`). |

## 1. Level-Difference Tables (`0x6FCFAA40`)
`SUNITDMG_ComputeLevelDiffExp(eax = clvl, ecx = mlvl, [esp+4] = exp)` uses two distinct 11-entry `int32` tables (`/ 256`) in `.rdata`:

1. **`clvl >= mlvl` (`0x6FD1A01C`, `diff = Math.min(10, clvl - mlvl)`)**:
   ```text
   [256, 256, 256, 256, 256, 256, 207, 159, 110, 61, 13]
   ```
   (`100%, 100%, 100%, 100%, 100%, 100%, 81%, 62%, 43%, 24%, 5%`)
2. **`clvl < 25 && mlvl > clvl` (`0x6FD1A048`, `diff = Math.min(10, mlvl - clvl)`)**:
   ```text
   [256, 256, 256, 256, 256, 256, 225, 174, 92, 38, 5]
   ```
   (`100%, 100%, 100%, 100%, 100%, 100%, 88%, 68%, 36%, 15%, 2%`)
3. **`clvl >= 25 && mlvl > clvl` (`0x6FCFAA8D`)**:
   ```text
   Math.floor((exp * clvl) / mlvl)
   ```

## 2. Full `SUNITDMG_CalculateExperienceGain` Pipeline (`0x6FCFC030`)
1. **Input Clamp & Non-Positive Guard (`0x6FCFC03A..0x6FCFC051`)**:
   - If `rawExp > 0x7FFFFF` (`8,388,607`), clamp to `0x7FFFFF`.
   - Else if `rawExp <= 0`, return `1`.
2. **Max Level Guard (`0x6FCFC053..0x6FCFC069`)**:
   - For players (`unitType == 0`), queries `D2Common_10628_GetMaxLevel(classId)` (`99`); if `clvl >= 99`, returns `0`.
3. **Level-Difference Scaling (`0x6FCFC088`)**:
   - `exp = SUNITDMG_ComputeLevelDiffExp(clvl, mlvl, exp)` (`0x6FCFAA40`).
4. **`ExpRatio` Scaling (`0x6FCFC090`)**:
   - `exp = SUNITDMG_ApplyExpRatio(exp, clvl)` (`0x6FCFA9E0`, `(exp * ExpRatio[clvl]) >> 10`).
5. **Signed `STAT_ITEM_ADDEXPERIENCE` (`stat 85`, `0x6FCFC099..0x6FCFC0B0`)**:
   - Reads signed `stat 85` via `D2Common_10519_GetStatSigned(pUnit, 85, 0)`.
   - If `stat85 != 0`: `exp += Math.trunc((exp * stat85) / 100)` (`0x6FC214D0`).
   - Negative `stat 85` values reduce experience gain; Experience Shrine (`state 137`) adds `+50` directly to `stat 85` via `0x6FD1A600` / `0x6FC8ABB0`, so shrine and item bonuses (`Annihilus`, `Ondal's Wisdom`) are additive inside `stat 85`.

## 3. Shrine Booster Table (`0x6FD1A600`)
Each 12-byte entry at `0x6FD1A5F8 + code * 12` (`Shrines.txt` `Code 6..15`) contains `{ pfnEffect, statId, stateId }`:
- Code 6 (Armor): `0x6FC8ABB0`, `stat 171` (`skill_armor_percent` = `100`), `state 128` (`shrine_armor`)
- Code 7 (Combat): `0x6FC8ACE0`, `stat 119` (`item_tohit_percent` = `200`) + `stat 25` (`damagepercent` = `200`), `state 129` (`shrine_combat`)
- Code 8 (Resist Fire): `0x6FC8ABB0`, `stat 39` (`fireresist` = `75`), `state 131` (`shrine_resist_fire`)
- Code 9 (Resist Cold): `0x6FC8ABB0`, `stat 43` (`coldresist` = `75`), `state 132` (`shrine_resist_cold`)
- Code 10 (Resist Lightning): `0x6FC8ABB0`, `stat 41` (`lightresist` = `75`), `state 130` (`shrine_resist_lightning`)
- Code 11 (Resist Poison): `0x6FC8ABB0`, `stat 45` (`poisonresist` = `75`), `state 133` (`shrine_resist_poison`)
- Code 12 (Skill): `0x6FC8AB60`, `stat 127` (`item_allskills` = `2`), `state 134` (`shrine_skill`)
- Code 13 (Mana Recharge): `0x6FC8ABB0`, `stat 27` (`manaregeneration` = `400`), `state 135` (`shrine_mana_regen`)
- Code 14 (Stamina): `0x6FC8AC30`, refills `stat 10` (`stamina`) to `stat 11` (`maxstamina`) and sets `stat 162` (`item_staminadrainpct`), `state 136` (`shrine_stamina`)
- Code 15 (Experience): `0x6FC8ABB0`, `stat 85` (`item_addexperience` = `50`), `state 137` (`shrine_experience`)

## 4. Player Death Gold & Experience Penalties (`0x6FC583A0`, `0x6FC58180`, `0x6FC57730`)
1. **`PLAYER_ApplyDeathGoldPenalty` (`0x6FC58180`)**:
   - Reads `clvl = STAT_LEVEL (12)`, `gold = STAT_GOLD (14)`, and `bank = STAT_GOLDBANK (15)`.
   - `pct = Math.min(clvl, 20)` (`0x6FC581B3..0x6FC581BD`).
   - `total = gold + bank`, `loss = Math.trunc((total * pct) / 100)` (`0x6FC581AA..0x6FC581E5`).
   - If `pGame->nGameType == 3` (`[pGame + 0x6A] == 3`, `0x6FC5822E..0x6FC58250`):
     - Floor protection `floorGold = clvl * 500`: if `total - loss < floorGold`, `loss = Math.max(0, total - floorGold)`.
     - Caps `loss = Math.min(loss, gold)` and skips stash deduction (`0x6FC58313`).
   - **PK branch (`0x6FC58256..0x6FC582E7`, killer is another player or player-owned pet)**:
     - If `loss > gold`, deducts `loss - gold` from `STAT_GOLDBANK (15)` (`Math.max(0, bank - (loss - gold))`) and zeroes `STAT_GOLD (14)`; else subtracts `loss` from `STAT_GOLD (14)`.
     - Calls `PLAYER_DropGoldPile(pGame, pVictim, loss)` (`0x6FC57F80`) to drop `loss` on the ground.
   - **Non-PK branch (`0x6FC582E9..0x6FC58360`, monster / trap / environment)**:
     - If `loss <= gold`: calls `PLAYER_DropGoldPile(pGame, pVictim, gold - loss)` (`0x6FC57F80`) to drop the remaining carried gold on the ground; `STAT_GOLDBANK (15)` is unchanged.
     - If `loss > gold` (and `nGameType != 3`): deducts the shortfall from stash via `D2Common_10517_SetStat(pVictim, 15, Math.max(0, bank - (loss - gold)), 0)`; no gold is dropped on the ground.
     - Unconditionally zeroes carried gold: `D2Common_10517_SetStat(pVictim, 14, 0, 0)` (`0x6FC5834A..0x6FC58360`).
   - Records `Math.max(0, loss)` in stat `0xAF` (`175`, `0x6FC58365..0x6FC58391`).
2. **`PLAYER_ApplyDeathExpPenalty` (`0x6FC57730`)**:
   - Skipped when killed by a player or player-owned pet (`0x6FC583AD..0x6FC583E3`), or when `clvl <= 1` or `DeathExpPenalty <= 0`.
   - Deducts `Math.trunc(((ExpThreshold(clvl) - ExpThreshold(clvl - 1)) * DeathExpPenalty) / 100)`, clamped at `ExpThreshold(clvl - 1) + 1`.

## 5. Mercenary Experience & Level-Up Pipeline (`0x6FCFEA00` -> `0x6FCFC030` -> `0x6FCFB6B0` -> `0x6FCFDCB0` -> `0x6FC68BA0`)

1. **`EXP_AwardExperience` (`D2Game.dll` `0x6FCFEA00`, merc block `0x6FCFEA61..0x6FCFEB39`)**:
   - Runs **before** the party player experience loop (`0x6FCFEB3E..0x6FCFEB92`).
   - Resolves the killer's active living hireling (`PLAYERPETS_GetMercUnit` `0x6FC7E8B0`, skipping dead mode `0` or `12`).
   - Computes `mercCalcExp = SUNITDMG_CalculateExperienceGain(pGame, pMerc, pOwner, mercLevel, monsterLevel, rawMonsterExp)` (`0x6FCFC030`).
   - Inside `0x6FCFC030` (`0x6FCFC07B..0x6FCFC0A7`):
     - Max mercenary level is `98` (`0x62` at `0x6FCFC07B`: `if (mercLevel >= 98) return 0`).
     - Applies level-difference scaling (`0x6FCFAA40`), `ExpRatio` (`0x6FCFA9E0`), and signed `stat 85` (`item_addexperience`, `0x6FCFC08E..0x6FCFC099`).
     - Calls `SUNITDMG_ClampMercExp` (`0x6FCFB6B0`) to cap single-kill experience gain to `1/64` of the current level span (`(Threshold(mercLevel + 1) - Threshold(mercLevel)) >> 6`).
   - At `0x6FCFEB1B..0x6FCFEB2C`:
     - If `pAttacker == pMerc` (mercenary landed the killing blow): `expGain = mercCalcExp` (`100%`).
     - Otherwise (owner or summoned pet landed the killing blow): `expGain = (mercCalcExp * 86) >> 8` (`floor(mercCalcExp * 86 / 256)`, ~`33.59%`).
   - Calls `SUNITDMG_AddMercExperience(pGame, pOwner, pMerc, mercLevel, expGain)` (`0x6FCFDCB0`).

2. **`D2Common_10448` (`0x6FD7C990`) & `D2Common_10458` (`0x6FD7CCC0`) — `Hireling.txt` `Exp/Lvl` Threshold Formula**:
   - `Hireling.txt` column `Exp/Lvl` (`offset +0x2C` in `D2HirelingTxt`, e.g., `100..155`).
   - Cumulative experience threshold to reach `level` (`level >= 1`):
     $$\text{Threshold}(\text{level}, \text{expPerLvl}) = (\text{level} + 1) \times \text{level}^2 \times \text{expPerLvl}$$
   - `SUNITDMG_ClampMercExp` (`0x6FCFB6B0`):
     $$\text{maxGain} = \left(\text{Threshold}(\text{mercLevel} + 1) - \text{Threshold}(\text{mercLevel})\right) \gg 6$$

3. **`SUNITDMG_AddMercExperience` (`D2Game.dll` `0x6FCFDCB0`)**:
   - Reads `currentExp = D2Common_10519_GetUnitBaseStat(pMerc, STAT_EXPERIENCE (13), 0)`.
   - Guards (`0x6FCFDD10..0x6FCFDD3B`): if `mercLevel >= ownerLevel` or `mercLevel >= 98`, returns immediately **without adding experience**.
   - Doubles the experience gain (`0x6FCFDD24`: `lea edi, [ebx + edi*2]`, `newExp = currentExp + expGain * 2`) and writes `STAT_EXPERIENCE (13) = newExp`.
   - Level-up loop (`0x6FCFDD4D..0x6FCFDD9D`): increments `newLevel` while `newLevel < 98`, `newLevel < ownerLevel`, and `newExp >= Threshold(newLevel + 1, expPerLvl)`.
   - On level-up (`newLevel > mercLevel`): calls `MERCS_SetStats(pGame, pOwner, pMerc, newLevel)` (`0x6FC68BA0`), recomputing `Hireling.txt` stats (`HP`, `Damage`, `AR`, `Defense`, `Resist`, skills/auras) and healing `STAT_HITPOINTS (6) = STAT_MAXHP (7)`.


