# Diablo II v1.13c Act 4 Bosses & Chaos Sanctuary Seal Bosses — AI, Skills & Missile Mechanics

## 1. Dispatch Tables (`D2Game.dll` & `D2Client.dll` v1.13c)

### `D2Game.dll` (`ImageBase = 0x6FC20000`)
- **`g_apfnSkillSrvStFunc`** (`0x6FD27338`):
  - `[53]` = `0x6FCD2ED0` (`SKILLS_SrvSt53_MonInferno`)
  - `[54]` = `0x6FCD36A0` (`SKILLS_SrvSt54_DiabRun`)
- **`g_apfnSkillSrvDoFunc`** (`0x6FD274A8`):
  - `[10]` = `0x6FC6D270` (`SKILLS_SrvDo010_GuidedArrow_BoneSpirit`)
  - `[18]` = `0x6FC628F0` (`SKILLS_SrvDo018_DefensiveBuff`)
  - `[22]` = `0x6FC63AA0` (`SKILLS_SrvDo022_NovaAttack`)
  - `[24]` = `0x6FC637D0` (`SKILLS_SrvDo024_FireWall`)
  - `[30]` = `0x6FC705D0` (`SKILLS_SrvDo030_Curse`)
  - `[95]` = `0x6FCD6A60` (`SKILLS_SrvDo095_MonInferno`)
  - `[96]` = `0x6FCD3770` (`SKILLS_SrvDo096_ZakarumHeal_Bestow`)
  - `[100]` = `0x6FCD3D60` (`SKILLS_SrvDo100_DiabCold`)
  - `[101]` = `0x6FCD5110` (`SKILLS_SrvDo101_FingerMageSpider`)
  - `[102]` = `0x6FCD4FF0` (`SKILLS_SrvDo102_DiabWall`)
  - `[103]` = `0x6FCD3F10` (`SKILLS_SrvDo103_DiabRun`)
  - `[104]` = `0x6FCD4410` (`SKILLS_SrvDo104_DiabPrison`)
  - `[112]` = `0x6FCD5950` (`SKILLS_SrvDo112_MonCurseCast`)
  - `[124]` = `0x6FC65CE0` (`SKILLS_SrvDo124_Armageddon_Hurricane`)
  - `[148]` = `0x6FCD4C20` (`SKILLS_SrvDo148_DoomKnightMissile`)
  - `[152]` = `0x6FCD6840` (`SKILLS_SrvDo152_DiabLight`)
- **`g_apfnMissileSrvDoFunc`** (`0x6FD2D970`):
  - `[1]` = `0x6FC5F540` (`MISSMODE_SrvDo01_BasicMissile`)
  - `[5]` = `0x6FC61980` (`MISSMODE_SrvDo05_FireWall_ImmolationFire_MeteorFire_MoltenBoulderFirePath`)
  - `[6]` = `0x6FC61850` (`MISSMODE_SrvDo06_MoltenBoulder_FireWallMaker`)
  - `[7]` = `0x6FC61710` (`MISSMODE_SrvDo07_GuidedArrow_BoneSpirit`)
  - `[11]` = `0x6FC61240` (`MISSMODE_SrvDo11_FingerMageSpider`)
  - `[12]` = `0x6FC61110` (`MISSMODE_SrvDo12_DiabWallMaker`)
- **`g_apfnMissileSrvHitFunc`** (`0x6FD2DA48`):
  - `[10]` = `0x6FC5B140` (`MISSMODE_SrvHit10_GuidedArrow_BoneSpirit`)
  - `[19]` = `0x6FC5E8A0` (`MISSMODE_SrvHit19_FingerMageSpider`)
  - `[56]` = `0x6FC5B210` (`MISSMODE_SrvHit56_ArmageddonControl`)
- **`g_apfnMissileSrvDmgFunc`** (`0x6FD2DB68`):
  - `[3]` = `0x6FC59670` (`MISSMODE_SrvDmg03_Blaze_FireWall_ImmolationFire_MeteorFire`)
- **AI Dispatch (`AITHINK_FnTable`)**:
  - `AITHINK_Fn016_Izual` = `0x6FCDB3E0`
  - `AITHINK_Fn024_FingerMage` = `0x6FCDCCD0`
  - `AITHINK_Fn027_OblivionKnight` = `0x6FCDDB10`
  - `AITHINK_Fn033_Megademon` = `0x6FCDF780`
  - `AITHINK_Fn044_Smith` = `0x6FCE28F0`
  - `AITHINK_Fn051_Diablo` = `0x6FCE8950`

### `D2Client.dll` (`ImageBase = 0x6FAB0000`)
- **`g_apfnSkillCltStFunc`** (`0x6FB8E928`):
  - `[18]` = `0x6FB785C0` (`SKILLS_CltSt18_Curse`)
  - `[40]` = `0x6FB06930` (`SKILLS_CltSt40_DiabLight`)
  - `[41]` = `0x6FB066E0` (`SKILLS_CltSt41_DiabRun`)
- **`g_apfnSkillCltDoFunc`** (`0x6FB8EA48`):
  - `[18]` = `0x6FAC5C40` (`SKILLS_CltDo18_GuidedArrow_BoneSpirit`)
  - `[25]` = `0x6FB23CB0` (`SKILLS_CltDo25_NovaAttack` -> `0x6FB51020`)
  - `[26]` = `0x6FB24770` (`SKILLS_CltDo26_FireWall`)
  - `[30]` = `0x6FB78B40` (`SKILLS_CltDo30_Curse`)
  - `[54]` = `0x6FB08C90` (`SKILLS_CltDo54_MonInferno`)
  - `[56]` = `0x6FB08B80` (`SKILLS_CltDo56_DiabLight` -> `0x6FB08370`)
  - `[57]` = `0x6FB08070` (`SKILLS_CltDo57_FingerMageSpider`)
  - `[58]` = `0x6FB07F60` (`SKILLS_CltDo58_DiabWall`)
  - `[59]` = `0x6FB06790` (`SKILLS_CltDo59_DiabRun`)
  - `[92]` = `0x6FB795F0` (`SKILLS_CltPrg92_Armageddon`)
  - `[94]` = `0x6FB08990` (`SKILLS_CltDo94_DoomKnightMissile`)
