# Diablo II v1.13c Barbarian Warcries (`Skills.txt` #130, #131, #137, #138, #142, #146, #149, #150, #154, #155)

## 1. Dispatch Tables (`D2Client.dll` `0x6FAB0000`, `D2Game.dll` `0x6FC20000`)

### Client Skill & Missile Dispatch (`D2Client.dll`)
- `g_apfnSkillCltStFunc` (VA `0x6FB8E928`):
  - `[26]` = `0x6FB76400` (`SKILLS_CltSt26_FindPotion_GrimWard`)
  - `[28]` = `0x6FB76350` (`SKILLS_CltSt28_FindItem`)
- `g_apfnSkillCltDoFunc` (VA `0x6FB8EA48`):
  - `[25]` = `0x6FB23CB0` (`SKILLS_CltDo25_Nova_RingMissile`)
  - `[38]` = `0x6FB763A0` (`SKILLS_CltDo38_FindPotion`)
  - `[40]` = `0x6FB762E0` (`SKILLS_CltDo40_FindItem`)
  - `[41]` = `0x6FB77000` (`SKILLS_CltDo41_GrimWard`)
- `g_apfnMissileCltDoFunc` (VA `0x6FB8D8A0`):
  - `[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard`)
  - `[11]` = `0x6FB62DC0` (`MISSMODE_CltDo11_GrimWardStop`)
- `g_apfnMissileCltHitFunc` (VA `0x6FB8DA10`):
  - `[10]` = `0x6FB62570` (`MISSMODE_CltHit10_WarCry_ProgOverlay`)
  - `[29]` = `0x6FB66120` (`MISSMODE_CltHit29_GrimWard`)

### Server Skill & Missile Dispatch (`D2Game.dll`)
- `gpSkillSrvStartFnTable` (VA `0x6FD27338`):
  - `[33]` = `0x6FC47270` (`SKILLS_SrvSt33_FindPotion_GrimWard`)
  - `[34]` = `0x6FC47240` (`SKILLS_SrvSt34_FindItem`)
- `gpSkillSrvDoFnTable` (VA `0x6FD274A8`):
  - `[22]` = `0x6FC63AA0` (`SKILLS_SrvDo022_NovaAttack`)
  - `[30]` = `0x6FC705D0` (`SKILLS_SrvDo030_Curse`)
  - `[68]` = `0x6FC49720` (`SKILLS_SrvDo068_BasicShout`)
  - `[69]` = `0x6FC47600` (`SKILLS_SrvDo069_FindPotion`)
  - `[71]` = `0x6FC49000` (`SKILLS_SrvDo071_Taunt`)
  - `[72]` = `0x6FC476D0` (`SKILLS_SrvDo072_FindItem`)
  - `[75]` = `0x6FC47C90` (`SKILLS_SrvDo075_GrimWard`)
- `MissileSrvDoFunc` (VA `0x6FD2D970`):
  - `[1]` = `0x6FC5F540` (`MISSMODE_SrvDo01_BasicMissile`)
  - `[14]` = `0x6FC60E10` (`MISSMODE_SrvDo14_GrimWard`)
- `MissileSrvHitFunc` (VA `0x6FD2DA48`):
  - `[17]` = `0x6FC5EAE0` (`MISSMODE_SrvHit17_Howl`)
  - `[18]` = `0x6FC5EA60` (`MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders`)
  - `[21]` = `0x6FC5ABD0` (`MISSMODE_SrvHit21_BattleCry`)
  - `[26]` = `0x6FC5C990` (`MISSMODE_SrvHit26_GrimWardStart`)
  - `[27]` = `0x6FC58EC0` (`MISSMODE_SrvHit27_GrimWard`)
  - `[28]` = `0x6FC5E740` (`MISSMODE_SrvHit28_GrimWardScare`)
- `MissileSrvDmgFunc` (VA `0x6FD2DB68`):
  - `[7]` = `0x6FC59600` (`MISSMODE_SrvDmg07_Warcry_ShockWave`)

---

## 2. `Skills.txt` & `Missiles.txt` Overview (Barbarian Warcries)

