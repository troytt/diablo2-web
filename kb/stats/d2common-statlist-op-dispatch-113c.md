# D2Common.dll v1.13c StatList `op` / `op param` / `op base` / `op stat1..3` Dispatch

## Overview

In Diablo II: Lord of Destruction v1.13c (`samples/d2/D2Common.dll`, image base `0x6FD50000`), derived unit and item stats are computed dynamically from `ItemStatCost.txt` columns (`op`, `op param`, `op base`, `op stat1`, `op stat2`, `op stat3`) rather than hardcoding per-attribute percentage multipliers or ad-hoc stat names.

## Binary Evidence (`samples/d2/D2Common.dll`)

### 1. `EvalStatWithOps` (`0x6FD89530` .. `0x6FD899F0`)

When a stat is queried or updated on an extended stat list (`D2StatListExStrc`, `STATLIST_FLAG_EXTENDED = 0x80000000`), `D2Common.dll` iterates over the stat's `ItemStatCost.txt` record (`D2ItemStatCostTxt`, stride `0x144 = 324` bytes, loaded at `sgptDataTables + 0xB8C`):

- Offset `+0x3E` (`uint8_t bOp`): operation code (`1..13`).
- Offset `+0x3F` (`uint8_t bOpParam`): bit-shift parameter (`op param`).
- Offset `+0x40` (`uint16_t wOpBase`): base stat ID (`op base`) queried on the unit or item (e.g., `level` = ID `12`, `strength` = ID `0`, `dexterity` = ID `2`).
- Offset `+0x42..+0x47` (`uint16_t wOpStat[3]`): up to three target derived stats (`op stat1`, `op stat2`, `op stat3`) that receive the computed delta.
- Offset `+0x04` (`uint32_t dwStatFlags`): bit `0x04` (`fCallback` / `Callback=1`) triggers state/skill callback refresh when the stat changes.

### 2. `ApplyStatOp` (`0x6FD89AF0` .. `0x6FD89C9F`) — `op 1..13` Jump Table (`0x6FD89CA0`)

`0x6FD89AF0` dispatches `bOp` (`op - 1`, `0..12`) via the jump table at `0x6FD89CA0`:

| `op` | `0x6FD89CA0` Case Address | Formula in `D2Common.dll` | Canonical `ItemStatCost.txt` Examples |
| ---: | :--- | :--- | :--- |
| `1` | `0x6FD89B1E` | `floor(baseStatValue * opStatValue / 100)` (`baseStatValue` = target `op stat` base value on owner) | `item_maxhp_percent` (`76`), `item_maxmana_percent` (`77`) |
| `2` | `0x6FD89B62` | `(opStatValue * opBaseValue) >> opParam` (`opBaseValue` = `STATLIST_UnitGetStatValue(pUnit, wOpBase, 0)`) | `item_hp_perlevel` (`216`), `item_mana_perlevel` (`217`), `item_FIND_GF_perlevel` (`239`), `item_FIND_MF_perlevel` (`240`) |
| `3` | `0x6FD89B96` | `floor(((opStatValue * opBaseValue) >> opParam) * baseStatValue / 100)` | Percentage-per-level scaling on `op stat1..3` base value |
| `4` | `0x6FD89BA5` | `(opStatValue * opBaseValue) >> opParam` (applied to unit when item is equipped) | `item_armor_perlevel` (`214`), `item_tohit_perlevel` (`224`), `item_maxdamage_perlevel` (`218`) |
| `5` | `0x6FD89BD6` | `floor(((opStatValue * opBaseValue) >> opParam) * baseStatValue / 100)` (applied to unit when item is equipped) | `item_armorpercent_perlevel` (`215`), `item_maxdamage_percent_perlevel` (`219`), `item_tohitpercent_perlevel` (`225`) |
| `6` | `0x6FD89BE5` | `EvaluateByTime(0x6FD893B0)` by-time flat bonus | `item_hp_bytime` (`268`), `item_mana_bytime` (`269`), `item_maxdamage_bytime` (`270`) |
| `7` | `0x6FD89BFF` | `floor(EvaluateByTime(0x6FD893B0) * baseStatValue / 100)` by-time percentage bonus | `item_armorpercent_bytime` (`267`), `item_maxdamage_percent_bytime` (`271`), `item_tohitpercent_bytime` (`273`) |
| `8` | `0x6FD89C0E` | `(opStatValue * opBaseValue) >> opParam` (`opBaseValue` = `energy`, converts 8.8 fixed-point `maxmana` via `<< 8`) | `energy` (`1`, `op=8`, `op base=level`, `op stat1=maxmana`) |
| `9` | `0x6FD89C0E` | `(opStatValue * opBaseValue) >> opParam` (`opBaseValue` = `vitality`, converts 8.8 fixed-point `maxhp` / `maxstamina` via `<< 8`) | `vitality` (`3`, `op=9`, `op base=level`, `op stat1=maxstamina`, `op stat2=maxhp`) |
| `10` | `0x6FD89C8D` | No-op (`xor eax, eax; ret`) | Unused in 1.13c |
| `11` | `0x6FD89C45` | `baseStatValue + floor(baseStatValue * opStatValue / 100)` | Self-included percentage scaling |
| `12` | `0x6FD89C8D` | No-op (`xor eax, eax; ret`) | Unused in 1.13c |
| `13` | `0x6FD89C62` | `floor(itemBaseStatValue * opStatValue / 100)` (`STATLIST_GetUnitBaseStat(pItem, opStatId, 0)`) | `item_armor_percent` (`16`, `op=13`, `op stat1=armorclass`), `item_maxdurability_percent` (`75`, `op=13`, `op stat1=maxdurability`) |

### 3. `UNITS_GetDefense` (`0x6FD82890` .. `0x6FD82A10`) — Separation of `item_armor_percent` (`16`) and `skill_armor_percent` (`171`)

- **`item_armor_percent` (ID `16`)**: Has `op=13`, `op stat1=armorclass` (`31`). It scales ONLY the local item's base `armorclass` on that item's `D2StatListExStrc` before the item's defense is summed onto the unit.
- **`skill_armor_percent` (ID `171`)**: Has `op=''` (no `ItemStatCost` op). It is written by skills and states such as Defiance, Shout, Iron Skin, Shiver Armor, Chilling Armor, Frozen Armor, Werebear, Inner Sight, Slow Missiles, Taunt, and Battle Cry.
- In `UNITS_GetDefense` (`0x6FD82890`):
  1. If the unit has state `STATE_BERSERK`, defense immediately returns `0`.
  2. Base `armorclass` (`31`) is summed across the unit and its attached item/state stat lists, plus `armorclass_vs_missile` (`32`) or `armorclass_vs_hth` (`33`) when applicable, plus `floor(dexterity / 4)` for players.
  3. The total flat defense is multiplied by `(100 + skill_armor_percent) / 100` (`imul eax, edx; mov ecx, 0x64; cdq; idiv ecx`).