- **`g_apfnMissileCltDoFunc`** (`0x6FB8D8A0`):
  - `[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard`)
  - `[5]` = `0x6FB62F90` (`MISSMODE_CltDo05_GroundFire`)
  - `[6]` = `0x6FB692B0` (`MISSMODE_CltDo06_FireWallMaker`)
  - `[7]` = `0x6FB62EB0` (`MISSMODE_CltDo07_GuidedArrow_BoneSpirit`)
  - `[15]` = `0x6FB68BC0` (`MISSMODE_CltDo15_FingerMageSpider`)
  - `[16]` = `0x6FB68AA0` (`MISSMODE_CltDo16_DiabWallMaker`)
- **`g_apfnMissileCltHitFunc`** (`0x6FB8DA10`):
  - `[10]` = `0x6FB62570` (`MISSMODE_CltHit10_ProgOverlay`)
  - `[13]` = `0x6FB61350` (`MISSMODE_CltHit13_ExplosionMissile`)
  - `[55]` = `0x6FB65930` (`MISSMODE_CltHit55_ArmageddonRock`)

---

## 2. Act 4 Bosses & SuperUniques Master Roster (`MonStats.txt`, `MonStats2.txt`, `SuperUniques.txt`)

| hcIdx | `Id` (`SuperUnique`) | `AI` | `Code` | `SizeX`×`Y` | `Level` (N/NM/H) | Base `minHP`–`maxHP` | `DamageRegen` | `Vel`/`Run` | Resists `Dm/Ma/Fi/Li/Co/Po` (H) | Fixed `SuperUniques.txt` UMods |
|---:|---|---|---|---:|---|---:|---:|---:|---|---|
| 243 | `diablo` (Diablo) | `Diablo` | `DI` | 3×3 | 40 / 62 / 94 | 6427 | 0 | 6 / 6 | `45 / 0 / 50 / 50 / 50 / 50` | Act Boss (`primeevil=1, boss=1`) |
| 333 | `diabloclone` (Uber Diablo / World Event) | `Diablo` | `DI` | 2×2 | 110 / 110 / 110 | 6427 | 2 | 8 / 8 | `50 / 50 / 95 / 95 / 95 / 95` | World Event Boss (`primeevil=1, boss=1`) |
| 256 | `izual` (Izual) | `Izual` | `22` | 2×2 | 29 / 60 / 86 | 9481 | 0 | 10 / 16 | `30 / 30 / 30 / 30 / 75 / 30` | Quest Boss (`boss=1`) |
| 409 | `hephasto` (`The Feature Creep`) | `Smith` | `5P` | 2×2 | 25 / 60 / 88 | 760 | 0 | 8 / 8 | `50 / 0 / 75 / 25 / 25 / 0` (`-50` Po in N/NM) | `Mod1=27` (Spectral Hit), `Mod2=30` (Aura Enchanted) |
| 306 | `fingermage3` (`Grand Vizier of Chaos`) | `FingerMage` | `FR` | 3×3 | 30 / 58 / 85 | 152–209 | 2 | 10 / 16 | `50 / 0 / 0 / 100 / 0 / 0` (`75` Fi/Li in NM) | `Mod1=5` (Extra Strong), `Mod2=9` (Fire Enchanted), `Minions=4..5` |
| 312 | `doomknight3` (`Lord De Seis`) | `OblivionKnight` | `UM` | 2×2 | 30 / 58 / 85 | 130–171 | 2 | 8 / 7 | `33 / 25 / 60 / 60 / 180 / 75` | `Mod1=5` (Extra Strong), `Mod2=30` (Aura Enchanted -> **Fanaticism**), `Mod3=24` (Thief, disabled), `Minions=5..5` |
| 362 | `megademon3` (`Infector of Souls`) | `Megademon` | `DM` | 3×3 | 30 / 57 / 84 | 191–228 | 2 | 10 / 16 | `50 / 0 / 130 / 75 / 50 / 75` | `Mod1=6` (Extra Fast), `Mod2=27` (Spectral Hit), `Minions=6..6` |