### 2.1 `Skills.txt` Summary (`anim = SC` for all 10 Warcries, scaled by Faster Cast Rate)

| ID | Skill | `reqlevel` | `srvstfunc` | `srvdofunc` | `cltstfunc` | `cltdofunc` | `srvmissile` / `cltmissilea` | `aurastate` / `auratargetstate` | `mana` (`lvlmana`) | `InTown` |
|---:|---|---:|---:|---:|---:|---:|---|---|---|---:|
| 130 | `Howl` | 1 | — | 22 | — | 25 | `howl` (`#148`) | — / `terror` (`#56`) | `4` (`0`) | 0 |
| 131 | `Find Potion` | 1 | 33 | 69 | 26 | 38 | — | — / `corpse_noselect` (`#118`) | `2` (`0`) | 0 |
| 137 | `Taunt` | 6 | — | 71 | — | — | — | — / `taunt` (`#27`) | `3` (`0`) | 0 |
| 138 | `Shout` | 6 | — | 68 | — | 25 | `shout` (`#149`) | `shout` (`#26`) | `6` (`0`) | 1 |
| 142 | `Find Item` | 12 | 34 | 72 | 28 | 40 | — | — / `corpse_noselect` (`#118`) | `7` (`0`) | 0 |
| 146 | `Battle Cry` | 18 | — | 68 | — | 25 | `battlecry` (`#219`) | — / `battlecry` (`#89`) | `10` (`+1`) | 0 |
| 149 | `Battle Orders` | 24 | — | 68 | — | 25 | `battleorders` (`#237`) | `battleorders` (`#32`) | `7` (`0`) | 1 |
| 150 | `Grim Ward` | 24 | 33 | 75 | 26 | 41 | `grimward*start` (`#249/#252/#255`) | — / `terror` (`#56`) | `4` (`0`) | 0 |
| 154 | `War Cry` | 30 | — | 68 | — | 25 | `warcry` (`#235`) | — / `stunned` (`#28`) | `10` (`+1`) | 0 |
| 155 | `Battle Command` | 30 | — | 68 | — | 25 | `battlecommand` (`#236`) | `battlecommand` (`#51`) | `11` (`0`) | 1 |

### 2.2 `Missiles.txt` Suite for Warcries & Grim Ward

| ID | Missile | `SrvDoFunc` | `SrvHitFunc` | `SrvDmgFunc` | `CltDoFunc` | `CltHitFunc` | `Vel` (`MaxVel`) | `Range` (`LevRange`) | `CelFile` (`AnimLen`) | `CollideType` | `CollideFriend` | `NextHit` (`NextDelay`) |
|---:|---|---:|---:|---:|---:|---:|---|---:|---|---:|---:|---|
| 148 | `howl` | 1 | 17 | — | 1 | — | `12` (`24`) | `12` (`+1`) | `BattleOrders` (`5`) | 3 | 0 | `1` (`4`) |
| 149 | `shout` | 1 | 18 | — | 1 | — | `16` (`16`) | `16` (`0`) | `DoubleDamage1` (`5`) | 3 | 1 | `1` (`4`) |
| 219 | `battlecry` | 1 | 21 | — | 1 | — | `16` (`16`) | `8` (`0`) | `BattleCry` (`5`) | 3 | 0 | `1` (`4`) |
| 235 | `warcry` | 1 | — | 7 | 1 | 10 | `16` (`16`) | `8` (`0`) | `WarCry` (`5`) | 3 | 0 | `1` (`4`) |
| 236 | `battlecommand` | 1 | 18 | — | 1 | — | `16` (`16`) | `16` (`0`) | `Shout` (`5`) | 3 | 1 | `1` (`4`) |
| 237 | `battleorders` | 1 | 18 | — | 1 | — | `16` (`16`) | `16` (`0`) | `FastAttack1` (`5`) | 3 | 1 | `1` (`4`) |
| 249 | `grimwardsmallstart` | 1 | 26 | — | 1 | 29 | `0` (`0`) | `5` (`0`) | `Totem1Start` (`5`) | 0 | 0 | `0` (`0`) |
| 250 | `grimwardsmall` | 14 | 27 | — | 1 | 29 | `0` (`0`) | `100` (`0`) | `Totem1` (`1`) | 0 | 0 | `0` (`0`) |
| 251 | `grimwardsmallstop` | 1 | — | — | 11 | — | `0` (`0`) | `16` (`0`) | `Totem1End` (`4`) | 0 | 0 | `0` (`0`) |
| 252 | `grimwardmediumstart` | 1 | 26 | — | 1 | 29 | `0` (`0`) | `8` (`0`) | `Totem2Start` (`8`) | 0 | 0 | `0` (`0`) |
| 253 | `grimwardmedium` | 14 | 27 | — | 1 | 29 | `0` (`0`) | `100` (`0`) | `Totem2` (`1`) | 0 | 0 | `0` (`0`) |
| 254 | `grimwardmediumstop` | 1 | — | — | 11 | — | `0` (`0`) | `32` (`0`) | `Totem2End` (`8`) | 0 | 0 | `0` (`0`) |
| 255 | `grimwardlargestart` | 1 | 26 | — | 1 | 29 | `0` (`0`) | `8` (`0`) | `Totem3Start` (`8`) | 0 | 0 | `0` (`0`) |
| 256 | `grimwardlarge` | 14 | 27 | — | 1 | 29 | `0` (`0`) | `100` (`0`) | `Totem3` (`1`) | 0 | 0 | `0` (`0`) |
| 257 | `grimwardlargestop` | 1 | — | — | 11 | — | `0` (`0`) | `32` (`0`) | `Totem3End` (`8`) | 0 | 0 | `0` (`0`) |

