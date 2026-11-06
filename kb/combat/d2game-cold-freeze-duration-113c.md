# D2Game 1.13c Cold & Freeze Duration Mechanics (`SUNITDMG_ApplyCold` / `SUNITDMG_ApplyFreeze`)

## Ground Truth Sources
- `samples/d2/D2Common.dll` (1.13c, image base `0x6FD50000`)
- `samples/d2/D2Game.dll` (1.13c, image base `0x6FC20000`)
- `samples/d2/excel/DifficultyLevels.txt`
- `samples/d2/excel/Skills.txt`
- `samples/d2/excel/Missiles.txt`
- `samples/d2/excel/MonStats.txt`

## 1. `DifficultyLevels.txt` Binary Struct Layout (`D2Common.dll` `0x6FDB03F0`)

`DATATBLS_LoadDifficultyLevelsTxt` (`0x6FDB03F0`) maps `DifficultyLevels.txt` columns to 4-byte `int32` struct fields (`type = 2`):

| Struct Offset | Column Name | Normal (`0`) | Nightmare (`1`) | Hell (`2`) |
|---|---|---|---|---|
| `+0x00` | `ResistPenalty` | `0` | `-40` | `-100` |
| `+0x04` | `DeathExpPenalty` | `0` | `5` | `10` |
| `+0x14` | `MonsterFreezeDivisor` | `1` | `2` | `4` |
| `+0x18` | `MonsterColdDivisor` | `1` | `2` | `4` |
| `+0x1C` | `AiCurseDivisor` | `1` | `2` | `4` |
| `+0x20` | `UltraCode` (`LifeStealDivisor`) | `1` | `2` | `3` |
| `+0x24` | `ManaStealDivisor` | `1` | `2` | `3` |
| `+0x28` | `UniqueDamageBonus` | `0` | `3` | `5` |
| `+0x2C` | `ChampionDamageBonus` | `0` | `3` | `5` |
| `+0x30` | `HireableBossDamagePercent` | `100` | `75` | `50` |
| `+0x34` | `MonsterCEDamagePercent` | `100` | `70` | `35` |
| `+0x38` | `StaticFieldMin` | `0` | `33` | `50` |

## 2. Cold & Freeze Duration Pipeline (`D2Game.dll`)

### 2.1 Resistance Mitigation (`0x6FCFBD00`)
Before applying elemental damage and durations to a defender:
- `+0x1C` (`ColdDamage`) and `+0x20` (`ColdLen`) are mitigated by `STAT_COLDRESIST` (`43`, max `STAT_MAXCOLDRESIST` `44`, min `-100`).
- `+0x40` (`FreezeLen`) is also scaled by `100 - ColdResist` at `0x6FCFC125..0x6FCFC167` (`FreezeLen - FreezeLen * ColdResist / 100`), dropping to `0` when `ColdResist >= 100` (`0x6FCFC10C`).

### 2.2 `SUNITDMG_ApplyCold` (`0x6FCFC780`) — State `11` (`STATE_COLD`)
1. Reads `coldLen` (`arg_4`, in frames at 25 fps). Returns `0` immediately if `coldLen <= 0`.
2. Checks `STATES_CheckState(pDefender, STATE_FREEZE /* 1 */)`. If already frozen, chill does not overwrite freeze (`0x6FCFC79B..0x6FCFC7AB`).
3. Calls `sub_6FCFAE20(pDefender, pGame->bExpansion)` to read `MonStats.txt -> coldEffect(Norm/Nmare/Hell)` (for monsters; `-50` for players/hirelings):
   - If `coldEffect >= 0` (`jge` at `0x6FCFC7CE`), the unit is immune to cold chill/freeze (e.g., `ColdEffect = 0` on Death Lords, Frozen Horrors, Specters, Willows) and `SUNITDMG_ApplyCold` returns `0`.
4. If `pDefender->dwUnitType == 1` (`UNIT_MONSTER`):
   - Fetches `pDifficultyLevelsTxt = D2Common_10655(pGame->nDifficulty)` (`0x6FCFC84A`).
   - Reads `divisor = pDifficultyLevelsTxt->dwMonsterColdDivisor` (`[eax+0x18]`).
   - If `divisor > 0`, divides duration via integer division: `coldLen = Math.trunc(coldLen / divisor)` (`idiv ecx` at `0x6FCFC860`).
5. Applies `STATE_COLD` (`11`) and sets the expire event (`Event 10`) to `pGame->dwGameFrame + coldLen` (or extends existing expire frame if larger).

### 2.3 `SUNITDMG_ApplyFreeze` (`0x6FCFDAC0`) — State `1` (`STATE_FREEZE`)
1. Reads `freezeLen` (`arg_4`, in frames). Returns `0` immediately if `freezeLen <= 0`.
2. Calls `sub_6FCFAE20(pDefender, pGame->bExpansion)` (`coldEffect`):
   - If `coldEffect >= 0` (`jge` at `0x6FCFDAFE`), returns `0`.