### Special Monster Mode & Block Quirks (`MonsterMode.cpp` & `SUnitDmg.cpp`)
1. **No Block Animation (`SUnitDmg.cpp:L2101`)**:
   - `MONSTER_DIABLO` (#243), `MONSTER_DIABLOCLONE` (#333), and `MONSTER_UBERDIABLO` (#705) have shield block chance (`NoShldBlock=0`, capped at 75% in `UNITS_GetBlockRate` @ `Units.cpp:L2483`), but `SUnitDmg.cpp` explicitly excludes those three monster IDs from transitioning into `MONMODE_BLOCK`. Thus Diablo blocks attacks silently without interrupting his current animation or channel.
2. **`nSplGetModeChart` Callbacks (`MonsterMode.cpp:L1645-1659`)**:
   - `diablo`, `diabloclone`, and `uberdiablo` register custom frame-event mode callback tables `gDiablo_Skill3_Callbacks` (`MONMODE_SKILL3`) and `gDiablo_Skill4_Callbacks` (`MONMODE_SKILL4`).
3. **Inferno Animation Parameters (`MonStats2.txt`)**:
   - `diablo`: `InfernoLen=6, InfernoAnim=9, InfernoRollback=15`
   - `megademon3`: `InfernoLen=1, InfernoAnim=10, InfernoRollback=11`

---

## 3. Master Skill & Missile Tables (`Skills.txt` & `Missiles.txt`)

### 3.1 Act 4 Boss Skills (`Skills.txt`)

| ID | Skill Name | Used By (Slot / `slvl` / `monanim`) | `SrvSt` | `SrvDo` | `CltSt` | `CltDo` | `srvmissilea` / `b` | `cltmissilea` / `b` | Key `Param` & `calc` Columns |
|---:|---|---|---:|---:|---:|---:|---|---|---|
| 193 | `DiabLight` | `diablo` (Sk1/3/SC), `diabloclone` (Sk1/2/SC) | 53 | 152 | 40 | 56 | `diablight` | `diablight` | `Param1=40`, `calc2=par1` (40 frames), `calc3=2` (tick interval) |
| 194 | `DiabCold` | `diablo` (Sk2/4/S2), `diabloclone` (Sk2/2/S2) | — | 100 | — | — | — | — | `EType=mag`, `EMin=15 (+9/lvl)`, `EMax=25 (+12/lvl)`, `ELen=100 (+50/lvl)`, `HitShift=8` |
| 195 | `DiabFire` | `diablo` (Sk3/5/S1), `diabloclone` (Sk3/4/S1) | — | 22 | — | 25 | `diabfire` | `diabfire` | Radial 32-bolt nova |
| 197 | `DiabWall` | `diablo` (Sk4/3/S3), `diabloclone` (Sk4/2/S3) | — | 102 | — | 58 | `diabwallmaker` | `diabwallmaker` | `calc1=lvl` (stream count) |
| 198 | `DiabRun` | `diablo` (Sk5/5/seq22), `diabloclone` (Sk5/5/seq22) | 54 | 103 | 41 | 59 | — | — | `seqnum=22`, `calc1=20` (vel), `Param1..6=8,14,5,13,16,6`, `MinDam=17 (+9/lvl)`, `MaxDam=33 (+9/lvl)`, `ResultFlags=5` |
| 188 | `PrimeFirewall` | `diablo` (Sk6/8/S3), `diabloclone` (Sk6/8/S3) | — | 24 | — | 26 | `vampirefirewallmaker` / `vampirefirewall` | `vampirefirewallmaker` | Perpendicular ground fire wall |
| 199 | `DiabPrison` | `diablo` (Sk7/1/S3), `diabloclone` (Sk7/1/S3) | — | 104 | — | — | — | — | `summon=boneprison1` (#340..#343 ring) |
| 349 | `Diablogeddon` | `diabloclone` (Sk8/5/S3), `uberdiablo` (Sk8/5/S3) | — | 124 | — | `cltprg1=92` | `diablogeddoncontrol` | `diablogeddontail` / `diablogeddonrock` | `Param1=1000, Param2=50, Param3=8, Param4=8`, `aurastate=armageddon` |
| 44 | `Frost Nova` | `izual` (Sk1/8/SC) | — | 22 | — | 25 | `frostnova` | `frostnova` | `EType=cold`, `EMin=4 (+4..12/lvl)`, `EMax=8 (+5..13/lvl)`, `ELen=200 (+25/lvl)`, `HitShift=7` |
| 196 | `FingerMageSpider` | `fingermage3` (Sk1/5/S1) | — | 101 | — | 57 | `fingermagespider` | `fingermagespider` | `Param1=30, Param2=10, Param3=24`, `auratargetstate=fingermagecurse`, `aurastat1=manarecovery (-24*lvl)` |
| 335 | `DoomKnightMissile` | `doomknight3` (Sk1/3/S1) | — | 148 | — | 94 | `undeadmissile1` (+0..3) | `undeadmissile1` (+0..3) | Component-based elemental bolt |
| 210 | `MonBoneArmor` | `doomknight3` (Sk2/6/S1) | — | 18 | — | — | — | — | `Param1=20, Param2=10`, `aurastatcalc1=ln12*256` |
| 211 | `MonBoneSpirit` | `doomknight3` (Sk3/2/S1) | — | 10 | — | 18 | `monbonespirit` | `monbonespirit` | `Param1=15` |
| 87 | `Decrepify` | `doomknight3` (Sk4/3/S2) | — | 30 | 18 | 30 | — | `cursedecrepify` / `cursecast` | `Param1=6, Param3=100, Param4=15, Param5=-50` (vel/dmg/damageresist/attackrate) |
| 182 | `Bestow` | `doomknight3` (Sk5/2/seq) | — | 96 | — | — | — | — | `srvoverlay=receiving`, `SearchEnemyXY=1` |
| 212 | `MonCurseCast` | `doomknight3` (Sk6/3/S2) | — | 112 | 18 | 30 | — | `curseeffectred` / `cursecast` | `Param1=3, Param2=1, Param3=300, Param4=60, Param5=25, Param6=70, Param7=-50` |
| 319 | `MegademonInferno` | `megademon3` (Sk1/8/S1) | 53 | 95 | — | 54 | `megademoninferno` | `fetishinferno1` / `fetishinferno2` | `Param1=15`, `calc2=par1` (15 frames), `calc3=2` |

### 3.2 Act 4 Boss Missiles (`Missiles.txt`)

| ID | Missile | `SrvDo` / `SrvHit` / `SrvDmg` | `CltDo` / `CltHit` | `Vel` | `Range` | `Size` | `HitShift` | `DamageRate` | Physical Damage (`Min`–`Max`, `+Lev`) | Elemental Damage (`EType`, `EMin`–`EMax`, `+Lev`) | Flags & Sub-Missiles |
|---:|---|---|---|---:|---:|---:|---:|---:|---|---|---|
| 172 | `diablight` | `1 / 0 / 0` | `1 / 10` | 20 (`*0.75=15`) | `30+slvl-1` | 2 | **6** (`/64`) | 82 | `7–15` (`+10/lvl`) | `ltng`: `25–66` (`+16/lvl`) | `Pierce=1, LastCollide=1, NextDelay=3, InitSteps=1` |
| 176 | `diabfire` | `1 / 0 / 0` | `1 / 0` | 30 | 50 | 2 | 8 | — | — | `fire`: `20–50` (`+8/lvl`) | `NextHit=1, NextDelay=4, SubLoop=1 (12..36)` |
| 179 | `diabwallmaker` | `12 / 0 / 0` | `16 / 0` | 20 | 80 (cap 77) | 1 | 8 | — | — | — | `SubMissile1=diabwall`, `InitSteps=2` |
| 180 | `diabwall` | `1 / 0 / 0` | `5 / 0` | 0 | 36 | 2 | **3** (`/8`) | 41 | `4–12` (`+2/lvl`) | `fire`: `12–25` (`+5/lvl`) | `SubLoop=1 (12..36)` |
| 130 | `vampirefirewallmaker` | `6 / 0 / 0` | `6 / 0` | 12 | 10 | 1 | 8 | — | — | — | `SubMissile1=vampirefirewall`, `CltSub1..3=vampirefirewall, firesmall, firemedium`, `CltParam1=4` |
| 131 | `vampirefirewall` | `5 / 0 / 3` | `5 / 0` | 0 | 90 | 1 | **2** (`/4`) | 41 | — | `fire`: `2–3` (`+2..3/lvl`) | `dParam1=19`, `SubLoop=1 (12..36)` |
| 670 | `diablogeddoncontrol` | `1 / 56 / 0` | `1 / 0` | 0 | 25 | 0 | 8 | — | *(from Skill #349)* | *(from Skill #349)* | `sHitPar1=3` (aoe), `HitSubMissile1=diablogeddonfire` |
| 671 | `diablogeddonrock` | `1 / 0 / 0` | `1 / 55` | 0 | 25 | 0 | 8 | — | — | — | `AlwaysExplode=1`, `CltHitSub1=diablogeddonexplosion`, `CltHitSub2=diablogeddonfire` |
| 672 | `diablogeddontail` | `1 / 0 / 0` | `1 / 0` | 0 | 25 | 0 | 8 | — | — | — | Visual tail paired with `diablogeddonrock` |
| 674 | `diablogeddonfire` | `1 / 0 / 0` | `1 / 0` | 0 | 37 | 2 | **2** (`/4`) | 41 | — | `fire`: `10–14` (`+6..8/lvl`) | `CollideType=8`, `SubLoop=1 (12..36)` |
| 119 | `frostnova` | `1 / 0 / 0` | `1 / 10` | 24 | 14 | 1 | 7 | — | — | *(from Skill #44)* | `Accel=-1000`, `NextHit=1, NextDelay=4` |
| 177 | `fingermagespider` | `11 / 19 / 0` | `15 / 10` | 6 | 80 | 1 | 7 | — | `3–9` (`+2/lvl`) | `fire`: `6–12` (`+6..8/lvl`) | `Param1=5, Param2=20, Param3=2` (homing), `CollideKill=1` |
| 323 | `undeadmissile1` | `1 / 0 / 0` | `1 / 0` | 20 | 40 | 1 | 8 | — | — | `pois`: `10–10` (`+12..14/lvl`), `ELen=350` | Variants `#323..#326` (`pois`, `cold`, `fire`, `ltng`) |
| 329 | `monbonespirit` | `7 / 10 / 0` | `7 / 13` | 12 | 128 | 1 | 8 | — | — | `mag`: `10–15` (`+9/lvl`) | `Param1=5` (retarget ticks), `ExplosionMissile=bonespiritexplode` |
| 675 | `megademoninferno` | `1 / 0 / 0` | `1 / 0` | 12 (`*0.75=9`) | `7+slvl-1` | 1 | 8 | 82 | — | `fire`: `3–6` (`+3..4/lvl`) | `InitSteps=3, LastCollide=1, Param2=7` |

---

## 4. Diablo & Diablo Clone AI (`AITHINK_Fn051_Diablo` @ `0x6FCE8950`)

Both Act 4 `diablo` (#243) and World Event `diabloclone` (#333) execute `AITHINK_Fn051_Diablo` (`D2Game/src/AI/AiThink.cpp:L12113-12760`).

### 4.1 Home Pentagram Anchor & Pre-Cast Armageddon Hook
1. **Home Coordinates (`AiCmd` Param 10)**:
   - On his first AI tick, if `AITACTICS_GetAiCmdParam10` returns `nullptr`, Diablo stores `[0] = 1, [1] = nX, [2] = nY` (his spawn pentagram center in Chaos Sanctuary, or spawn point for Diablo Clone).
2. **Target Evaluation (`AITHINK_SelectBestDiabloTarget` -> `AITHINK_GetTargetScore`)**:
   - Scans up to 8 hostile units within 50 sub-tiles (`AI_Search_Callback_Diablo`).
   - Scores each target using `AITHINK_GetTargetScore` (`AiThink.cpp:L11971`):
     - Sums target `STAT_FIRERESIST + STAT_LIGHTRESIST + STAT_COLDRESIST + STAT_DAMAGERESIST` (`< 100` -> `+50`, `< 200` -> `+25`, `< 300` -> `+10`, else `-50`).
     - Sums target `STAT_MAXDAMAGE + STAT_LIGHTMAXDAM + STAT_FIREMAXDAM + STAT_COLDMAXDAM` (`+total/20`).
     - Adds `+100` if target has `STATE_COLD`; adds `+100` if target HP < 20% max HP; adds `+25 * nAttackRank` of target's active skill; adds `+150` if in melee range (`+100` if clear LoS).
3. **Diablo Clone / Uber Diablo `Diablogeddon` Pre-Check**:
   - Before executing any rolled `nParam != 5`, the AI checks `pMonStatsTxtRecord->nSkill[7]` (`Skill8`, which is empty on normal `diablo` #243, but set to `Diablogeddon` #349 `slvl=5` on `diabloclone` #333).
   - If `nSkill[7] > 0` and `!STATES_CheckState(pUnit, STATE_ARMAGEDDON)`, Diablo immediately overrides his action to cast `Skill8` (`Diablogeddon`) and returns.

### 4.2 Weighted 17-Slot Decision Matrix (`chanceArray[0..16]`)

`AITHINK_Fn051_Diablo` populates `chanceArray[0..16]`, sums all weights, rolls `ITEMS_RollLimitedRandomNumber(&pUnit->pSeed, totalWeight)`, and selects the corresponding `nParam` (`0..16`):

| `nParam` | Action | Melee (`bInMeleeRange=1`) | Ranged, Blocked (`bColliding=1`) | Ranged, Clear LoS (`bColliding=0`) | Dynamic Weight Modifiers |
|---:|---|---:|---:|---:|---|
| `1` | Walk (`vel+20`) | 0 | 20 (`dist<20`: 10) | 10 (`dist<10`: 35; `dist>=20`: 0) | Reduced when closing or replaced by `DiabRun` |
| `2` | `MONMODE_ATTACK1` | 20 | 0 | 0 | — |
| `3` | `MONMODE_ATTACK2` | 15 | 0 | 0 | — |
| `4` | `MONMODE_SKILL4` (Taunt) | 0 | 5 | 0 | `0` if `bCombat` (enemy within 35 sub-tiles) |
| `5` | `Skill1`: `DiabLight` | 15 | 0 | 25 | `+10` (Melee) / `+15` (Ranged) if `LightRes < 50`; halved if `>= 50`; `0` if `>= 100` |
| `6` | `Skill3`: `DiabFire` | 10 | 20 (`dist>=20`: 10) | 15 | `+10` if `FireRes < 50`; halved if `>= 50`; `0` if `>= 100` |
| `7` | `Skill2`: `DiabCold` | 20 | 0 | 0 | **`0` if target already has `STATE_COLD`**; `+20` if `ColdRes < 50`; halved if `>= 50` |
| `8` | `Skill4`: `DiabWall` | 15 | 0 | 25 | `+15` if `FireRes < 50`; halved if `>= 50`; `0` if `>= 100` |
| `9` | `Skill7`: `DiabPrison` (Target) | 0 | 15 (`dist>=20`: 25) | 5 (`dist<10`: 0; `dist>=20`: 10) | Multiplied by `4` (`*= 4`) if target is immobile/trapped (`!SUNIT_CanMove`) |
| `10` | `Skill5`: `DiabRun` | 0 | 0 | 15 (`dist<10`: 5; `dist>=20`: 35) | — |
| `12` | Circle Target | 0 | 15 (`dist>=20`: 5) | 0 | — |
| `13` | `Skill6`: `PrimeFirewall` | 0 | 25 (`dist>=20`: 30) | 5 (`dist<10`: 0) | `+5` if `FireRes < 50`; halved if `>= 50`; `0` if `>= 100` |
| `14` | Return to Pentagram (`vel+50`) | 0 | 0 (`dist>=20`: +15) | 0 | If Diablo's distance from home pentagram $\ge 35$, adds `(homeDist - 25)` to weight |
| `15` | `Skill7`: `DiabPrison` (Portal) | 0 | 0 | 0 | In `LEVEL_CHAOSSANCTUM`, if a player's Town Portal (`OBJECT_TOWN_PORTAL`, `dwOwnerType == UNIT_PLAYER`) is within 85 sub-tiles and has no adjacent `MONSTER_BONEPRISON1..4`, sets `chanceArray[15] = 25` |
| `16` | Walk Close | 5 | 0 | 0 | — |

---

## 5. Diablo Skill & Missile Execution Mechanics

### 5.1 `DiabLight` (#193) — Red Lightning Hose (`SrvSt=53`, `SrvDo=152`, `CltSt=40`, `CltDo=56`)

1. **Channel Start (`SKILLS_SrvSt53_MonInferno` @ `0x6FCD2ED0` & `CltSt40` @ `0x6FB06930`)**:
   - Evaluates `calc2 = par1 = 40` frames (`1.6` seconds) and sets `pSkill->nParam1 = pGame->dwGameFrame + 40`.
   - Sets `pSkill->nParam2 = x, nParam3 = y` (initial target coordinates; even if cast at a unit, locks target's current position into `nParam2/3`).
   - Client `CltSt40` (`0x6FB06930`) caches the target sub-tile coordinates into the client skill parameters so the hose sweeps smoothly.
2. **Channel Loop (`SKILLS_SrvDo152_DiabLight` @ `0x6FCD6840`)**:
   - Rewinds Diablo's animation frame to `MonStats2.InfernoAnim = 9` via `SKILLS_SetInfernoFrame` (`0x6FCD3270`).
   - Registers a `calc3 = 2` frame timer (`EVENTTYPE_MODECHANGE`) until `dwGameFrame >= pSkill->nParam1` (at which point it advances animation to `MonStats2.InfernoRollback = 15` and exits `MONMODE_SKILL1`).
   - Every 2 frames (20 ticks per cast), spawns `diablight` (#172) at Diablo's position aimed at `(nParam2, nParam3)`:
     - Calls `MISSILES_CreateMissileFromParams` (`0x6FC8FA20`) with `dwFlags = 0x25` (`MISSILEFLAG_VEL | MISSILEFLAG_INFERNO | MISSILEFLAG_TARGET`).
     - Inside `MISSILES_CreateMissileFromParams` (`0x6FC8FAAB`), flag `0x20` scales missile velocity by `75 / 100` (`Vel = 20 * 75 / 100 = 15`).
     - Calls `SKILLS_UpdateInfernoAnimationParameters(pMissile, slvl)` (`0x6FCD32E0`), which overrides `nTotalFrames = Param2 + slvl - 1 = 30 + slvl - 1` (`32` frames on Act 4 Diablo `slvl=3`; `31` frames on Clone/Uber `slvl=2`).
3. **Client Visual Jitter (`CltDo56` @ `0x6FB08B80` -> `0x6FB08370`)**:
   - Advances unit RNG seed (`0x6AC690C5`) to pick a random velocity delta from `0x6FB85BE0[rand % 5]` added to `Vel=20`, and sets missile creation flags to `0x4025` 75% of the time (`(rand & 3) > 0`) or `0x0025` 25% of the time, creating the churning, staggered lightning-flame visual.
4. **Dual Physical + Lightning Damage & Famous Nightmare/Hell Zero-Spot (`diablight` #172)**:
   - `diablight` carries **both** physical and lightning damage (`HitShift=6` = `/64`, `DamageRate=82`, `NextDelay=3` frames):
     - At `slvl=3` (Act 4 Diablo): Raw Physical `27–35` (`/64`), Raw Lightning `57–98` (`/64`), scaled by `DamageRate=82` (`* (1000 + 82*16)/1000` in missile damage setup) and monster difficulty scaling.
   - **Nightmare/Hell Close-Range Blind Spot**: `diablight` has `InitSteps = 1` (`Missiles.txt`) and spawns from Diablo's center (`SizeX=3`). On Nightmare and Hell, `MonStats.txt` scales monster missile velocity/sub-step distance such that the first active collision check (`nCurFrame >= InitSteps`) occurs outside melee hugging range (~3–4 sub-tiles from Diablo's center), causing players standing flush against Diablo in NM/Hell to avoid `diablight` collision completely.

### 5.2 `DiabCold` (#194) — Cold Touch (`SrvDo=100` @ `0x6FCD3D60`)

- **Pure Server Melee Touch (`SKILLS_SrvDo100_DiabCold` @ `0x6FCD3D60`)**:
  - Has no missile (`srvmissilea=none`, `cltdofunc=none`), playing `MONMODE_SKILL2` (`S2`) with `stsound = diablo_cold_cast`.
  - Checks `UNITS_IsInMeleeRange(pUnit, pTarget, 0)`. If out of melee range, misses completely.
  - Despite its name and chill effect, `DiabCold` has `EType = mag` in `Skills.txt`!
  - Populates `D2DamageStrc` via `SKILLS_SetDamageStats` (`HitShift = 8`):
    - **Magic Damage (`dwMagDamage`)**:
      - `slvl = 4` (Act 4 Diablo): `42–61` Magic damage (`EMin=15, +9/lvl`, `EMax=25, +12/lvl`) before difficulty multipliers.
      - `slvl = 2` (Diablo Clone / Uber): `24–37` Magic damage.
    - **Freeze/Chill Bug Quirk (`SkillMonst.cpp:L821`)**:
      - `SKILLS_SetDamageStats` stores the `ELen = 100 + 50*(slvl-1)` duration (`250` frames = 10s at `slvl=4`) into `damage.dwColdLen` (or `ELen` field), and `SKILLS_SrvDo100_DiabCold` explicitly copies `damage.dwFrzLen = damage.dwColdLen` and sets `wResultFlags = DAMAGERESULTFLAG_GETHIT (4)`.
      - Applies damage via `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`.

### 5.3 `DiabFire` (#195) — Fire Nova (`SrvDo=22` @ `0x6FC63AA0`, `CltDo=25` @ `0x6FB23CB0`)

- Uses the standard radial nova handler (`SKILLS_SrvDo022_NovaAttack` / `CltDo25` -> `0x6FB51020`) to spawn **32** `diabfire` (#176) bolts in a full 360° ring around Diablo (`Vel=30, Range=50, Size=2`).
- Each bolt has `NextHit=1, NextDelay=4` (4-frame global NextDelay lock per hit) and deals pure Fire damage (`HitShift=8`, `EMin=20, +8/lvl`, `EMax=50, +8/lvl`: `52–82` Fire damage at `slvl=5` on Act 4 Diablo; `44–74` at `slvl=4` on Clone/Uber).

### 5.4 `DiabWall` (#197) — Firestorm (`SrvDo=102` @ `0x6FCD4FF0`, `CltDo=58` @ `0x6FB07F60`)

1. **Spawner Creation (`SKILLS_SrvDo102_DiabWall` / `CltDo58`)**:
   - Evaluates `calc1 = lvl` (`3` streams on Act 4 Diablo `slvl=3`; `2` streams on Clone/Uber `slvl=2`).
   - Loops `i = 0..calc1-1`, spawning `diabwallmaker` (#179, `Vel=20, Range=80, InitSteps=2`) with callback `SKILLS_MissileInit_DiabWall` (`0x6FCD4F60` server / `0x6FB06D00` client) and `pInitArgs = i`.
2. **80% Charged-Bolt Serpentine / 20% Straight Trajectory (`SKILLS_MissileInit_DiabWall`)**:
   - Clamps `nTotalFrames` to `77` (`if (nTotalFrames > 77) nTotalFrames = 77`).
   - Rolls `(SEED_RollRandomNumber(&pMissile->pSeed) % 100) >= 20`:
     - **80% chance**: Switches path to `PATHTYPE_CHARGEDBOLT` with `nDirOffset = i` (`0, 1, 2`), creating weaving serpentine waves.
     - **20% chance**: Keeps straight `PATHTYPE_MISSILE`.
3. **Ground Fire Trail (`MISSMODE_SrvDo12_DiabWallMaker` @ `0x6FC61110` / `CltDo16` @ `0x6FB68AA0`)**:
   - Every time `diabwallmaker` advances to a new sub-tile, it spawns `SubMissile1 = diabwall` (#180, `Range=36, Size=2, DamageRate=41, HitShift=3` = `/8`).
   - Each `diabwall` patch deals **both Physical and Fire damage every frame**:
     - Raw per-tick (`HitShift=3`): Physical `4–12 (+2/lvl)`, Fire `12–25 (+5/lvl)`, multiplied by `DamageRate=41` (`1.656x`). Because multiple weaving streams overlap on top of a stationary target, `DiabWall` inflicts massive stacked DPS.

### 5.5 `DiabRun` (#198) — Charge (`SrvSt=54` @ `0x6FCD36A0`, `SrvDo=103` @ `0x6FCD3F10`, `CltSt=41` @ `0x6FB066E0`, `CltDo=59` @ `0x6FB06790`)

- **Target Unbinding (`SrvSt54` / `CltSt41`)**:
  - Reads the target's `(X, Y)` into `pSkill->nParam1, nParam2`, then calls `PATH_SetTargetUnit(pUnit->pDynamicPath, nullptr)` so Diablo charges in a straight line to that ground point using sequence `seqnum = 22` (`seq_diablorun`) rather than tracking a moving unit.
- **State Machine (`SKILLS_SrvDo103_DiabRun` @ `0x6FCD3F10`)**:
  - **Frame `Param3 = 5` (Launch)**: Sets `PATHTYPE_ASTAR` with velocity `(calc1 = 20) << 8 = 5120` scaled by `STAT_VELOCITYPERCENT`, `PATH_SetStepNum(pDynamicPath, 99)`, and moves toward `(nParam1, nParam2)`.
  - **Frame `Param4 = 13` (Gallop Loop)**: If path is still active (`PATH_GetNumberOfPathPoints > 0`) and distance to destination $> 1$, rewinds animation frame back to `Param6 = 6` (`UNIT_SetAnimFrame(pUnit, 6)`), keeping Diablo running on all fours.
  - **Impact (`nActionFrame == 1`)**: Checks enemies within melee range; hits deal Diablo's physical melee damage plus skill bonus (`MinDam=17, +9/lvl`, `MaxDam=33, +9/lvl` -> `+53..69` at `slvl=5`) with `ResultFlags = 5` (`DAMAGERESULTFLAG_GETHIT | DAMAGERESULTFLAG_KNOCKBACK`).
  - **Wind-down**: Once destination is reached, lets animation advance to `Param1 = 8` (frame `Param2 = 14`) and clears velocity modifiers.

### 5.6 `PrimeFirewall` (#188) (`SrvDo=24` @ `0x6FC637D0`, `CltDo=26` @ `0x6FB24770`)

- Computes perpendicular vector `(-dY, +dX)` and `(+dY, -dX)` at target `(x, y)` relative to Diablo's position:
  - Spawns 2 `vampirefirewallmaker` (#130, `Vel=12, Range=10`) moving in opposite perpendicular directions, plus 1 center `vampirefirewall` (#131, `Range=90` frames).
  - Server `MISSMODE_SrvDo06` spawns `vampirefirewall` (#131, `HitShift=2`, `DamageRate=41`, `EType=fire`, `dParam1=19` bonus synergy param).
  - Client `MissileCltDoFunc_06` (`0x6FB692B0`) spawns a visual cluster every step (`CltParam1=4`) randomly mixing `vampirefirewall` (#131), `firesmall` (#104), and `firemedium` (#105).

### 5.7 `DiabPrison` (#199) — Bone Prison (`SrvDo=104` @ `0x6FCD4410`)

- **Target Resolution**: Accepts either a hostile unit (`UNIT_PLAYER` / `UNIT_MONSTER`) or a player's Town Portal (`UNIT_OBJECT` from `nParam=15` in Chaos Sanctuary).
- **16-Point Ring Spawn (`SKILLS_SrvDo104_DiabPrison` @ `0x6FCD4410`)**:
  - Iterates over a 16-entry circular offset table around `(targetX, targetY)` (radius ~3–4 sub-tiles), cycling through monster IDs `boneprison1` (#340), `boneprison2` (#341), `boneprison3` (#342), and `boneprison4` (#343) (`nSummonId + (i & 3)`).
  - Spawns each segment via `D2GAME_SpawnMonster_6FC69F10` with `MONMODE_SKILL1` (emerge animation). No client skill function is needed because monster spawns are replicated via standard server monster packets.

### 5.8 `Diablogeddon` (#349) — Diablo Clone & Uber Diablo (`SrvDo=124` @ `0x6FC65CE0`, `CltPrg1=92` @ `0x6FB795F0`)

1. **Aura State Registration (`SKILLS_SrvDo124_Armageddon_Hurricane` @ `0x6FC65CE0`)**:
   - Applies `STATE_ARMAGEDDON` for `auralencalc = ln12 = 1000 + (5-1)*50 = 1200` frames (`48` seconds at `slvl=5`).
   - Registers an `EVENTTYPE_ACTIVESTATE` timer firing every `Param4 = 8` frames (`0.32` seconds).
2. **Server Meteor Rain (`SKILLS_SrvDo146_Unused` / ActiveState Tick)**:
   - Every 8 frames while `STATE_ARMAGEDDON` is active, picks a random sub-tile offset within radius `Param3 = 8` around Diablo Clone and spawns invisible `diablogeddoncontrol` (#670, `Range=25` frames).
   - After 25 frames, `MISSMODE_SrvHit56_ArmageddonControl` (`0x6FC5B210`) deals radial damage (`sHitPar1 = 3` sub-tiles) from Skill #349 (`slvl=5`: `24–39` Physical + `95–151` Fire, `HitShift=8`, `ResultFlags=5` GetHit+Knockback) and spawns `diablogeddonfire` (#674, `Range=37, HitShift=2, DamageRate=41`).
3. **Client Meteor Visuals (`SkillCltDoFunc_92` @ `0x6FB795F0` & `CltHit55` @ `0x6FB65930`)**:
   - Client active-state tick (`CltPrg1=92`) spawns falling `diablogeddontail` (#672) and `diablogeddonrock` (#671) using 3D sky descent parameters (`cltcalc1=25, cltcalc2=25, cltcalc3=15` over `25` frames).
   - On impact (`CltHit55` @ `0x6FB65930`), `diablogeddonrock` spawns `diablogeddonexplosion` (#673) and `diablogeddonfire` (#674).

---

## 6. Izual (`izual` #256) & Hephasto (`hephasto` #409)

### 6.1 Izual (`izual` #256, `AI=Izual` @ `0x6FCDB3E0`)
- **Extreme Base HP Pool**: `MonStats.txt` sets `minHP = maxHP = 9481` (higher base HP than Diablo's `6427`), with flat `30%` Physical/Magic/Fire/Lightning/Poison resist and `75%` Cold resist across all difficulties.
- **AI State Machine (`AITHINK_Fn016_Izual` @ `0x6FCDB3E0`, `AiThink.cpp:L5229-5310`)**:
  - Parameters (`N / NM / H`): `aip1 = 45/50/50` (aggro radius), `aip2 = 50/50/50` (attack vs idle roll), `aip3 = 66/66/66` (ranged Frost Nova chance), `aip4 = 0/75/100` (melee Frost Nova chance), `aip5 = 20/5/0` (doldrums pause ticks), `aip6 = 3/4/4` (consecutive melee swings per burst).
  - If target distance $< 10$ and not in melee range: rolls `aip3` (`66%`) to cast `Skill1 = Frost Nova` (#44, `slvl=8`, `SrvDo=22`, `CltDo=25`).
  - If in melee range: rolls `aip4` (`0%` Normal, `75%` Nightmare, `100%` Hell) when `dwParam[0] == 0` to cast `Frost Nova` (#44, `slvl=8`), then sets `dwParam[0] = aip6` (`3` or `4` melee swings) before he can Frost Nova again.

### 6.2 Hephasto the Armorer (`hephasto` #409, `SuperUnique = The Feature Creep`, `AI=Smith` @ `0x6FCE28F0`)
- **Fixed SuperUnique Modifiers (`SuperUniques.txt`)**:
  - `Mod1 = 27` (`UMOD_SPECTRALHIT`), `Mod2 = 30` (`UMOD_AURA` — rolls a random Paladin offensive aura from `gAuraMods` in `MonsterUnique.cpp:L603`).
- **Dynamic Enrage Velocity Boost (`AITHINK_Fn044_Smith` @ `0x6FCE28F0`, `AiThink.cpp:L10287-10359`)**:
  - Every AI tick, computes Hephasto's current life percentage `nLifePct = SUNITDMG_GetLifePercentage(pUnit)` (`0..100`).
  - Sets dynamic walk/chase velocity bonus to:
    $$\text{BonusVelocity\%} = \frac{100 - \text{nLifePct}}{2}$$
  - At 100% HP, he moves at base speed (`+0%`); as his HP drops toward 0%, his movement speed ramps smoothly up to `+50%` via `AITACTICS_WalkToTargetUnitWithVelocity`.

---

## 7. Chaos Sanctuary Seal SuperUniques

### 7.1 Grand Vizier of Chaos (`fingermage3` #306, `AI=FingerMage` @ `0x6FCDCCD0`)
- **SuperUnique Setup**: `Mod1 = 5` (Extra Strong), `Mod2 = 9` (Fire Enchanted), `Minions = 4..5` Storm Casters (`Flying = 1`, ignores ground obstacles).
- **`FingerMageSpider` (#196, `slvl=5`)**:
  - **Launch (`SKILLS_SrvDo101_FingerMageSpider` @ `0x6FCD5110` / `CltDo57` @ `0x6FB08070`)**: Spawns `fingermagespider` (#177, `Vel=6, Range=80`) and stores the target unit's `eType` and `dwUnitId` in missile `nParam1/nParam2`.
  - **Homing Flight (`MISSMODE_SrvDo11_FingerMageSpider` @ `0x6FC61240` / `CltDo15` @ `0x6FB68BC0`)**: Every `Param1 = 5` frames (if `nRemainingFrames > 10`), checks distance to locked target; if within `Param2 = 20` sub-tiles, calls `MISSMODE_RecomputePath` (`PATHTYPE_MISSILE`) to steer toward the target.
  - **Mana Drain & Curse Impact (`MISSMODE_SrvHit19_FingerMageSpider` @ `0x6FC5E8A0`)**:
    - Deals `3–9 (+2/lvl)` physical + `6–12 (+6..8/lvl)` fire damage (`HitShift=7`).
    - Drains target's `STAT_MANA` directly on hit (`Skill calc1 = lvl - 1` scaling) and applies `STATE_FINGERMAGECURSE` (`auratargetstate = fingermagecurse`) for `ln12 = 30 + 10*(slvl-1) = 70` frames (`2.8`s at `slvl=5`), setting `STAT_MANARECOVERYBONUS = -24 * slvl = -120%`.

### 7.2 Lord De Seis (`doomknight3` #312, `AI=OblivionKnight` @ `0x6FCDDB10`)

1. **Hardcoded Fanaticism Aura (`MonsterUnique.cpp:L635-642`)**:
   - `SuperUniques.txt` gives `Lord De Seis` `Mod1 = 5` (Extra Strong), `Mod2 = 30` (Aura Enchanted), `Mod3 = 24` (Thief — stripped/no-op in 1.13c), and `5` Doom Knight minions.
   - Inside `MONSTERUNIQUE_ApplyAuraEnchanted` (`MonsterUnique.cpp:L635`), when `MONSTER_GetBossId(pUnit) == SUPERUNIQUE_LORD_DE_SEIS`, the game bypasses the random aura roll and hardcodes `nIndex = 5` in `gAuraMods`, granting **`SKILL_FANATICISM` (#122)** at level `clamp(mlvl / 8, 1, 99)` (`slvl=3` Normal, `slvl=7` Nightmare, `slvl=10` Hell).
2. **AI Casting Priority (`AITHINK_Fn027_OblivionKnight` @ `0x6FCDDB10`, `AiThink.cpp:L6963-7150`)**:
   - Retreats if target is within `aip1 = 6/7/8` sub-tiles; when retreating, rolls `aip5 = 80/85/90%` to cast `Skill4 = Decrepify` (#87, `slvl=3`).
   - Maintains `Skill2 = MonBoneArmor` (#210, `slvl=6`, absorbs `(20 + 10*5) = 70` physical damage).
   - Heals injured Doom Knight allies within `aip8 = 9/10/11` sub-tiles via `Skill5 = Bestow` (#182, `SrvDo=96` @ `0x6FCD3770`).
   - Casts `Skill6 = MonCurseCast` (#212, `slvl=3`), `Skill3 = MonBoneSpirit` (#211, `slvl=2`, homing `monbonespirit` #329), or `Skill1 = DoomKnightMissile` (#335, `slvl=3`).
3. **Component-Driven `DoomKnightMissile` (#335, `SrvDo=148` @ `0x6FCD4C20`, `CltDo=94` @ `0x6FB08990`)**:
   - Reads the Oblivion Knight's visual hand/weapon component variant (`0..3`) and adds it to `srvmissilea = undeadmissile1` (#323):
     - `+0` = `undeadmissile1` (#323, Poison)
     - `+1` = `undeadmissile2` (#324, Cold)
     - `+2` = `undeadmissile3` (#325, Fire)
     - `+3` = `undeadmissile4` (#326, Lightning)
4. **1.13c Binary Ground-Truth — `SKILLS_SrvDo112_MonCurseCast` (`0x6FCD5950`) Iron Maiden Removal**:
   - In pre-1.13 patches (1.10–1.12), `SKILLS_SrvDo112_MonCurseCast` rolled `0..99` against a 6-entry cumulative probability table that included `SKILL_IRONMAIDEN` (#76).
   - **Disassembly of 1.13c `D2Game.dll` (`0x6FCD5950..0x6FCD5BA9`) proves patch 1.13c replaced this with a uniform 5-way modulo roll**:
     ```asm
     6fcd595f: mov ecx, 0x6ac690c5
     6fcd5964: mul ecx                      ; advance pUnit->pSeed
     ...
     6fcd5978: mov ecx, 0x5                 ; divisor = 5
     6fcd597d: div ecx                      ; edx = rand % 5 (0..4)
     6fcd597f: mov ebp, [edx*4+0x6fd1b454]  ; lookup curse skill ID
     ...
     6fcd5a8c: jmp DWORD PTR [eax*4+0x6fcd5bb8] ; 5-case switch jump table
     ```
   - The 5-entry table at `0x6FD1B454` (`D2Game.dll` `.rdata`) contains:
     - `[0]` = `66` (`Amplify Damage` — 20% chance, sets `STAT_DAMAGERESIST = -100%` (`0xFFFFFF9C`))
     - `[1]` = `72` (`Weaken` — 20% chance, sets `STAT_DAMAGEPERCENT = -50%` (`0xFFFFFFCE`))
     - `[2]` = `82` (`Life Tap` — 20% chance)
     - `[3]` = `87` (`Decrepify` — 20% chance, sets `-50%` velocity/damage/damage resist/attack rate)
     - `[4]` = `91` (`Lower Resist` — 20% chance)
   - `Iron Maiden` (#76) is **completely absent** from the 1.13c binary table (`0x6FD1B454`), eliminating Oblivion Knight melee one-shot deaths in 1.13c.

### 7.3 Infector of Souls (`megademon3` #362, `AI=Megademon` @ `0x6FCDF780`)
- **SuperUnique Setup**: `Mod1 = 6` (Extra Fast), `Mod2 = 27` (Spectral Hit), `Minions = 6..6` Venom Lords.
- **`MegademonInferno` (#319, `slvl=8`, `SrvSt=53`, `SrvDo=95` @ `0x6FCD6A60`, `CltDo=54` @ `0x6FB08C90`)**:
  - Channels for `Param1 = 15` frames (`0.6`s per burst), firing every `calc3 = 2` frames while rewinding monster animation to `MonStats2.InfernoAnim = 10` (and rolling back to `11` on end).
  - **Server vs. Client Missile Split**:
    - Server `SKILLS_SrvDo095_MonInferno` (`0x6FCD6A60`) spawns `srvmissilea = megademoninferno` (#675, `Vel=12 * 0.75 = 9`, `Range = Param2 + slvl - 1 = 7 + 8 - 1 = 14` frames, `InitSteps=3`, `DamageRate=82`, `EType=fire`, `EMin=3 (+3/lvl)`, `EMax=6 (+4/lvl)`, `HitShift=8`).
    - Client `SKILLS_CltDo54_MonInferno` (`0x6FB08C90`) alternates randomly (`rand & 1`) between `cltmissilea = fetishinferno1` (#144, `Flamethrower`) and `cltmissileb = fetishinferno2` (#145, `Flamethrower2`) to vary the flame plume graphics.
