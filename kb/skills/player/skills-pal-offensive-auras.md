# Diablo II v1.13c Paladin Offensive Auras (`#98`, `#102`, `#103`, `#108`, `#113`, `#114`, `#118`, `#119`, `#122`, `#123`)

> **Binary Ground Truth**:
> - `D2Client.dll` v1.13c (Image Base `0x6FAB0000`)
> - `D2Game.dll` v1.13c (Image Base `0x6FC20000`)
> - `D2Common.dll` v1.13c (Image Base `0x6FD50000`)
> - MPQ Data Tables: `Skills.txt`, `Missiles.txt`, `States.txt`, `Overlay.txt`

This document establishes the authoritative client and server execution mechanics for all 10 Paladin **Offensive Auras** in Diablo II: Lord of Destruction v1.13c: **Might** (`#98`), **Holy Fire** (`#102`), **Thorns** (`#103`), **Blessed Aim** (`#108`), **Concentration** (`#113`), **Holy Freeze** (`#114`), **Holy Shock** (`#118`), **Sanctuary** (`#119`), **Fanaticism** (`#122`), and **Conviction** (`#123`).

---

## 1. Function Dispatch Tables (`D2Client.dll` & `D2Game.dll` v1.13c)

### 1.1 Client State & Missile Dispatch (`D2Client.dll`, Base `0x6FAB0000`)

Paladin auras are right-slot continuous skills (`aura = 1`, `perdelay = 50`) and have `cltstfunc = 0`, `cltdofunc = 0` in `Skills.txt`. However, **Sanctuary** (`#119`) drives a client-side active state callback (`cltactivefunc = 86` in `States.txt`, indexed into `g_apfnSkillCltDoFunc`!) that spawns ambient `sanctuarybolt` (`#57`) gleam missiles around the Paladin.

| Dispatch Table | Table VA | Index | Function VA | RVA | Assigned Skills / States / Missiles |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `86` | `0x6FADBB50` | `0x02BB50` | `STATE_SANCTUARY` (`#47`, `cltactivefunc = 86` — ambient `sanctuarybolt` spawner) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | `0x0B17C0` | `sanctuarybolt` (`#57`) |

### 1.2 Server Skill & Aura Callback Dispatch (`D2Game.dll`, Base `0x6FC20000`)

