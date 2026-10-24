# Diablo II v1.13c Paladin Defensive Auras (`#99`, `#100`, `#104`, `#105`, `#109`, `#110`, `#115`, `#120`, `#124`, `#125`)

> **Binary Ground Truth**:
> - `D2Client.dll` v1.13c (Image Base `0x6FAB0000`)
> - `D2Game.dll` v1.13c (Image Base `0x6FC20000`)
> - `D2Common.dll` v1.13c (Image Base `0x6FD50000`)
> - MPQ Data Tables: `Skills.txt`, `Missiles.txt`, `States.txt`, `Overlay.txt`, `ItemStatCost.txt`

This document establishes the authoritative client and server execution mechanics for all 10 Paladin **Defensive Auras** in Diablo II: Lord of Destruction v1.13c: **Prayer** (`#99`), **Resist Fire** (`#100`), **Defiance** (`#104`), **Resist Cold** (`#105`), **Cleansing** (`#109`), **Resist Lightning** (`#110`), **Vigor** (`#115`), **Meditation** (`#120`), **Redemption** (`#124`), and **Salvation** (`#125`).

---

## 1. Function Dispatch Tables (`D2Client.dll` & `D2Game.dll` v1.13c)

### 1.1 Client State & Missile Dispatch (`D2Client.dll`, Base `0x6FAB0000`)

All 10 Defensive Auras have `cltstfunc = 0`, `cltdofunc = 0` in `Skills.txt`. When **Redemption** (`#124`) consumes a monster corpse on the server, it sets `STATE_REDEEMED` (`#99`, `setfunc = 10`, `hide = 1`) on that corpse, which triggers the client state-onset callback to spawn the rising `redemption` (`#173`, `RedemptionGhost`) missile and play `paladin_redeemed_soul`.

| Dispatch Table / Mechanism | Table VA | Index | Function VA | RVA | Assigned Skills / States / Missiles |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | `0x0B17C0` | `redemption` (`#173`, `RedemptionGhost` soul missile) |
| `States.txt` `setfunc` | — | `10` | Client State SetFunc `10` | — | `STATE_REDEEMED` (`#99`, `skill = redemption` — hides corpse & spawns `cltmissilea = redemption`) |

### 1.2 Server Skill & Aura Callback Dispatch (`D2Game.dll`, Base `0x6FC20000`)