---

## 3. 64-Missile Expanding Ring Architecture (`Howl`, `Shout`, `Battle Orders`, `Battle Command`, `Battle Cry`, `War Cry`)

### 3.1 Ring Spawning (`CltDo25` @ `0x6FB23CB0`, `SrvDo022` @ `0x6FC63AA0`, `SrvDo068` @ `0x6FC49720`)
- All 6 expanding-ring Warcries spawn a **64-missile circular ring** centered on the Barbarian's coordinates:
  - **Client (`SKILLS_CltDo25` @ `0x6FB23CB0`)**: Reads `cltmissilea` (`wCltMissileA` at `SkillsTxt + 0x48`), evaluates `cltcalc1` (`+0x60`) as velocity delta, and calls `0x6FB22C90(pUnit, nMissileId, nSkillId, nSkillLevel, nVelDelta)` to spawn 64 radial missiles around the 64-entry direction circle (`lutTanToDirection` / `FOG_10083_Cos_LUT`).
  - **Server (`sub_6FD14170` in `D2Game/src/SKILLS/Skills.cpp:1765`)**: Loops `i = 0..63` over the 64-entry radial offset tables `dword_6FD29C18[i]` and `dword_6FD29D18[i]`, spawning 64 instances of `srvmissile` (`MISSILE_CreateMissileFromParams`) aimed outward at `(unitX + offsetX[i], unitY + offsetY[i])` with `nVelocity = MissilesTxt.nVel + calc1` (`nVel << 8`).
  - All 64 ring missiles set `Pierce = 1`, `LastCollide = 0` (passes through units), and `NextHit = 1` with `NextDelay = 4` (`4` frames of `UNIT_NEXTHIT` immunity so a single shout's overlapping 64 ring segments only hit each unit **once**!).

### 3.2 Party Buff Warcries (`Shout` #138, `Battle Orders` #149, `Battle Command` #155)
1. **Self-Application (`SrvDo068` @ `0x6FC49720`) & Ally-Application (`MISSMODE_SrvHit18` @ `0x6FC5EA60`)**:
   - In `SKILLS_SrvDo068_BasicShout`, the Barbarian first spawns the 64 ring missiles (`sub_6FD14170`) and then immediately calls `SKILLS_ApplyWarcryStats(pGame, pUnit, pUnit, nSkillId, nSkillLevel)` on **himself** (because the expanding missiles ignore the caster).
   - As the 64 missiles (`shout` #149, `battleorders` #237, `battlecommand` #236, all having `CollideFriend = 1`, `Vel = 16`, `Range = 16` ticks $\approx 10$ sub-tiles radius) collide with units (`MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders`), the handler checks:
     - `pTarget && pOwner && SUNIT_AreUnitsAligned(pGame, pOwner, pTarget)` (caster's own minions, party members, and party members' minions).
     - Calls `SKILLS_ApplyWarcryStats(pGame, pOwner, pTarget, nSkillId, nSkillLevel)`.
2. **State & Stat Overwrite Rules (`SKILLS_ApplyWarcryStats` @ `SkillBar.cpp:1441`)**:
   - Checks `MONSTERS_GetHirelingTypeId(pTarget) != 2` (Iron Wolves / Act 3 mercenaries? Wait: `GetHirelingTypeId == 2` is a non-hireling pet check for specific untargetable summons like Ravens).
   - Queries existing `STATLIST_GetStatListFromUnitAndState(pTarget, nAuraState)`:
     - Checks `STATLIST_GetSkillId(pStatList) == nSkillId && STATLIST_GetSkillLevel(pStatList) > nSkillLevel`.
     - **Anti-Downgrade Rule**: A lower-level Shout, Battle Orders, or Battle Command **cannot overwrite** an active higher-level buff of the same skill! An equal-or-higher `slvl` replaces the stats and refreshes the duration (`D2GAME_SetStatListExpireFrame`).
3. **Exact Buff Formulas**:
   - **Shout (Skill #138, `aurastate = shout` #26, `States.txt castoverlay = shoutstart` #75)**:
     - **Defense Bonus (`aurastat1 = skill_armor_percent`)**: `ln12` = `100% + (slvl - 1)*10%` (`+100%` at slvl 1, `+290%` at slvl 20).
     - **Duration (`auralencalc`)**: `ln34 + (blvl(Battle Orders) + blvl(Battle Command))*par8` = `500 + (slvl - 1)*250 + (blvl(BO) + blvl(BC))*125` frames (`20s + 10s*(slvl - 1) + 5s*(blvl(BO) + blvl(BC))`).
   - **Battle Orders (Skill #149, `aurastate = battleorders` #32, `States.txt castoverlay = battleorderscast` #154)**:
     - **Max Stamina / Max Life / Max Mana (`aurastat1 = item_maxstamina_percent`, `aurastat2 = item_maxhp_percent`, `aurastat3 = item_maxmana_percent`)**: `ln12` = `35% + (slvl - 1)*3%` (`+35%` at slvl 1, `+92%` at slvl 20).
     - **Current HP/Mana/Stamina Proportional Clamp (`SKILLS_UpdateUnitStatsFromWarcry` @ `SkillBar.cpp:1508`)**: Immediately scales current HP, Mana, and Stamina up proportionally with the new maximum (`CurrentHP += CurrentHP * pct / 100`, clamped to `MaxHP`).
     - **Duration (`auralencalc`)**: `ln34 + (blvl(Shout) + blvl(Battle Command))*par8` = `750 + (slvl - 1)*250 + (blvl(Shout) + blvl(BC))*125` frames (`30s + 10s*(slvl - 1) + 5s*(blvl(Shout) + blvl(BC))`).
   - **Battle Command (Skill #155, `aurastate = battlecommand` #51, `States.txt castoverlay = battlecommandcast` #159)**:
     - **All Skills (`aurastat1 = item_allskills`)**: `par1 = 1` (`+1` to All Skill Levels across all skill levels!).
     - Calls `SKILLS_RefreshPassiveSkills(pTarget)` immediately upon application (`SkillBar.cpp:1501`) so passive masteries and `Natural Resistance` recalculate with the `+1` skill bonus!
     - **Duration (`auralencalc`)**: `ln34 + (blvl(Shout) + blvl(Battle Orders))*par8` = `125 + (slvl - 1)*250 + (blvl(Shout) + blvl(BO))*125` frames (`5s + 10s*(slvl - 1) + 5s*(blvl(Shout) + blvl(BO))`).

### 3.3 Offensive & Crowd-Control Ring Warcries (`Howl` #130, `Battle Cry` #146, `War Cry` #154)

#### **Howl (Skill #130)**
- **Missile Trajectory (`SrvDo022_NovaAttack` @ `0x6FC63AA0`)**:
  - Spawns 64 `howl` (#148) missiles with `Vel = min(12 + calc1, MaxVel=24)` where `calc1 = (slvl - 1)*2` (`par1 = 2`), and `Range = 12 + (slvl - 1)*1` frames.
- **Monster Level Check & Terror AI (`MISSMODE_SrvHit17_Howl` @ `0x6FC5EAE0`)**:
  - Evaluates `aurafilter = 0x8583` (`34179`: targets hostile monsters, **excludes bosses (`0x4000`? Wait: `sub_6FD0FA00` checks `if (!(nFilter & 0x4000) && MONSTERS_IsBoss(0, pTarget)) return 0`! Because `0x8583 & 0x4000 == 0`, Howl cannot affect Bosses, Champions, or Uniques**).
  - Performs the **Monster Level Gate** (`MissMode.cpp:1702`):
    $$\text{slvl} + \text{par2}(1) + \text{clvl} > \text{mlvl}$$
    If `slvl + 1 + clvl <= mlvl`, Howl has **no effect**!
  - If passed, calls `AIUTIL_ApplyTerrorCurseState(pGame, pOwner, pTarget, SKILL_HOWL, nVelocity, nDuration)`:
    - `nVelocity` (flee distance/speed parameter): `ln34` = `24 + (slvl - 1)*5`.
    - `nDuration`: `ln56` = `75 + (slvl - 1)*25` frames (`3.0s + 1.0s*(slvl - 1)`), divided by difficulty `dwAiCurseDiv` (`2` in Nightmare, `4` in Hell).
    - Applies `auratargetstate = terror` (State #56, `curse = 1` — overwrites other Necromancer curses!).

#### **Battle Cry (Skill #146)**
- **Missile Trajectory (`SrvDo068` @ `0x6FC49720`)**:
  - Spawns 64 `battlecry` (#219) missiles (`Vel = 16`, `Range = 8` ticks $\approx 5$ sub-tiles radius). Because `aurastate` is empty (`-1`), `SKILLS_ApplyWarcryStats` on self is a no-op.
- **Boss-Legal Enemy Debuff (`MISSMODE_SrvHit21_BattleCry` @ `0x6FC5ABD0` -> `sub_6FCFB280`)**:
  - Uses `aurafilter = 42883` (`0xA783`). Unlike Howl (`0x8583`), `0xA783` sets bit `0x2000` and does **not** exclude bosses/champions/Prime Evils — **Battle Cry works on Act Bosses, SuperUniques, and Uber Bosses**!
  - Applies `auratargetstate = battlecry` (State #89, `curse = 1`, `overlay1 = battlecry` #196):
    - `aurastat1 = skill_armor_percent` (`ln34` = `-50% + (slvl - 1)*(-2)%` enemy Defense; `-50%` at slvl 1, `-88%` at slvl 20).
    - `aurastat2 = damagepercent` (`ln56` = `-25% + (slvl - 1)*(-1)%` enemy Physical Damage; `-25%` at slvl 1, `-44%` at slvl 20).
    - Duration (`auralencalc`): `ln12` = `300 + (slvl - 1)*60` frames (`12.0s + 2.4s*(slvl - 1)`), divided by difficulty `dwAiCurseDiv` on monsters.

#### **War Cry (Skill #154)**
- **Missile Trajectory & Physical Damage (`SrvDo068` @ `0x6FC49720`)**:
  - Spawns 64 `warcry` (#235) missiles (`Vel = 16`, `Range = 8` ticks $\approx 5$ sub-tiles radius).
  - In `Missiles.txt`, `warcry` sets `Skill = War Cry` (#154) and `SrcDamage = 0`, so it inherits physical damage directly from `Skills.txt` row #154:
    - Base physical damage (`HitShift = 8`): `MinDam = 20` (`+5`, `+6`, `+7`, `+8`, `+10`), `MaxDam = 30` (`+5`, `+6`, `+7`, `+8`, `+10`).
    - Synergy (`DmgSymPerCalc`): `(blvl(Howl) + blvl(Taunt) + blvl(Battle Cry)) * 6%` physical damage (`par8 = 6`).
    - Blocked by standard shield block (`CanBlock` — missile physical damage) and reduced by Physical Resistance (`STAT_DAMAGERESIST`).
- **Stun Application (`MISSMODE_SrvDmg07_Warcry_ShockWave` @ `0x6FC59600` & `CltHit10` @ `0x6FB62570`)**:
  - On server hit, `MISSMODE_SrvDmg07` evaluates `auratargetstate = stunned` (#28) duration `auralencalc = ln12` = `25 + (slvl - 1)*5` frames (`1.0s + 0.2s*(slvl - 1)`, capped at `250` frames / 10s by `SUnitDmg.cpp`), sets `pDamage->dwStunLen = nStunLength` and `pDamage->dwHitClass = 0x60` (`96`).
  - Note on Bosses: `SUnitDmg.cpp` checks monster `NoShldBlock` / boss stun efficiency (`MonStatsTxt`), giving Act Bosses and SuperUniques `0%` or reduced stun chance while still taking full physical damage.
  - On client hit (`MISSMODE_CltHit10` @ `0x6FB62570`), applies `ProgOverlay = doubledamage1` (`Overlay.txt` #112) to the struck target.

---

## 4. Single-Target AI Override (`Taunt`, Skill #137)

- **No Missile (`SrvDo071_Taunt` @ `0x6FC49000`, `cltdofunc = 0`)**:
  - Validates the selected `pTarget` against `aurafilter = 0x8583` (`sub_6FD0FA00`); if no target is selected, searches within radius `20` sub-tiles (`SKILLS_FindAuraTarget`).
  - Calls `sub_6FD15190(pTarget, AISPECIALSTATE_TAUNT)` (`Skills.cpp:2112`):
    - Rejects monsters that are invisible, dead, not in `MonStats.txt` (`bInited`, `bKillable`), attached Imps (`STATES_CheckState(pMonster, STATE_ATTACHED)`), or Bosses/Uniques/Champions (`MONSTERS_GetMonsterType(pMonster) != 0`).
  - If valid:
    1. Applies `auratargetstate = taunt` (State #27, `curse = 1`, `overlay1 = taunt` #195) permanently until overwritten (`no expiry frame set` — `D2Common_10476(pStatList, 0)`!).
    2. Sets enemy debuffs (`SKILLS_SetAuraStats`):
       - `aurastat1 = item_tohit_percent` (`ln12` = `-5% + (slvl - 1)*(-2)%` Attack Rating).
       - `aurastat2 = damagepercent` (`ln34` = `-5% + (slvl - 1)*(-2)%` Physical Damage).
    3. **AI Behavior Override (`SkillBar.cpp:544–549`)**:
       - Calls `AIGENERAL_SetAiControlParam(pTarget, 1, -666)`, `(2, -666)`, `(3, -666)` and `AITACTICS_SetTerritory(pGame, pTarget, 11, pUnit, 0, 1)`.
       - Forces the monster out of ranged/casting/fleeing routines so it walks directly toward the Barbarian and uses only its basic melee attack!

---

## 5. Corpse-Targeted Skills (`Find Potion`, `Find Item`, `Grim Ward`)

### 5.1 Corpse Eligibility Rules (`D2Common.#11018` vs `D2Common.#11019`)
All three corpse skills share `SKILLS_CanUnitCorpseBeSelected` (`D2Common/src/D2Skills.cpp:1572`), which requires:
- `pUnit->dwUnitType == UNIT_MONSTER` in `MONMODE_DEAD` (`dwAnimMode == 12`).
- Monster has `bKillable` and `bCorpseSel` in `MonStats.txt` / `MonStats2.txt`.
- Corpse does **not** already have `STATE_CORPSE_NODRAW` (#104) or `STATE_CORPSE_NOSELECT` (#118).
- Monster is not friendly (`STAT_ALIGNMENT != MONALIGNMENT_GOOD`).

However, **Find Potion** and **Grim Ward** call `D2Common_11018`, which **additionally requires `UNITS_IsSoftMonster(pTarget)`** (`bSoft` in `MonStats2.txt` — excludes skeletons, ghosts, and fleshless constructs), whereas **Find Item** calls `D2Common_11019` (`SKILLS_CanUnitCorpseBeSelected` only — works on **both** soft and skeletal/undead corpses, excluding only Bosses/SuperUniques with `bCorpseSel = 0` or Act Bosses!).

### 5.2 Find Potion (Skill #131)
- **Start (`SrvSt33` @ `0x6FC47270` & `CltSt26` @ `0x6FB76400`)**:
  - Validates `D2Common_11018(pTarget)` (soft corpse). Client plays `barbarian_findpotion_1` (`0xBA2` if target is invalid, `0xBC7` on cast).
- **Do (`SrvDo069_FindPotion` @ `0x6FC47600` & `CltDo38` @ `0x6FB763A0`)**:
  - Toggles `STATE_CORPSE_NOSELECT` (#118) on the corpse so it cannot be looted or targeted again, and spawns client gore effect (`0x6FB55850`).
  - Evaluates success chance `calc1 = dm12` (`par1 = 0`, `par2 = 100`: `15%` at slvl 1, `67%` at slvl 10, `84%` at slvl 20).
  - If `Roll(0..99) < calc1`:
    - Indexes the 15-entry `gdwPotionsTable[nAct + 5 * nDifficulty]` (`SkillBar.cpp:251`):
      - Normal Act 1–3: `hp1`/`mp1` .. `hp3`/`mp3`; Normal Act 4–5 & Nightmare Act 1–2: `hp4`/`mp4`; Nightmare Act 3–5 & Hell Act 1–5: `hp5`/`mp5` (Super Healing / Super Mana).
    - Reuses `nChance % 100` against `Param3 = 30` and `Param4 = 10`:
      - `< 30` (`30%`): **Mana Potion** (`mp1..mp5`).
      - `30 .. 39` (`10%`): **Rejuvenation Potion** (`rvs` if `nDifficulty == DIFFMODE_NORMAL`, `rvl` Full Rejuvenation in Nightmare and Hell!).
      - `>= 40` (`60%`): **Healing Potion** (`hp1..hp5`).

### 5.3 Find Item ("Horking", Skill #142)
- **Start (`SrvSt34` @ `0x6FC47240` & `CltSt28` @ `0x6FB76350`)**:
  - Validates `D2Common_11019(pTarget)` (any selectable corpse).
- **Do (`SrvDo072_FindItem` @ `0x6FC476D0` & `CltDo40` @ `0x6FB762E0`)**:
  - Toggles `STATE_CORPSE_NOSELECT` (#118) on the corpse.
  - Evaluates success chance `calc1 = dm12` (`par1 = 5`, `par2 = 60`: `13%` at slvl 1, `42%` at slvl 10, `51%` at slvl 20, `55%` at slvl 30).
  - If `Roll(0..99) < calc1`, calls `sub_6FC659B0(pGame, pTarget, pUnit)` (`MonsterMode.cpp:747`):
    - Calls `sub_6FC631B0(pGame, pMonster, pPlayer, 0, nItemLevel, 0, /*a7=*/1, &pItem, &nItemsDropped, 6)` $\to$ `D2GAME_DropTC_6FC51360(..., a7 = 1)`.
  - **`NoDrop = 0` Override (`Items.cpp:2170–2186`)**:
    - In `D2GAME_DropTC_6FC51360`, when `a7 == 1`, the engine **completely skips adding `nNoDrop` to `nChance` and skips the `nRand < nNoDrop` check**!
    - Consequently, once the `Find Item` `dm12` percentage check succeeds, **every pick** in the monster's TreasureClass drops with **0% `NoDrop` chance** (equivalent to `/players 8` zero-nodrop for every pick), and utilizes the Barbarian's current Magic Find (`STAT_ITEM_MAGICBONUS`) and Gold Find (`STAT_ITEM_GOLDBONUS`)!

### 5.4 Grim Ward (Skill #150)
1. **Corpse Consumption & Start Missile (`SrvDo075_GrimWard` @ `0x6FC47C90` & `CltDo41` @ `0x6FB77000`)**:
   - Validates `D2Common_11018(pTarget)` (soft corpse) and inspects `MonStats2.txt` size flags on the corpse (`dwFlags & MONSTATS2FLAG_SMALL` / `MONSTATS2FLAG_LARGE`):
     - Small corpse: `grimwardsmallstart` (`#249`, `Range = 5` ticks).
     - Medium corpse (default): `grimwardmediumstart` (`#252`, `Range = 8` ticks).
     - Large corpse: `grimwardlargestart` (`#255`, `Range = 8` ticks).
   - Hides and locks the corpse (`STATE_CORPSE_NODRAW` #104 + `STATE_CORPSE_NOSELECT` #118) and spawns the size-matched `grimward*start` missile at the corpse's coordinates.
   - On the client (`CltDo41` @ `0x6FB77000`), **also** spawns a client-only `corpseexplosion` (`#115`, `0x73`) visual missile (`0x6FB77130`) at the corpse for the blood/gore burst!
2. **Main Totem Spawning (`MISSMODE_SrvHit26_GrimWardStart` @ `0x6FC5C990` & `MISSMODE_CltHit29` @ `0x6FB66120`)**:
   - When `grimward*start` expires (`Range = 5` or `8` ticks), `SrvHit26` spawns `HitSubMissile1` (`grimwardsmall` #250 / `grimwardmedium` #253 / `grimwardlarge` #256) with `Range = calc1 = par5 = 1000` ticks (**40.0 seconds**).
   - Client `CltHit29` (`0x6FB66120`) mirrors this by spawning `CltHitSubMissile1` with `Range` from `CltHitPar1` (`1000` ticks, or `16`/`32` ticks when transitioning from main totem to `grimward*stop`).
3. **Periodic Terror Pulse (`MISSMODE_SrvDo14_GrimWard` @ `0x6FC60E10` $\to$ `SKILLS_SrvDo030_Curse` @ `0x6FC705D0`)**:
   - Every frame during the totem's 1000-tick lifetime, `MISSMODE_SrvDo14_GrimWard` checks:
     ```cpp
     if ((MISSILE_GetRemainingFrames(pMissile) % pMissilesTxtRecord->dwParam[0]) == 0)
     ```
     With `Param1 = 6` (`dwParam[0] = 6`) and `Param2 = 30` (`dwParam[1] = 30`), **every 6 frames (0.24s)** the totem invokes `sub_6FD14400(..., SKILL_GRIMWARD, 30)` $\to$ `SKILLS_SrvDo030_Curse` (`SkillNec.cpp:428`)!
   - `SKILLS_SrvDo030_Curse` searches within `aurarangecalc = ln12` (`3 + (slvl - 1)*1` sub-tiles radius: `3` sub-tiles at slvl 1, `22` sub-tiles at slvl 20) and applies `auratargetstate = terror` (State #56) for `auralencalc = par6 = 60` frames (`2.4s`, divided by difficulty `dwAiCurseDiv`) to all non-boss monsters (`sub_6FCFE0E0`).
4. **Totem Collapse (`MISSMODE_SrvHit27` @ `0x6FC58EC0` & `MISSMODE_CltDo11` @ `0x6FB62DC0`)**:
   - When the 1000-tick totem expires, `CltHit29` (`0x6FB66120`) spawns `grimward*stop` (`#251` / `#254` / `#257`, `Range = 16` or `32` ticks), whose `CltDoFunc = 11` (`0x6FB62DC0`) holds the final collapse frame once `bAnimEnd` triggers until the missile range finishes.
