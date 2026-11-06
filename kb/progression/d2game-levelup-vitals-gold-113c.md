# Diablo II v1.13c Player Level-Up, Stat Allocation, Mercenary Per-Level Stats & Gold Caps

Reverse-engineered from `samples/d2/D2Game.dll` (image base `0x6FC20000`) and
`samples/d2/D2Common.dll` (image base `0x6FD50000`); data from `CharStats.txt` / `Hireling.txt` /
`ItemStatCost.txt` in the 1.13c MPQs. Complements `combat/d2game-experience-pipeline-113c.md`
(kill exp / party split / death penalties) and `stats/d2common-statlist-op-dispatch-113c.md`
(op 8 / op 9 stat links).

## D2Common import ordinals used below (D2Game IAT `0x6FD18xxx`)
| D2Game thunk | IAT | Ordinal | D2Common VA | Role |
|---|---|---|---|---|
| `0x6FC2A3E2` | `0x6FD1827C` | `#10587` | `0x6FD88C20` | `STATLIST_GetUnitBaseStat(unit, stat, layer)` |
| `0x6FC2A42A` | `0x6FD182B0` | `#10973` | `0x6FD88B70` | `STATLIST_GetUnitStat` (accrued) |
| `0x6FC2A472` | `0x6FD182E0` | `#10887` | `0x6FD8A740` | `STATLIST_SetUnitStat` |
| `0x6FC2A4D2` | `0x6FD18320` | `#10551` | `0x6FD8A710` | `STATLIST_AddUnitStat` |
| `0x6FC2A3A0` | `0x6FD18250` | `#10913` | `0x6FD890F0` | `GetUnitMaxLife` = accrued stat 7 (`0x6FD88A80`, ISC rec 7) incl. items/op |
| `0x6FC2A4EA` | `0x6FD18330` | `#10186` | `0x6FD890A0` | `GetUnitMaxMana` = accrued stat 9 |
| `0x6FC2A460` | `0x6FD182D4` | `#10578` | `0x6FD89050` | `GetUnitMaxStamina` = accrued stat 11 |
| `0x6FC2A4E4` | `0x6FD1832C` | `#10670` | `0x6FDB08D0` | `GetLevelFromExp(classId, exp)` |
| `0x6FC2A3D6` | `0x6FD18274` | `#10399` | `0x6FDAE810` | `GetExpThreshold(classId, level)` |
| `0x6FC2A45A` | `0x6FD182D0` | `#10049` | `0x6FD81940` | inventory gold cap = `GetUnitStat(level) * 10000` (`imul eax,eax,0x2710`) |
| `0x6FC2A4A8` | `0x6FD18304` | `#11060` | `0x6FD7E9C0` | stash gold cap = constant `0x2625A0` (**2,500,000**, level independent) |

`D2CharStatsTxt` (record stride `0xC4`, table `[sgptDataTables+0xBC4]`, count `+0xBC8`) byte offsets
used here: `+0x30 str`, `+0x31 dex`, `+0x32 int`, `+0x33 vit`, `+0x43 LifePerLevel`,
`+0x44 StaminaPerLevel`, `+0x45 ManaPerLevel`, `+0x46 LifePerVitality`, `+0x47 StaminaPerVitality`,
`+0x48 ManaPerMagic`, `+0x50 StatPerLevel` (signed). All "per" columns are in fourths; the binary
converts them to 1/256 fixed point with `<< 6`.

## 1. Player level-up — `D2Game.dll 0x6FD0B090`
1. `oldLvl = GetBaseStat(12)`, `newLvl = #10670(class, GetUnitStat(13))`, `SetStat(12, newLvl)`,
   `SetStat(30 nextexp, #10399(class, newLvl))`. `diff = newLvl - oldLvl`; return if `diff <= 0`.
2. `0x6FD0B120..0x6FD0B166`: `maxhp(7) += (LifePerLevel * diff) << 6`; then **if `hp(6) > 0`,
   `SetStat(6, #10913 GetUnitMaxLife)`** — full life refill to the accrued (item-inclusive) max.
3. `0x6FD0B168..0x6FD0B198`: `maxmana(9) += (ManaPerLevel * diff) << 6`; `SetStat(8, #10186)` — full mana refill.
4. `0x6FD0B19A..0x6FD0B1CA`: `maxstamina(11) += (StaminaPerLevel * diff) << 6`; `SetStat(10, #10578)` — full stamina refill.
5. `0x6FD0B1CC..0x6FD0B1E4`: `statpts(4) += StatPerLevel * diff` (5/level), `newskills(5) += diff` (1/level).
6. Then level-up overlay/sound (`[unit+0x6E] = 2`, flag `0x400`, `0x6FCFFC10`, `0x6FCF24B0`, `0x6FCF51A0`).