| Dispatch Table / Helper | Table VA | Index | Function VA | Symbolic Name | Assigned Offensive Auras |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `65` | `0x6FCBA8D0` | `SKILLS_SrvDo065_BasicAura` | Might (`#98`), Thorns (`#103`), Blessed Aim (`#108`), Concentration (`#113`), Fanaticism (`#122`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `66` | `0x6FCBAF50` | `SKILLS_SrvDo066_HolyFire_HolyShock_Sanctuary_Conviction` | Holy Fire (`#102`), Holy Shock (`#118`), Sanctuary (`#119`), Conviction (`#123`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `81` | `0x6FCBABC0` | `SKILLS_SrvDo081_HolyFreeze` | Holy Freeze (`#114`) |
| `gpMissileSrvDoFnTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `sanctuarybolt` (`#57`) |

---

## 2. Shared Aura Engine Architecture

### 2.1 50-Frame Periodic Pulse Synchronization (`SKILL_ComputePeriodicRate`)
All 10 Offensive Auras define `aura = 1` and `perdelay = 50` (50 frames = **2.0 seconds** at 25 fps). On every server periodic tick (`EVENTTYPE_PERODICSKILLS`), `SKILLS_SrvDo065`, `SKILLS_SrvDo066`, and `SKILLS_SrvDo081` call `SKILL_ComputePeriodicRate(pGame, pUnit, nSkillId, nSkillLevel)`:
1. Evaluates `perdelay` (`nDelay = 50`) and aligns the next pulse frame to a global 50-frame cadence:
   $$F_{\text{expire}} = n_{\text{Delay}} \cdot \left\lfloor \frac{F_{\text{game}} + n_{\text{Delay}} - 1}{n_{\text{Delay}}} \right\rfloor + 1$$
2. Computes the buff/debuff statlist duration:
   $$\Delta F = F_{\text{expire}} - F_{\text{game}} + 1$$
   *(Guaranteeing a 1-frame overlap so party members and enemies inside the radius never experience a gap between 2-second aura pulses).*

### 2.2 Radial Target Filter Bitmask (`sub_6FD0FA00` @ `D2Game.dll`)
When an aura pulses via `sub_6FD0FE80(pGame, pUnit, 0, 0, nAuraRange, dwAuraFilter, pfnCallback, &args, ...)`, candidate units within `aurarangecalc` sub-tiles ($1 \text{ sub-tile} = \frac{2}{3} \text{ yard}$) are filtered by `sub_6FD0FA00` (`Skills.cpp:404–609`) against `Skills.txt` `aurafilter`:

| Bitmask | Decimal | Filter Predicate in `sub_6FD0FA00` |
| :---: | :---: | :--- |
| `0x00001` | `1` | Allow `UNIT_PLAYER` (alive unless `0x1000` is set) |
| `0x00002` | `2` | Allow `UNIT_MONSTER` (alive unless `0x1000` is set) |
| `0x00004` | `4` | Monster must be Undead (`MONSTERS_IsUndead(pTarget)`) |
| `0x00080` | `128` | Target must have `UNITFLAG_CANBEATTACKED` |
| `0x00100` | `256` | Target room must **not** be in town (`!DUNGEON_IsRoomInTown`) |
| `0x00200` | `512` | Line-of-Sight raytrace (`!COLLISION_RayTrace(pRoom, &src, &dst, 4u)`) |
| `0x00400` | `1024` | Target must have `UNITFLAG_ISVALIDTARGET` |
| `0x04000` | `16384` | Monster must **not** be an Act Boss (`!MONSTERS_IsBoss(nullptr, pTarget)`) |
| `0x08000` | `32768` | Target must be hostile (`sub_6FCBD900`) |
| `0x10000` | `65536` | Target must be aligned/friendly (`SUNIT_AreUnitsAligned`) and not an NPC |
| `0x40000` | `262144` | Monster must **not** be a Prime Evil (`!MONSTERS_IsPrimeEvil(pTarget)`) |

**Decoded `aurafilter` Values Across Offensive Auras**:
- **`73731` (`0x12003`)** — Might, Thorns, Blessed Aim, Concentration, Fanaticism: Friendly Players (`0x1`) + Friendly Monsters/Mercenaries/Minions (`0x2` + `0x10000`), works in town (`0x100` unset) and through walls (`0x200` unset).
- **`42883` (`0xA783`)** — Holy Fire, Holy Shock: Hostile Players & Monsters (`0x8003`), attackable & valid (`0x480`), outside town (`0x100`), requires Line-of-Sight (`0x200`).
- **`303747` (`0x4A283`)** — Holy Freeze: Hostile Players & Monsters (`0x8003`), attackable (`0x80`), requires Line-of-Sight (`0x200`), **excludes Prime Evils** (`0x40000`, `PrimeEvil=1` in `MonStats.txt`).
- **`59270` (`0xE786`)** — Sanctuary: Hostile **Monsters only** (`0x8002`, bit `0x1` unset so never pulses on players), **Undead only** (`0x4`), **excludes Act Bosses** (`0x4000`), outside town (`0x100`), requires Line-of-Sight (`0x200`).
- **`42371` (`0xA583`)** — Conviction: Hostile Players & Monsters (`0x8003`), attackable & valid (`0x480`), outside town (`0x100`), **no Line-of-Sight raytrace** (`0x200` unset — pierces walls!).

---

## 3. MPQ Data Tables (`Skills.txt`, `States.txt`, `Missiles.txt`)

### 3.1 `Skills.txt` Summary Table

| ID | Skill | ReqLvl | `srvdo` | `aurastate` / `auratargetstate` | `aurafilter` | Radius (`aurarangecalc` sub-tiles) | Caster Passive Stats (`passivestat1..2`) | Aura Stats (`aurastat1..4` & Formulas) |
| :---: | :--- | :---: | :---: | :--- | :---: | :--- | :--- | :--- |
| `98` | **Might** | 1 | `65` | `might` (`#33`) / `might` (`#33`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | — | `damagepercent` = `40 + 10*(slvl-1)`% |
| `102` | **Holy Fire** | 6 | `66` | `holyfire` (`#35`) / — | `42883` (`0xA783`) | `6 + 1*(slvl-1)` | `firemindam = enms*6/256`, `firemaxdam = exms*6/256` | Radial Fire pulse (`HitShift=7`, $6\times$ added to caster attacks); Synergies: `+18%*Resist Fire.blvl + 6%*Salvation.blvl` |
| `103` | **Thorns** | 6 | `65` | `thorns` (`#36`) / `thorns` (`#36`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | — | `thorns_percent` = `250 + 40*(slvl-1)`% |
| `108` | **Blessed Aim** | 12 | `65` | `blessedaim` (`#40`) / `blessedaim` (`#40`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | `passivestate=penetrate` (`#67`), `item_tohit_percent = Blessed Aim.blvl * 5`% | `item_tohit_percent` = `75 + 15*(slvl-1)`% |
| `113` | **Concentration** | 18 | `65` | `concentration` (`#42`) / `concentration` (`#42`) | `73731` (`0x12003`) | `16 + 2*(slvl-1)` | — | `damagepercent` = `60 + 15*(slvl-1)`%; `skill_concentration` = `20`% (uninterruptible chance) |
| `114` | **Holy Freeze** | 18 | `81` | `holywind` (`#43`) / `holywindcold` (`#44`) | `303747` (`0x4A283`) | `6 + 1*(slvl-1)` | `coldmindam = enms*5/256`, `coldmaxdam = exms*5/256` | `velocitypercent`, `attackrate`, `other_animrate` = `-dm34` (`-25`..`-60`%); Radial Cold pulse ($5\times$ added to attacks); Synergies: `+15%*Resist Cold.blvl + 7%*Salvation.blvl` |
| `118` | **Holy Shock** | 24 | `66` | `holyshock` (`#46`) / — | `42883` (`0xA783`) | `6 + 1*(slvl-1)` | `lightmindam = 1`, `lightmaxdam = exms*6/256` | Radial Lightning pulse ($6\times$ max added to caster attacks); Synergies: `+12%*Resist Lightning.blvl + 4%*Salvation.blvl` |
| `119` | **Sanctuary** | 24 | `66` | `sanctuary` (`#47`) / — | `59270` (`0xE786`) | `5 + 1*(slvl-1)` | — | Caster `item_undeaddamage_percent` = `150 + 30*(slvl-1)`%, `item_undead_tohit` = `100 + 50*(slvl-1)`, `skill_bypass_undead = 1`; Radial Undead Magic/Knockback pulse (`ResultFlags=11`, `+7%*Cleansing.blvl` synergy) |
| `122` | **Fanaticism** | 30 | `65` | `fanaticism` (`#49`) / `fanaticism` (`#49`) | `73731` (`0x12003`) | `11 + 1*(slvl-1)` | `damagepercent = (50 + 17*(slvl-1))/2` (extra half added to caster) | `attackrate` = `dm34` (`10`..`40`% IAS); `item_tohit_percent` = `40 + 5*(slvl-1)`%; Party `damagepercent` = `(50 + 17*(slvl-1))/2`% |
| `123` | **Conviction** | 30 | `66` | `conviction` (`#28`) / `conviction` (`#28`) | `42371` (`0xA583`) | `20` (13.33 yds flat) | — | `skill_armor_percent` = `-dm56` (`-40`..`-100`% Defense); `fireresist`, `coldresist`, `lightresist` = `-min(30 + 5*(slvl-1), 150)`% |

### 3.2 `States.txt` & `Missiles.txt` Records

| State ID | State Name | `immed` | `overlay1` / `overlay2` | `onsound` | Special State Flags |
| :---: | :--- | :---: | :--- | :--- | :--- |
| `28` | `conviction` | `0` | `convictionfront` / `convictionback` | `paladin_aura_purification` | `aura=1` (shared by caster & debuffed enemies) |
| `33` | `might` | `1` | `aura_might_front` / `aura_might_back` | `paladin_aura_might` | `aura=1`, `damblue=1` |
| `35` | `holyfire` | `0` | `aura_holyfire_front` / `aura_holyfire_back` | `paladin_aura_holyfire` | `aura=1` |
| `36` | `thorns` | `0` | `aura_thorns_front` / `aura_thorns_back` | `paladin_aura_thorns` | `aura=1` |
| `40` | `blessedaim` | `1` | `blessedaimfront` / `blessedaimback` | `paladin_aura_blessedaim` | `aura=1`, `attblue=1`; passive uses `penetrate` (`#67`) |
| `42` | `concentration` | `1` | `concentrationfront` / `concentrationback` | `paladin_aura_concentration` | `aura=1`, `damblue=1` |
| `43` | `holywind` | `0` | `holyfreeze` / — | `paladin_aura_holywind` | Caster state for Holy Freeze |
| `44` | `holywindcold` | `0` | `null` (`castoverlay=ice_explode`) | `impact_bluemotize_1` | Target debuff (`blue=1`, `colorshift=108`) |
| `46` | `holyshock` | `0` | `holyshockfront` / `holyshockback` | `paladin_aura_holylight` | `aura=1` |
| `47` | `sanctuary` | `0` | `sanctuaryfront` / `sanctuaryback` | `paladin_aura_sanctuary` | `active=1`, `cltactivefunc=86` (`0x6FADBB50`) |
| `49` | `fanaticism` | `1` | `fanaticismfront` / `fanaticismback` | `paladin_aura_fanatacism` | `aura=1`, `attblue=1`, `damblue=1` |
| `107` | `shatter` | `0` | — | — | `shatter=1`, `hide=1`, `udead=1` (20% roll on Holy Freeze pulse) |

- **Missile `#57` (`sanctuarybolt`)**: `pCltDoFunc = 1` (`0x6FB617C0`), `pSrvDoFunc = 1` (`0x6FC5F540`), `CelFile = Gleam`, `Range = 14` frames, `AnimLen = 8`, `LoopAnim = 1`, `Trans = 1`, `Holy = 1` (purely visual rising light gleam spawned by `SkillCltDoFunc_86`).

---

## 4. Detailed Aura Reverse-Engineering

### 4.1 Friendly Party Stat Auras (`SKILLS_SrvDo065_BasicAura` @ `0x6FCBA8D0`)
**Might** (`#98`), **Thorns** (`#103`), **Blessed Aim** (`#108`), **Concentration** (`#113`), and **Fanaticism** (`#122`) all execute through `SKILLS_SrvDo065_BasicAura` (`0x6FCBA8D0`) and its radial callback `SKILLS_AuraCallback_BasicAura` (`SkillPal.cpp:349–482`):

#### 4.1.1 Might (`#98`)
- Grants `aurastat1 = damagepercent` (`#25`) $= 40 + 10(\text{slvl} - 1)\%$ to the Paladin and all aligned party members/minions within `16 + 2*(slvl - 1)` sub-tiles.
- Applied as an off-weapon Enhanced Damage% stat on the `STATE_MIGHT` (`#33`) statlist.

#### 4.1.2 Thorns (`#103`)
- Grants `aurastat1 = thorns_percent` (`#132`) $= 250 + 40(\text{slvl} - 1)\%$ within `16 + 2*(slvl - 1)` sub-tiles.
- When a melee physical attack hits a unit with `STATE_THORNS` (`#36`), `SUNITDMG_ExecuteEvents` reflects physical damage equal to $\lfloor D_{\text{dealt}} \times \frac{\text{thorns\_percent}}{100} \rfloor$ back to the attacker (subject to the 1/4 PvP thorns penalty against players).

#### 4.1.3 Blessed Aim (`#108`) — Active Aura vs Passive `penetrate` (`#67`)
- **Passive Bonus (Aura Inactive)**: Blessed Aim defines `passivestate = penetrate` (`#67`), `passivestat1 = item_tohit_percent`, and `passivecalc1 = skill('Blessed Aim'.blvl) * 5`. Whenever `D2GAME_RefreshPassiveSkills_6FD14CC0` runs, investing hard points (`blvl`) in Blessed Aim grants a permanent passive **$+5\% \times \text{blvl}$ Attack Rating** bonus even when another aura is active!
- **Active Aura Suppression (`SkillPal.cpp:455–464`)**: When Blessed Aim is the active aura (`aurastat1 = item_tohit_percent` $= 75 + 15(\text{slvl} - 1)\%$), `SKILLS_AuraCallback_BasicAura` checks `pSkillsTxtRecord->nPassiveState` (`67`). For the caster (`pUnit == pAuraCallback->pOwner`), it **strips the passive `STATE_PENETRATE` statlist** (`D2Common_10474(pUnit, pPassiveStatList)` + `STATES_ToggleState(pUnit, 67, 0)`) so the active $+75\%..$ AR bonus **replaces** the $+5\% \cdot \text{blvl}$ passive bonus rather than stacking with it! When the Paladin switches off Blessed Aim, `SKILLS_CurseStateCallback_BasicAura` calls `D2GAME_RefreshPassiveSkills_6FD14CC0(pUnit)` to immediately restore the passive bonus.

#### 4.1.4 Concentration (`#113`)
- Grants `aurastat1 = damagepercent` $= 60 + 15(\text{slvl} - 1)\%$ and `aurastat2 = skill_concentration` (`#168`) $= 20\%$ (`Param5 = 20`, constant across all skill levels).
- **`skill_concentration` (`20%` Uninterruptible)**: Checked when an attack is in progress to give a flat 20% chance to ignore hit-recovery interruption.
- **Blessed Hammer (`#112`) Synergy**: `SKILLS_GetConcentrationDamageBonus` (`D2Common/src/D2Skills.cpp:1772`) reads `STAT_DAMAGEPERCENT` from the `STATE_CONCENTRATION` (`#42`) statlist and grants `Param1 / 8 = 4 / 8 = 50%` of Concentration's `%ED` as a direct multiplier to Blessed Hammer's Magic damage!

#### 4.1.5 Fanaticism (`#122`) — Caster Full ED vs Party Half ED Split
Fanaticism grants full Enhanced Damage% to the Paladin himself and **half** Enhanced Damage% to party members through a clever `aurastat3` + `passivestat1` split in `SKILLS_SrvDo065_BasicAura` (`SkillPal.cpp:250–281`):
1. `aurastat1 = attackrate` (`#68`, EIAS/IAS): `dm34` (`10`..`40`%, giving $+14\%$ IAS at slvl 1 up to $+35\%$ at slvl 20, shared equally by caster and party).
2. `aurastat2 = item_tohit_percent` (`#119`, `%AR`): `toht = 40 + 5*(slvl - 1)`% (shared equally by caster and party).
3. `aurastat3 = damagepercent` (`#25`, `%ED`): `ln56 / 2` where `ln56 = 50 + 17*(slvl - 1)`%. Every unit receiving `STATE_FANATICISM` (`#49`) — **including the caster** — receives $\lfloor \frac{50 + 17(\text{slvl} - 1)}{2} \rfloor\%$ from `aurastat3`.
4. **Caster Self-Stat Injection (`SkillPal.cpp:268–279`)**: Because Fanaticism sets `passivestate = 0` (`< 0`/none) while defining `passivestat1 = damagepercent` and `passivecalc1 = ln56`, `D2GAME_RefreshPassiveSkills_6FD14CC0` ignores it when inactive (`nPassiveState <= 0`). Instead, `SKILLS_SrvDo065_BasicAura` explicitly iterates `wPassiveStat[j]` when `nPassiveState < 0` and adds `SKILLS_EvaluateSkillFormula(pUnit, dwPassiveCalc[0]) - nAuraStatCalcValue[2]` (or in `Skills.txt` `passivecalc1 = ln56` combined with `SKILLS_AddStatToStatList` in `SrvDo065`) directly onto the **caster's own** `STATE_FANATICISM` statlist!
   - Specifically, at `SkillPal.cpp:256–279`, the caster's own `pStatList` first receives `aurastat3` (`ln56 / 2`), and then `SKILLS_AddStatToStatList` (`line 277`) overwrites/adds `passivestat1 = damagepercent` with `passivecalc1 = ln56` (`50 + 17*(slvl - 1)`%) on the caster's `STATE_FANATICISM` statlist, while party members (`SKILLS_AuraCallback_BasicAura`) only receive `aurastat1..3` (`ln56 / 2`)!
   $$\text{ED}_{\text{caster}} = 50 + 17(\text{slvl} - 1)\%, \qquad \text{ED}_{\text{party}} = \left\lfloor \frac{50 + 17(\text{slvl} - 1)}{2} \right\rfloor\%$$

---

### 4.2 Elemental Pulse & Undead/Debuff Auras (`SKILLS_SrvDo066` @ `0x6FCBAF50`)

**Holy Fire** (`#102`), **Holy Shock** (`#118`), **Sanctuary** (`#119`), and **Conviction** (`#123`) share `SKILLS_SrvDo066_HolyFire_HolyShock_Sanctuary_Conviction` (`0x6FCBAF50`) and its radial callback `SKILLS_AuraCallback_HolyFire_HolyShock_Sanctuary_Conviction` (`SkillPal.cpp:575–618`):

#### 4.2.1 Holy Fire (`#102`) & Holy Shock (`#118`)
1. **Caster Self-Attack Damage (`passivestat1..2` on Active Aura Statlist)**:
   - On each 50-frame tick, `SrvDo066` creates/updates the caster's `aurastate` statlist (`STATE_HOLYFIRE` `#35` or `STATE_HOLYSHOCK` `#46`) and injects `passivestat1` and `passivestat2` onto the Paladin's weapon/attack stats:
     - **Holy Fire (`#102`)**: `HitShift = 7` ($2^7 = 128$, so `enms`/`exms` evaluate base damage $\times 128$ with synergies `+18%*Resist Fire.blvl + 6%*Salvation.blvl`). `passivecalc1 = enms * 6 / 256` (`firemindam`) and `passivecalc2 = exms * 6 / 256` (`firemaxdam`), which converts 256ths back to integer points and multiplies by `Param5 = 6` — adding **exactly $6\times$ the radial pulse fire damage** onto the Paladin's melee and ranged weapon attacks!
     - **Holy Shock (`#118`)**: `HitShift = 8`, `Param5 = 6`, `passivecalc1 = 1` (`lightmindam = 1`), `passivecalc2 = exms * 6 / 256` (`lightmaxdam`). Adds **$6\times$ the radial pulse max lightning damage** (`+12%*Resist Lightning.blvl + 4%*Salvation.blvl` synergies) onto the Paladin's attacks!
   - *(Note: If a Sorceress equips Holy Fire or Holy Shock via *Hand of Justice* / *Dragon* / *Dream*, `SUNITDMG` applies Fire/Lightning Mastery twice to melee attacks: once when `enms`/`exms` evaluates skill elemental damage onto the aura statlist, and a second time when `SUNITDMG` scales `firemindam`/`lightmaxdam` on melee strike!)*
2. **Radial Enemy Pulse (`SKILLS_AuraCallback_HolyFire_HolyShock_Sanctuary_Conviction`)**:
   - Rolls one shared `D2DamageStrc` via `D2GAME_RollElementalDamage_6FD14DD0` (`wResultFlags = 16385 | 0x20` = `0x4021`, `dwHitClass |= 0xD`) and applies it to every hostile unit passing `aurafilter = 42883` (`0xA783`, requires Line-of-Sight) within `6 + 1*(slvl - 1)` sub-tiles every 2 seconds.

#### 4.2.2 Sanctuary (`#119`)
Sanctuary combines **three distinct mechanics** across `SrvDo066` (`0x6FCBAF50`), `SUNITDMG_ApplyResistancesAndAbsorb` (`0x6FCBFB40`), and `SkillCltDoFunc_86` (`0x6FADBB50`):
1. **Caster Self-Buffs (`aurastat1..3` on `STATE_SANCTUARY` `#47`)**:
   - Note that Sanctuary sets `auratargetstate` to empty (`-1`), so `SrvDo066` places `aurastat1..3` onto **the caster's own `STATE_SANCTUARY` statlist** (`SkillPal.cpp:498–503`):
     - `aurastat1 = item_undeaddamage_percent` (`#122`): `150 + 30*(slvl - 1)`%
     - `aurastat2 = item_undead_tohit` (`#124`): `100 + 50*(slvl - 1)` flat Attack Rating vs Undead
     - `aurastat3 = skill_bypass_undead` (`#356`): `1`
   - *(Bug/Quirk Verified in Binary: In `SUNITDMG_AllocDamageData` (`SUnitDmg.cpp:546`), `STAT_SKILL_BYPASS_UNDEAD` sets `DAMAGEHITFLAG_BYPASSUNDEAD`, while `item_undeaddamage_percent` on a state statlist is famously NOT summed into weapon physical `%ED vs Undead` in 1.13c because `SUNITDMG_ApplyDamageBonuses` only queries item-based `STAT_ITEM_UNDEADDAMAGE_PERCENT` or excludes aura state statlists for that specific stat; however, `skill_bypass_undead` works at 100% effectiveness!)*
2. **Undead Physical Resistance & Immunity Bypass (`SUNITDMG_ApplyResistancesAndAbsorb` @ `0x6FCBFB40`)**:
   - In `SUnitDmg.cpp:896–1015`, when an attacker has `STATE_SANCTUARY` (`#47`) or `DAMAGEHITFLAG_BYPASSUNDEAD` (inherited by both melee attacks and missiles via `Missile.cpp:672`) and hits an Undead defender (`MONSTERS_IsUndead(pDefender)`):
     - Line 1002: `if (pDamageStatTableRecord->nResStatId == STAT_DAMAGERESIST && STATES_CheckState(pDamageInfo->pAttacker, STATE_SANCTUARY) && MONSTERS_IsUndead(pDamageInfo->pDefender)) { nResValue = 0; }`
     - Line 1012: `if (bDontAbsorb) { nResValue = std::min(nResValue, 0); }`
   - Any positive resistance (`> 0%`, **including $\ge 100\%$ Physical Immunity** on Ghosts, Wraiths, and Specters!) is clamped to **`0%`**, while negative resistances (e.g., `-50%` from Decrepify or `-100%` from Amplify Damage) remain untouched!
3. **2-Second Radial Undead Knockback & Magic Pulse (`SrvDo066`)**:
   - Every 50 frames (`perdelay = 50`, `mana = 1` per pulse if any undead is hit), `SrvDo066` scans `5 + 1*(slvl - 1)` sub-tiles with `aurafilter = 59270` (`0xE786`: hostile Undead Monsters only, **non-Boss** `!MONSTERS_IsBoss`, Line-of-Sight required).
   - Deals Magic damage (`EMin = 8` `+4/4/5/5/6`, `EMax = 16` `+4/5/6/6/7`, `+7%*Cleansing.blvl` synergy) with `ResultFlags = 11` (`0x0B` = `DAMAGERESULTFLAG_SUCCESSFULHIT (1) | DAMAGERESULTFLAG_WILLDIE (2) | DAMAGERESULTFLAG_KNOCKBACK (8)`), knocking back every non-boss Undead monster in range and applying `castoverlay = cast_undead` (`HolyBoltCloud`).
4. **Client Visual Gleam Spawner (`SkillCltDoFunc_86` @ `0x6FADBB50`)**:
   - Because `States.txt` sets `active = 1`, `cltactivefunc = 86` on `sanctuary` (`#47`), `D2Client.dll` invokes `g_apfnSkillCltDoFunc[86]` (`0x6FADBB50`) every tick while `STATE_SANCTUARY` is active on a unit.
   - Evaluates `aurarangecalc` (`5 + 1*(slvl - 1)`) via `D2Common#11276`, picks random `(dx, dy)` offsets inside the aura radius (`0x6FAFC520` PRNG), and spawns `cltmissilea = sanctuarybolt` (`#57`, `Gleam`) rising vertically at random ground spots inside the Sanctuary perimeter!

#### 4.2.3 Conviction (`#123`) & The 1/5 Immunity Penalty (`sub_6FD0B3D0`)
Conviction uses `SKILLS_SrvDo066` (`0x6FCBAF50`) with `auratargetstate = conviction` (`#28`) and no elemental pulse damage (`EType` empty), delegating enemy debuff application to `SKILLS_AuraCallback_BasicAura` (`SkillPal.cpp:596`):
1. **Radius & Wall Piercing**:
   - Constant radius `aurarangecalc = ln12 = 20` sub-tiles (`13.33` yards at all levels, since `Param1 = 20`, `Param2 = 0`).
   - Uses `aurafilter = 42371` (`0xA583`), which **omits bit `0x200` (Line-of-Sight)** — Conviction's green ring debuffs enemies through walls and closed doors!
2. **Enemy Stat Reductions (`aurastat1..4`)**:
   - `aurastat1 = skill_armor_percent` (`#171`): `-dm56` (`-40`..`-100`% Enemy Defense, giving `-49%` at slvl 1 up to `-90%` at slvl 20; additive with enemy `%EDef` buffs like Stone Skin or Shout, or directly multiplies base defense if unbuffed).
   - `aurastat2 = fireresist` (`#39`), `aurastat3 = coldresist` (`#43`), `aurastat4 = lightresist` (`#41`):
     $$R_{\text{debuff}} = -\min\left(30 + 5(\text{slvl} - 1), 150\right)\%$$
     *(Hard-capped at **`-150%`** at **slvl 25**).*
   - *(Note: Conviction does NOT lower Poison Resistance `#45` or Magic Resistance `#37`).*
3. **1/5 Immunity Breaking Penalty (`sub_6FD0B3D0` @ `D2Game.dll`, `SkillNec.cpp:273–292`)**:
   - Inside `SKILLS_AuraCallback_BasicAura` (`SkillPal.cpp:391`), each stat value is filtered through `sub_6FD0B3D0(pUnit, nStatId, nResist)`:
     ```cpp
     if (nResist > 0 || pUnit->dwUnitType == UNIT_PLAYER || MONSTERS_GetHirelingTypeId(pUnit)
         || STATLIST_GetUnitBaseStat(pUnit, nStatId, 0) < 100)
     {
         return nResist;
     }
     return nResist / 5;
     ```
   - **Players & Hirelings (`UNIT_PLAYER` / `MONSTERS_GetHirelingTypeId`)**: Never receive the 1/5 penalty; Conviction always applies its full `-150%` against players and mercenaries even if their stacked resistances exceed 100%!
   - **Monsters with Base Resistance $\ge 100\%$ (`STATLIST_GetUnitBaseStat >= 100`)**: Negative resistance (`nResist < 0`) is integer-divided by **5**:
     $$R_{\text{effective}} = \left\lfloor \frac{R_{\text{debuff}}}{5} \right\rfloor$$
     At the `-150%` cap (slvl 25), Conviction applies `-150 / 5 = -30%` to immune monsters, breaking elemental immunities up to **`129%`** (`129 - 30 = 99%`). Because `sub_6FD0B3D0` checks **base stat** (`STATLIST_GetUnitBaseStat >= 100`), a natively immune monster continues to penalize both Conviction and Lower Resist by `1/5` even after one of them lowers its current resistance below `100%`!

---

### 4.3 Holy Freeze (`#114` — `SKILLS_SrvDo081_HolyFreeze` @ `0x6FCBABC0`)

Holy Freeze uses a dedicated server handler `SKILLS_SrvDo081_HolyFreeze` (`0x6FCBABC0`) and callback `SKILLS_AuraCallback_HolyFreeze` (`SkillPal.cpp:1414–1460`):
1. **Caster Self-Attack Cold Damage**:
   - Applies `aurastate = holywind` (`#43`) to the Paladin and injects `passivestat1 = coldmindam` (`enms * 5 / 256`) and `passivestat2 = coldmaxdam` (`exms * 5 / 256`) onto the Paladin's attacks (**$5\times$ the radial cold pulse damage**, scaled by `+15%*Resist Cold.blvl + 7%*Salvation.blvl` synergies).
2. **Prime Evil & `ColdEffect >= 0` Exclusions**:
   - `aurafilter = 303747` (`0x4A283`) sets bit `0x40000` (`!MONSTERS_IsPrimeEvil`), preventing Holy Freeze from pulsing on Prime Evils (Andariel, Duriel, Mephisto, Diablo, Baal).
   - Inside `SKILLS_AuraCallback_HolyFreeze` (`lines 1417–1424`), if `pUnit->dwUnitType == UNIT_MONSTER` and `pMonStatsTxtRecord->nColdEffect[nDifficulty] >= 0` (`ColdEffect >= 0` in `MonStats.txt`, e.g., Frozen Horrors, Death Lords, Stygian Dolls in Hell), the callback immediately returns `0` — making `ColdEffect >= 0` monsters completely immune to **both** the slow and the cold damage pulse!
   - By contrast, Cold-Immune monsters (`ColdResist >= 100%`) whose `ColdEffect < 0` ARE slowed by Holy Freeze, because `SKILLS_AuraCallback_BasicAura` applies `aurastat1..3` unconditionally before `SUNITDMG_ExecuteEvents` checks Cold Resistance!
3. **Triple Slow Debuff (`STATE_HOLYWINDCOLD` `#44`) & Cannot-Be-Frozen Bypass**:
   - Applies `auratargetstate = holywindcold` (`#44`, `castoverlay = ice_explode`, blue tint `colorshift = 108`) with three identical diminishing-returns slow stats (`-dm34`, `Param3 = 25`, `Param4 = 60`%, giving `-30%` at slvl 1 up to `-54%` at slvl 20):
     - `aurastat1 = velocitypercent` (`#67`): `-dm34`% Run/Walk Speed
     - `aurastat2 = attackrate` (`#68`): `-dm34`% Attack Speed (EIAS)
     - `aurastat3 = other_animrate` (`#69`): `-dm34`% Other Animation Rate
   - Because these are direct stat reductions on an aura state (`#44`) rather than cold-length chill (`STATE_FREEZE` / `STAT_COLDLENGTH`), **Cannot Be Frozen (`STAT_ITEM_CANNOTBEFROZEN`) does NOT prevent Holy Freeze's slow!**
4. **20% Corpse Shatter Roll (`STATE_SHATTER` `#107`)**:
   - On every 50-frame pulse (`SkillPal.cpp:1457`), `SKILLS_AuraCallback_HolyFreeze` executes:
     ```cpp
     STATES_ToggleState(pUnit, STATE_SHATTER, (ITEMS_RollRandomNumber(&pUnit->pSeed) % 100) < 20);
     ```
   - Every affected enemy has a **20% chance** per pulse to have `STATE_SHATTER` (`#107`) toggled on (and an 80% chance to have it toggled off on the next pulse!), causing monsters killed while `STATE_SHATTER` is active to shatter into ice fragments without leaving a corpse!