3. Checks monster flags (`MonType` / `CannotBeFrozen` / bosses):
   - If `pDefender` cannot be frozen (`0x6FCFDB0A..0x6FCFDB9D`), converts freeze into chill by tail-calling `SUNITDMG_ApplyCold(pGame, pAttacker, pDefender, freezeLen)` (`0x6FCFDB9F`).
4. If `pDefender->dwUnitType == 1` (`UNIT_MONSTER`):
   - Fetches `pDifficultyLevelsTxt = D2Common_10655(pGame->nDifficulty)` (`0x6FCFDC18`).
   - Reads `divisor = pDifficultyLevelsTxt->dwMonsterFreezeDivisor` (`[eax+0x14]`).
   - If `divisor > 0`, divides duration via integer division: `freezeLen = Math.trunc(freezeLen / divisor)` (`idiv ecx` at `0x6FCFDC2E`).
5. Applies `STATE_FREEZE` (`1`), clears `STATE_COLD` (`11`) if active, and schedules expire event.

### 2.4 Weapon `STAT_COLDLENGTH` (`56`) & Elemental Conversion (`0x6FCFD8A6..0x6FCFDA63`)
- In `SUNITDMG_FillDamageValues` (`0x6FCFD8A6`):
  - `D2Common_10973(pAttacker, STAT_COLDLENGTH /* 56 */, 0)` reads total item `coldlength` in frames and adds it to `+0x20` (`ColdLen`).
  - At `0x6FCFDA16..0x6FCFDA63`, when a skill converts physical damage into elemental damage (`EType = cold` or `frze`), it ensures a minimum `50`-frame (2s) cold/freeze duration floor (`if (ColdLen < 50) ColdLen = 50`).
- Skill elemental durations (`ELen`, `ELevLen1..3`, scaled by `ELenSymPerCalc`) are evaluated via `D2Common_GetSkillElemLength` (`11035`) / `Missiles.txt` `ELen + ELevLen1..3`:
  - `Ice Bolt` (#39): `EType = cold`, `ELen = 150`, `ELevLen1..3 = 35` (`150 + 35*(slvl-1)` frames).
  - `Frost Nova` (#44): `EType = cold`, `ELen = 200`, `ELevLen1..3 = 25` (`200 + 25*(slvl-1)` frames).
  - `Ice Blast` (#45): `EType = frze`, `ELen = 75`, `ELevLen1..3 = 5`, `ELenSymPerCalc = skill('Glacial Spike'.blvl)*par8`.
  - `Glacial Spike` (#55): `EType = frze`, freeze duration stored in `auraLenCalc = ln34 * (100 + skill('Blizzard'.blvl) * par7) / 100` (`par3 = 50, par4 = 3`).
  - `Blizzard` (#59) / `Frozen Orb` (#64): `EType = cold`, `ELen = 100`, `ELevLen1..3 = 0` (`100` frames).
  - `Cold Arrow` (#11): `EType = cold`, `ELen = 100`, `ELevLen1..3 = 30` (`100 + 30*(slvl-1)` frames).
  - `Ice Arrow` (#21): `EType = frze`, `ELen = 50`, `ELevLen1..3 = 5`, `ELenSymPerCalc = skill('Cold Arrow'.blvl)*par7`.
  - `Freezing Arrow` (#31): `EType = frze`, `ELen = 50`, `ELevLen1..3 = 0`, `ELenSymPerCalc = skill('Cold Arrow'.blvl)*par7`.
  - `Frozen Armor` (#40): reactive `STATE_FREEZE` (`1`) duration evaluated via `calc1 = ln56*(100+((skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par8))/100` (`par5 = 30, par6 = 3`).
  - `Shiver Armor` (#50): reactive `STATE_COLD` (`11`) duration `ELen = 100`, `ELevLen1 = 0, ELevLen2 = 25, ELevLen3 = 50`.
  - `Chilling Armor` (#60): reactive bolt `STATE_COLD` (`11`) duration `ELen = 100`, `ELevLen1 = 0, ELevLen2 = 25, ELevLen3 = 25`.
  - `Arctic Blast` (#230): `EType = cold`, `ELen = 100`, `ELevLen1..3 = 15`, `ELenSymPerCalc = (skill('Hurricane'.blvl)+skill('Cyclone Armor'.blvl))*par8`.
  - `Twister` (#240): `EType = Stun`, `ELen = 10` (`10` frames).
  - `Hurricane` (#250): `EType = cold`, `ELen = 50` (`50` frames per pulse).
  - `Blades of Ice` (#274): `EType = frze`, `ELen = 100`, `ELevLen1..3 = 10` (`100 + 10*(slvl-1)` frames).
  - `Phoenix Strike` (#280) Charge 3 (`royalstrikechaosice`): `Missiles.txt` `EType = frze`, `ELen = 100`, `ELevLen1..3 = 10` (`100 + 10*(slvl-1)` frames).