Fractions accumulate in the 1/256 fixed-point max (e.g. Necromancer 1.5 life/level), and per-level
and per-point gains share one accumulator, so `floor(total/256)` is taken once over the sum.

## 2. Stat point allocation — C→S `0x3A` → `0x6FCEC960` → `0x6FD0AEE0`
- `0x6FCEC960`: packet length must be 3; `statId = byte[1]` (must be `0..15`), `count = byte[2] + 1`
  (`1..100`); loops `count` times calling `0x6FD0AEE0`, stopping when it returns 0.
- `0x6FD0AEE0`: returns 0 if `statpts(4) == 0` or `statId > 3`; jump table `0x6FD0AF70`:
  - `0` str: `statpts -= 1`, `str += 1`.
  - `1` energy: `0x6FD0AE20(count=1)`.
  - `2` dex: `statpts -= 1`, `dex += 1`.
  - `3` vitality: `0x6FD0AD10(count=1)`.
- `0x6FD0AD10` (vitality, `edi = n`): `statpts -= n`, `vit += n`, `maxhp += (LPV*n) << 6`;
  **if `n > 0`: `hp += (LPV*n) << 6`** (incremental, not a refill), then clamp `hp <= maxhp`;
  same for `maxstamina` / `stamina` with `StaminaPerVitality`.
- `0x6FD0AE20` (energy): `statpts -= n`, `energy += n`; if `n > 0` `mana += (MPM*n) << 6`;
  `maxmana += (MPM*n) << 6`; clamp `mana <= maxmana`.
- `0x6FD0AF80` (stat respec): for each attribute `n = CharStats.base - current`, refund via the same
  helpers with negative `n` (max shrinks, current only clamped).

## 3. Item / bonus attribute links (ItemStatCost op 8 / op 9)
`ItemStatCost.txt`: `energy (1)` op `8` → `maxmana`; `vitality (3)` op `9` → `maxhp`, `maxstamina`.
Evaluated in the accrued stat path (`0x6FD89947` / `0x6FD899C3`, see stats kb): for players only,
`((accrued - base) * ManaPerMagic|LifePerVitality|StaminaPerVitality) << 6`. Hence `+vit`/`+energy`
from items/charms raise max life/mana/stamina; `#10913/#10186/#10578` return these accrued values.

## 4. Mercenary per-level stats — `MERCS_SetStats` `D2Game.dll 0x6FC68BA0`
`d = mercLevel - Hireling.Level` (`[rec+0x1C]`). Division is C-style truncation (`cdq; and edx,7; sar 3`).
| Stat | Formula | Clamp |
|---|---|---|
| str (0) | `Str + trunc(Str/Lvl * d / 8)` | `>= 10` |
| dex (2) | `Dex + trunc(Dex/Lvl * d / 8)` | `>= 10` |
| maxhp (7) = hp (6) | `(HP + HP/Lvl * d) << 8` | `>= 0x2800` (40 life) |
| armorclass (31) | `Def + Def/Lvl * d` | `>= 0` |
| mindamage (23) | `DmgMin + trunc(Dmg/Lvl * d / 8)` | `>= 0` |
| maxdamage (24) | `DmgMax + trunc(Dmg/Lvl * d / 8)` | `>= 1` |
| tohit (19) | `AR + AR/Lvl * d` | `>= 0` |
| fire/light/cold/poison resist (39/41/43/45) | `Resist + trunc(Resist/Lvl * d / 4)` | `>= 0` |
| hpregen (74) | `maxhp_256 / 2000` (`imul 0x10624DD3; sar edx,7`) | `>= 0` |
Also `SetStat(30, Threshold(level+1))` (0 at max level) and `exp(13) = max(exp, Threshold(level))`.

## 5. Gold caps
- Inventory gold (stat 14): `#10049` → `level * 10000`.
- Stash gold (stat 15): `#11060` → **2,500,000 constant** in 1.13c; callers `0x6FC21063`
  (generic stat clamp: over-cap → set to 0), `0x6FD0CD08` (character load validation),
  `0x6FC5827E` / `0x6FC58330` (death gold penalty), `0x6FC75F8B`, `0x6FC918B5`, `0x6FCDCD54`.
  D2Client also imports `#11060` for the stash gold display/keypad cap.