| Dispatch Table / Helper | Table VA | Index | Function VA | Symbolic Name | Assigned Defensive Auras |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `65` | `0x6FCBA8D0` | `SKILLS_SrvDo065_BasicAura` | Prayer (`#99`), Resist Fire (`#100`), Defiance (`#104`), Resist Cold (`#105`), Cleansing (`#109`), Resist Lightning (`#110`), Vigor (`#115`), Meditation (`#120`), Salvation (`#125`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `82` | `0x6FCBA400` | `SKILLS_SrvDo082_Redemption` | Redemption (`#124`) |
| `gpMissileSrvDoFnTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `redemption` (`#173`) |

---

## 2. MPQ Data Tables (`Skills.txt`, `States.txt`, `Missiles.txt`)

### 2.1 `Skills.txt` Summary Table

| ID | Skill | ReqLvl | `srvdo` | `aurastate` / `auratargetstate` | `aurafilter` | Radius (`aurarangecalc` sub-tiles) | Passive State & Stat (`passivestate` / `passivestat1`) | Aura Stats (`aurastat1..3` & Formulas) |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: | :--- | :--- |
| `99` | **Prayer** | 1 | `65` | `prayer` (`#34`) / `prayer` (`#34`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | — | `hitpoints` (`#6`, direct heal) = `edns` (`EMin=2`, `+1/1/2/2/3`, `HitShift=8`); Mana/pulse: $(16 + 3(\text{slvl}-1)) \times 2^{-4}$ |
| `100` | **Resist Fire** | 1 | `65` | `resistfire` (`#3`) / `resistfire` (`#3`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | `passive_resistfire` (`#181`): `maxfireresist = blvl / 2` | `fireresist` = `dm34` (`35`..`150`%); `maxfireresist` = `Resist Fire.blvl` |
| `104` | **Defiance** | 6 | `65` | `defiance` (`#37`) / `defiance` (`#37`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | — | `skill_armor_percent` = `70 + 10*(slvl-1)`% |
| `105` | **Resist Cold** | 6 | `65` | `resistcold` (`#4`) / `resistcold` (`#4`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | `passive_resistcold` (`#182`): `maxcoldresist = blvl / 2` | `coldresist` = `dm34` (`35`..`150`%); `maxcoldresist` = `Resist Cold.blvl` |
| `109` | **Cleansing** | 12 | `65` | `cleansing` (`#45`) / `cleansing` (`#45`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | — | `item_poisonlengthresist` = `100 - dm34` (`dm34`: `30`..`90`% reduction); `hitpoints` = `skill('Prayer'.edns)` |
| `110` | **Resist Lightning** | 12 | `65` | `resistlight` (`#5`) / `resistlight` (`#5`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | `passive_resistltng` (`#183`): `maxlightresist = blvl / 2` | `lightresist` = `dm34` (`35`..`150`%); `maxlightresist` = `Resist Lightning.blvl` |
| `115` | **Vigor** | 18 | `65` | `stamina` (`#41`) / `stamina` (`#41`) | `73731` (`0x12003`) | `16 + 3*(slvl-1)` | — | `staminarecoverybonus` = `50 + 25*(slvl-1)`%; `skill_staminapercent` = `50 + 25*(slvl-1)`%; `velocitypercent` = `dm56` (`7`..`50`% FRW) |
| `120` | **Meditation** | 24 | `65` | `meditation` (`#48`) / `meditation` (`#48`) | `73729` (`0x12001`) | `16 + 2*(slvl-1)` | — | `manarecoverybonus` = `300 + 25*(slvl-1)`%; `hitpoints` = `skill('Prayer'.edns)` |
| `124` | **Redemption** | 30 | `82` | `redemption` (`#50`) / — | `4354` (`0x1102`) | `16` (10.67 yds flat) | — | `calc1 = dm34` (`10`..`100`% chance); `calc2 = 25 + 5*(slvl-1)` (HP); `calc3 = 25 + 5*(slvl-1)` (Mana) |
| `125` | **Salvation** | 30 | `65` | `resistall` (`#8`) / `resistall` (`#8`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | — | `fireresist`, `coldresist`, `lightresist` = `dm34` (`50`..`120`%) |

### 2.2 `States.txt` & `Missiles.txt` Summary Table

| State ID | State Name | `immed` | `overlay1` / `overlay2` | `onsound` | Special State Flags |
| :---: | :--- | :---: | :--- | :--- | :--- |
| `3` | `resistfire` | `1` | `aura_resistfire` (`cast_resistfire`) | `paladin_aura_resistfire` | `aura=1`, `rfblue=1` |
| `4` | `resistcold` | `1` | `aura_resistcold` (`cast_resistcold`) | `paladin_aura_resistcold` | `aura=1`, `rcblue=1` |
| `5` | `resistlight` | `1` | `aura_resistlight` (`cast_resistlight`) | `paladin_aura_resistlightning` | `aura=1`, `rlblue=1` |
| `8` | `resistall` | `1` | `aura_resistall_front` / `aura_resistall_back` | `paladin_aura_salvation` | `aura=1`, `rfblue=1`, `rcblue=1`, `rlblue=1` |
| `34` | `prayer` | `0` | `aura_prayer_front` / `aura_prayer_back` | `paladin_aura_prayer` | `aura=1` |
| `37` | `defiance` | `1` | `aura_defiance_front` / `aura_defiance_back` | `paladin_aura_defiance` | `aura=1`, `armblue=1` |
| `41` | `stamina` | `1` | `staminafront` / `staminaback` | `paladin_aura_stamina` | Used by Vigor (`#115`), `aura=1` |
| `45` | `cleansing` | `0` | `cleansingfront` / `cleansingback` | `paladin_aura_cleansing` | `aura=1` |
| `48` | `meditation` | `1` | `meditationfront` / `meditationback` | `paladin_aura_meditation` | `aura=1` |
| `50` | `redemption` | `0` | `redemptionfront` / `redemptionback` | `paladin_aura_redemption` | Caster state for Redemption (`#124`) |
| `85` | `nomanaregen` | `0` | — | — | `nosend=1` (suppresses passive mana regeneration while Prayer drains mana) |
| `99` | `redeemed` | `0` | — | `paladin_redeemed_soul` | `setfunc=10`, `skill=redemption`, `hide=1`, `udead=1`, `monstaydeath=1`, `bossstaydeath=1` |
| `181`..`183` | `passive_resistfire` / `cold` / `ltng` | `0` | — | — | Hidden passive states granting `+blvl/2` Max Resist while corresponding aura is inactive |

- **Missile `#173` (`redemption`)**: `pCltDoFunc = 1` (`0x6FB617C0`), `pSrvDoFunc = 1` (`0x6FC5F540`), `CelFile = RedemptionGhost`, `Range = 18` frames, `AnimLen = 16`, `Light = 6`, `Trans = 1`, `Explosion = 1`, `ClientSend = 1`.

---

## 3. Shared Defensive Aura Engine (`SKILLS_SrvDo065_BasicAura` @ `0x6FCBA8D0`)

Nine of the ten Defensive Auras (`#99`, `#100`, `#104`, `#105`, `#109`, `#110`, `#115`, `#120`, `#125`) execute through `SKILLS_SrvDo065_BasicAura` (`0x6FCBA8D0`) on a 50-frame (`2.0` second) periodic pulse (`SKILL_ComputePeriodicRate`). Two special subsystems inside `SKILLS_AuraCallback_BasicAura` (`SkillPal.cpp:349–482`) govern direct healing/mana drain and passive max resistance suppression:

### 3.1 Direct Stat Healing (`ITEMSTATCOSTFLAGINDEX_DIRECT`) & Conditional Mana Drain
In `ItemStatCost.txt`, `hitpoints` (`STAT_HITPOINTS`, `#6`) has `direct = 1` (`ITEMSTATCOSTFLAGINDEX_DIRECT`). Inside `SKILLS_AuraCallback_BasicAura` (`SkillPal.cpp:421–446`), whenever an `aurastat` has `direct = 1` (`STAT_HITPOINTS`):
1. Instead of attaching `STAT_HITPOINTS` to the temporary `D2StatListStrc` (which would vanish when the statlist expires!), the callback **directly mutates the target unit's current life**:
   ```cpp
   const int32_t nMaxHp = STATLIST_GetMaxLifeFromUnit(pUnit);
   const int32_t nHitpoints = STATLIST_UnitGetStatValue(pUnit, STAT_HITPOINTS, 0);
   if (nHitpoints < nMaxHp) {
       int32_t nNewHp = std::min(nHitpoints + nBonus, nMaxHp);
       STATLIST_SetUnitStat(pUnit, STAT_HITPOINTS, nNewHp, 0);
       ++pArgs->field_40;
   }
   ```
2. **Conditional Mana Drain & `STATE_NOMANAREGEN` (`#85`)**:
   - Notice `++pArgs->field_40` is incremented **only** if at least one friendly unit had `nHitpoints < nMaxHp` and was actually healed!
   - After `sub_6FD0FE80` finishes scanning all allies (`SkillPal.cpp:292–302`), if the aura has a mana cost (`nManaCost > 0`, which is true for **Prayer** `#99`):
     - If `args.field_40 > 0` (at least one unit healed): sets `STATES_ToggleState(pUnit, STATE_NOMANAREGEN, 1)` (halting the Paladin's natural mana regeneration during that 2-second window) and deducts `nManaCost` via `D2GAME_SKILLMANA_AuraConsume_6FD10C90`.
     - If `args.field_40 == 0` (everyone in the party is at 100% full HP!): clears `STATE_NOMANAREGEN` and **consumes zero mana**!

### 3.2 Passive vs Active Max Resistance Suppression (`SkillPal.cpp:455–464`)
**Resist Fire** (`#100`), **Resist Cold** (`#105`), and **Resist Lightning** (`#110`) each define both:
- `passivestate` (`#181`, `#182`, `#183`) with `passivestat1 = maxfireresist` / `maxcoldresist` / `maxlightresist` and `passivecalc1 = blvl / 2` ($+0.5\%$ Max Resist per hard point invested, up to $+10\%$ at 20 hard points).
- `aurastat2 = maxfireresist` / `maxcoldresist` / `maxlightresist` with `aurastatcalc2 = blvl` ($+1.0\%$ Max Resist per hard point invested while the aura is active, up to $+20\%$ at 20 hard points; note that **party members also receive this $+1\% \cdot \text{blvl}_{\text{paladin}}$ Max Resist bonus** while standing in the active aura!).
- To prevent the Paladin from stacking $+0.5\% \cdot \text{blvl}$ (passive) $+ 1.0\% \cdot \text{blvl}$ (active) $= +1.5\% \cdot \text{blvl}$ on himself, `SKILLS_AuraCallback_BasicAura` (`lines 455–464`) checks `if (pSkillsTxtRecord->nPassiveState > 0 && pAuraCallback->pOwner == pUnit)` and **removes the passive statlist** (`D2Common_10474` + `STATES_ToggleState(pUnit, nPassiveState, 0)`) while the aura is active. When the aura expires or switches off, `SKILLS_CurseStateCallback_BasicAura` (`line 329`) calls `D2GAME_RefreshPassiveSkills_6FD14CC0(pUnit)` to immediately restore the $+0.5\% \cdot \text{blvl}$ passive bonus!

---

## 4. Detailed Aura Reverse-Engineering

### 4.1 Prayer (`#99`)
- **Pulse Heal Formula**: `aurastat1 = hitpoints` (`#6`), `aurastatcalc1 = edns` (`EMin = 2`, `EMinLev1..5 = 1, 1, 2, 2, 3`, `HitShift = 8` so full 256ths precision):
  $$\text{Heal per 2s} = \begin{cases} 2 + (\text{slvl}-1) & 1 \le \text{slvl} \le 8 \\ 9 + 1(\text{slvl}-8) & 9 \le \text{slvl} \le 16 \\ 17 + 2(\text{slvl}-16) & 17 \le \text{slvl} \le 28 \\ 41 + 3(\text{slvl}-28) & \text{slvl} > 28 \end{cases}$$
- **Mana Cost**: `mana = 16`, `lvlmana = 3`, `manashift = 4` ($2^{-4} = 1/16$):
  $$\text{Mana per 2s pulse} = \frac{16 + 3(\text{slvl} - 1)}{16} = 1.0 + 0.1875(\text{slvl} - 1)$$
  *(Drained only when at least one party member/minion within `16 + 2*(slvl - 1)` sub-tiles has $< 100\%$ life).*

---

### 4.2 Resist Fire (`#100`), Resist Cold (`#105`), & Resist Lightning (`#110`)
- **Active Resistance Bonus (`aurastat1`)**: `dm34` (`Param3 = 35`, `Param4 = 150`%):
  $$\text{Resist}\% = \left\lfloor \frac{115 \cdot \left\lfloor \frac{110 \cdot \text{slvl}}{\text{slvl} + 6} \right\rfloor}{100} \right\rfloor + 35$$
  *(Grants $+52\%$ at slvl 1, $+95\%$ at slvl 5, $+131\%$ at slvl 20 to caster and party within `16 + 2*(slvl - 1)` sub-tiles).*
- **Active vs Passive Max Resistance (`aurastat2` vs `passivestat1`)**:
  - **Passive (Aura Off)**: $+ \lfloor \text{blvl} / 2 \rfloor\%$ Max Fire/Cold/Lightning Resistance to the Paladin only (uses hard points `blvl` only; soft `+skills` do not increase `blvl`).
  - **Active (Aura On)**: $+ \text{blvl}\%$ Max Fire/Cold/Lightning Resistance to the Paladin **and all party members in range** (replaces the Paladin's own passive $+ \lfloor \text{blvl} / 2 \rfloor\%$ bonus while active; total effective max resistance remains hard-capped at `95%` in `SUNITDMG_ApplyResistancesAndAbsorb` line 996).

---

### 4.3 Defiance (`#104`)
- Grants `aurastat1 = skill_armor_percent` (`#171`) $= 70 + 10(\text{slvl} - 1)\%$ Enhanced Defense to caster and aligned units within `16 + 2*(slvl - 1)` sub-tiles (`STATE_DEFIANCE` `#37`, `immed = 1`).
- Additive with other skill-based `%EDef` buffs (Holy Shield, Barbarian Shout, Iron Skin, Sorceress Cold Armors).
- Also grants $+15\% \times \text{Defiance}_{\text{blvl}}$ synergy to Holy Shield (`#117`).

---

### 4.4 Cleansing (`#109`) — Active Curse/Poison Duration Truncation & Zero-Mana Prayer Synergy
Cleansing defines:
- `aurastat1 = item_poisonlengthresist` (`#110`): `aurastatcalc1 = 100 - dm34` (`Param3 = 30`, `Param4 = 90`%, where `dm34` is the percentage reduction `39%` at slvl 1 up to `80%` at slvl 20, so `100 - dm34` is the remaining fraction `61%` down to `20%`!).
- `aurastat2 = hitpoints` (`#6`): `aurastatcalc2 = skill('Prayer'.edns)`!

#### Exact Frame-Truncation Algorithm (`SKILLS_AuraCallback_BasicAura`, `SkillPal.cpp:395–420`)
Unlike item `Poison Length Reduced by X%` (which only applies at the moment poison is inflicted), `SKILLS_AuraCallback_BasicAura` explicitly intercepts `nStatId == STAT_ITEM_POISONLENGTHRESIST` (`#110`) on **every 50-frame pulse** and actively shrinks the remaining timer of active poison and curses on `pUnit`:
1. **Poison Truncation (`STATE_POISON` `#2`)**:
   - Looks up `pStatList = STATLIST_GetStatListFromUnitAndState(pUnit, STATE_POISON)`.
   - Computes remaining frames $\Delta F = F_{\text{expire}} - F_{\text{game}}$ and scales it by $\frac{\text{aurastatcalc1}}{100} = \frac{100 - \text{dm34}}{100}$:
     $$\Delta F_{\text{new}} = \left\lfloor \frac{(F_{\text{expire}} - F_{\text{game}}) \times (100 - \text{dm34})}{100} \right\rfloor$$
   - Updates the poison statlist expire frame via `D2Common_10476(pStatList, F_game + max(1, \Delta F_new))` and schedules an immediate `EVENTTYPE_STATREGEN` tick (`sub_6FC7CA70`) if expired!
2. **Curse & Shrine Truncation (`pStatListEx->dwFlags & 0x20` = Curse List)**:
   - Iterates all statlists on `pUnit` with flag `0x20` (the curse statlist slot: Amplify Damage, Decrepify, Lower Resist, Iron Maiden, Life Tap, Weaken, etc.), **provided the state is NOT a beneficial Shrine** (`nCurseState < STATE_SHRINE_ARMOR || nCurseState > STATE_SHRINE_SKILL`, i.e., states `#128`–`#138` are explicitly protected so Cleansing never shortens your own Experience or Skill Shrine!).
   - Multiplies the remaining curse duration by the same $\frac{100 - \text{dm34}}{100}$ fraction on **every 2-second pulse** (exponentially decaying long curses/poisons every 2 seconds!).
3. **Zero-Mana Prayer Synergy (`aurastat2 = hitpoints`)**:
   - Evaluates `skill('Prayer'.edns)` (using the Paladin's **current effective skill level** of Prayer if at least 1 hard point is invested in Prayer, or `0` if `Prayer.blvl == 0` because `edns` checks owned skill level) and heals all allies (`UNIT_PLAYER` and `UNIT_MONSTER` mercenaries/pets via `aurafilter = 73731`) every 2 seconds for **zero mana cost**!

---

### 4.5 Vigor (`#115`)
- Applies `STATE_STAMINA` (`#41`, `immed = 1`) within a wider radius `aurarangecalc = 16 + 3*(slvl - 1)` sub-tiles (`+3` sub-tiles = `+2` yards per level instead of `+2` sub-tiles!).
- Grants three movement/stamina stats:
  - `aurastat1 = staminarecoverybonus` (`#28`): $50 + 25(\text{slvl} - 1)\%$
  - `aurastat2 = skill_staminapercent` (`#170`): $50 + 25(\text{slvl} - 1)\%$ Maximum Stamina
  - `aurastat3 = velocitypercent` (`#67`): `dm56` (`Param5 = 7`, `Param6 = 50`% Faster Run/Walk, giving $+13\%$ FRW at slvl 1 up to $+43\%$ FRW at slvl 20; because it is skill-based `velocitypercent`, it adds directly to effective velocity without the diminishing-returns formula applied to item `STAT_ITEM_FASTERMOVEVELOCITY`!).

---

### 4.6 Meditation (`#120`) — Mana Recovery, Prayer Synergy, & The `73729` Mercenary Filter Quirk
- Applies `STATE_MEDITATION` (`#48`, `immed = 1`) within `16 + 2*(slvl - 1)` sub-tiles:
  - `aurastat1 = manarecoverybonus` (`#27`): $300 + 25(\text{slvl} - 1)\%$ Mana Regeneration
  - `aurastat2 = hitpoints` (`#6`): `skill('Prayer'.edns)` (identical zero-mana Prayer heal synergy as Cleansing!).
- **Binary Filter Quirk (`aurafilter = 73729` vs `73731`)**:
  - Every other friendly Paladin aura uses `aurafilter = 73731` (`0x12003` = `0x10000 | 0x2000 | 0x2 | 0x1`, targeting both `UNIT_PLAYER` and `UNIT_MONSTER`).
  - Meditation (`#120`) uniquely specifies `aurafilter = 73729` (`0x12001`), **omitting bit `0x2` (`UNIT_MONSTER`)** because monsters/mercenaries do not have mana (`STAT_MANA`).
  - **Consequence**: Because `sub_6FD0FA00` rejects all `UNIT_MONSTER` units when bit `0x2` is unset, **Meditation's Prayer-synergy heal (`aurastat2 = hitpoints`) ONLY heals friendly Players (`UNIT_PLAYER`) and NEVER heals Mercenaries or Summons**, whereas Cleansing (`aurafilter = 73731`) and Prayer (`aurafilter = 73731`) heal both Players and Mercenaries/Summons! (Note: An Act 2 Prayer Mercenary wielding an *Insight* polearm still heals himself with his own native Prayer aura `#99`, and heals the player with both Prayer `#99` and Meditation `#120`!).

---

### 4.7 Redemption (`#124` — `SKILLS_SrvDo082_Redemption` @ `0x6FCBA400`)

Redemption uses a dedicated periodic handler `SKILLS_SrvDo082_Redemption` (`0x6FCBA400`), radial callback `SKILLS_AuraCallback_Redemption` (`SkillPal.cpp:1541`), and corpse consumer `SKILLS_ApplyRedemptionEffect` (`SkillPal.cpp:1463–1480`):
1. **Corpse Scan (`aurafilter = 4354` = `0x1102`)**:
   - Every 50 frames (`2.0` seconds), `SrvDo082` scans a constant radius of `aurarangecalc = 16` sub-tiles (`10.67` yards at all skill levels) with `aurafilter = 4354` (`0x1000` `MONMODE_DEAD` | `0x100` not in town | `0x2` `UNIT_MONSTER`).
   - Notice bit `0x200` (Line-of-Sight) is **unset** on `4354` — Redemption can redeem corpses through walls and obstacles!
2. **Corpse Eligibility & Probability Roll (`SKILLS_ApplyRedemptionEffect`)**:
   - Calls `SUNIT_IsCorpseUseable(pCorpse)`: checks that the monster is dead (`MONMODE_DEAD`), has `corpseSel = 1` in `MonStats2.txt`, and does **not** already have a corpse-consuming state (`STATE_REDEEMED` `#99`, `STATE_CORPSE_NODRAW` `#118`, `STATE_SHATTER` `#107`, `STATE_RESTINPEACE` `#108`, etc.).
   - Evaluates `calc1 = dm34` (`Param3 = 10`, `Param4 = 100`%, giving $23\%$ chance per corpse at slvl 1, $71\%$ at slvl 10, $90\%$ at slvl 20) and rolls `(ITEMS_RollRandomNumber(&pUnit->pSeed) % 100) < nChance`.
   - *(Note: Even if a corpse fails the roll on one pulse, it remains intact on the ground and will be rolled again on the next 2-second pulse!).*
3. **Life/Mana Restoration & `STATE_REDEEMED` (`#99`)**:
   - On a successful roll:
     - Marks the corpse unusable via `STATES_ToggleState(pCorpse, STATE_REDEEMED, 1)` (`#99`).
     - In `States.txt`, `redeemed` (`#99`) sets `hide = 1`, `udead = 1`, `monstaydeath = 1`, `bossstaydeath = 1`, `onsound = paladin_redeemed_soul`, `setfunc = 10`, and `skill = redemption`. When the client receives the state toggle packet for `STATE_REDEEMED`, `setfunc = 10` hides the corpse graphic and spawns the rising soul visual missile `redemption` (`#173`, `RedemptionGhost`).
     - Evaluates `calc2 = ln56` (HP gain: $(25 + 5(\text{slvl} - 1)) \ll 8$) and `calc3 = ln56` (Mana gain: $(25 + 5(\text{slvl} - 1)) \ll 8$) and directly adds them to the **Paladin's own** `STAT_HITPOINTS` (capped at `STAT_MAXHP`) and `STAT_MANA` (capped at `STAT_MAXMANA`). Party members do not receive life or mana from Redemption.

---

### 4.8 Salvation (`#125`)
- Applies `STATE_RESISTALL` (`#8`, `immed = 1`, `rfblue = 1`, `rcblue = 1`, `rlblue = 1`) to the Paladin and aligned units within `16 + 2*(slvl - 1)` sub-tiles.
- Grants identical diminishing-returns resistance (`dm34`, `Param3 = 50`, `Param4 = 120`%, giving $+60\%$ at slvl 1, $+85\%$ at slvl 5, $+108\%$ at slvl 20) to three elemental resistances simultaneously:
  - `aurastat1 = fireresist` (`#39`)
  - `aurastat2 = coldresist` (`#43`)
  - `aurastat3 = lightresist` (`#41`)
- *(Note: Salvation does NOT increase Poison Resistance `#45`, Magic Resistance `#37`, or Maximum Resistances `#40/#42/#44`, though hard points in Salvation grant damage synergies to Holy Fire `+6%`, Holy Freeze `+7%`, Holy Shock `+4%`, and Vengeance `+2%` to all three elements).*
