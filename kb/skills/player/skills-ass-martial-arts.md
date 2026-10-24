# Assassin Martial Arts Skill Tree (`Skills.txt` #254–#280) — 1.13c Ground Truth Reverse Engineering

## Overview

The Assassin **Martial Arts** skill tree in *Diablo II: Lord of Destruction* v1.13c consists of 10 active melee combat skills split into two functional archetypes:

1. **Progressive Charge-Up Skills (6 skills)**:
   - **Single-Weapon Charge-Ups** (`SKILLS_SrvDo034` @ `0x6FCB5690`): **Tiger Strike** (`#254`), **Cobra Strike** (`#265`), **Royal Strike / Phoenix Strike** (`#280`).
   - **Dual-Claw Elemental Charge-Ups** (`SKILLS_SrvDo035` @ `0x6FCB61A0`): **Fists of Fire** (`#259`), **Claws of Thunder** (`#269`), **Blades of Ice** (`#274`).
2. **Finishing Moves (4 skills)**:
   - **Kick Finishers**: **Dragon Talon** (`#255`), **Dragon Tail** (`#270`), **Dragon Flight** (`#275`).
   - **Dual-Claw Finisher**: **Dragon Claw** (`#260`).
   - *(Note: Normal Attack `#0` also acts as a valid finishing move that consumes active progressive charges via `sub_6FCF77E0`.)*

All binary addresses below correspond strictly to **Diablo II v1.13c** (`D2Client.dll` base `0x6FAB0000`, `D2Game.dll` base `0x6FC20000`).

---

## Dispatch Tables

### 1. `D2Game.dll` (`ImageBase = 0x6FC20000`)

| Table Symbol | 1.13c Table VA | Index | 1.13c Entry VA | Symbolic Name | Used By |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvStFnTable` | `0x6FD27338` | `12` | `0x6FC62360` | `SKILLS_SrvSt12_Telekinesis_DragonFlight` | Dragon Flight (`#275`) |
| `gpSkillSrvStFnTable` | `0x6FD27338` | `23` | `0x6FCB2030` | `SKILLS_SrvSt23_AssasinChargeStrikes` | Tiger Strike (`#254`), Fists of Fire (`#259`), Cobra Strike (`#265`), Claws of Thunder (`#269`), Blades of Ice (`#274`), Royal Strike (`#280`) |
| `gpSkillSrvStFnTable` | `0x6FD27338` | `24` | `0x6FCB2DF0` | `SKILLS_SrvSt24_DragonTalon` | Dragon Talon (`#255`) |
| `gpSkillSrvStFnTable` | `0x6FD27338` | `25` | `0x6FCB1B40` | `SKILLS_SrvSt25_64_DragonClaw_MonFrenzy` | Dragon Claw (`#260`) |
| `gpSkillSrvStFnTable` | `0x6FD27338` | `27` | `0x6FCB2940` | `SKILLS_SrvSt27_DragonTail` | Dragon Tail (`#270`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `34` | `0x6FCB5690` | `SKILLS_SrvDo034_TigerStrike_CobraStrike_RoyalStrike` | Tiger Strike (`#254`), Cobra Strike (`#265`), Royal Strike (`#280`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `35` | `0x6FCB61A0` | `SKILLS_SrvDo035_FistsOfFire_ClawsOfThunder_BladesOfIce` | Fists of Fire (`#259`), Claws of Thunder (`#269`), Blades of Ice (`#274`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `36` | `0x6FCB5040` | `SKILLS_SrvDo036_ClawsOfThunder_ProgressiveFn2` | Claws of Thunder (`#269` `SrvPrgFunc2`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `37` | `0x6FCB4F50` | `SKILLS_SrvDo037_ClawsOfThunder_ProgressiveFn3` | Claws of Thunder (`#269` `SrvPrgFunc3`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `38` | `0x6FCB3340` | `SKILLS_SrvDo038_FistsOfFire_BladesOfIce_ProgressiveFn2` | Fists of Fire (`#259` `SrvPrgFunc2`), Blades of Ice (`#274` `SrvPrgFunc2`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `39` | `0x6FCB4970` | `SKILLS_SrvDo039_FistsOfFire_BladesOfIce_ProgressiveFn3` | Fists of Fire (`#259` `SrvPrgFunc3`), Blades of Ice (`#274` `SrvPrgFunc3`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `40` | `0x6FCB2230` | `SKILLS_SrvDo040_RoyalStrike_ProgressiveFn1` | Royal Strike (`#280` `SrvPrgFunc1`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `41` | `0x6FCB3BC0` | `SKILLS_SrvDo041_RoyalStrike_ProgressiveFn3` | Royal Strike (`#280` `SrvPrgFunc3`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `42` | `0x6FCB5FE0` | `SKILLS_SrvDo042_DragonTalon` | Dragon Talon (`#255`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `46` | `0x6FCB3270` | `SKILLS_SrvDo046_DragonClaw` | Dragon Claw (`#260`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `50` | `0x6FCB3110` | `SKILLS_SrvDo050_DragonTail` | Dragon Tail (`#270`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `52` | `0x6FCB3680` | `SKILLS_SrvDo052_DragonFlight` | Dragon Flight (`#275`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `143` | `0x6FCB4E60` | `SKILLS_SrvDo143_FistsOfFire_RoyalStrike_ProgressiveFn` | Fists of Fire (`#259` `SrvPrgFunc1`), Royal Strike (`#280` `SrvPrgFunc2`) |
| `gpMissileSrvDoFnTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | Standard linear/stationary Martial Arts missiles |
| `gpMissileSrvDoFnTable` | `0x6FD2D970` | `35` | `0x6FC5F890` | `MISSMODE_SrvDo35_RoyalStrikeChaosIce` | `royalstrikechaosice` (`#569`) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `4` | `0x6FC5F220` | `MISSMODE_SrvHit04_ExplodingArrow_FreezingArrow_RoyalStrikeMeteorCenter` | `royalstrikemeteorcenter` (`#564`) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `12` | `0x6FC5D020` | `MISSMODE_SrvHit12_ChainLightning_LightningStrike` | `royalstrikechainlightning` (`#568`) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `14` | `0x6FC5DEF0` | `MISSMODE_SrvHit14_MeteorCenter_CatapultMeteor_RoyalStrikeMeteor` | `royalstrikemeteor` (`#563`) |
| `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | `2` | `0x6FC59080` | `MISSMODE_SrvDmg02_IceArrow_RoyalStrikeChaos` | `royalstrikechaosice` (`#569`) |
| `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | `10` | `0x6FC59040` | `MISSMODE_SrvDmg10_BladesOfIceCubes` | `bladesoficecubes` (`#561`) |

### 2. `D2Client.dll` (`ImageBase = 0x6FAB0000`)

| Table Symbol | 1.13c Table VA | Index | 1.13c Entry VA | Function Role | Used By |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `5` | `0x6FAF09B0` | Target non-town / LOS validation | Dragon Flight (`#275`) |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `6` | `0x6FAF06F0` | Multi-kick counter setup (`SkillParam1 = Calc1`) | Dragon Talon (`#255`) |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `9` | `0x6FAF0400` | Kick range / target orientation setup | Dragon Tail (`#270`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `4` | `0x6FAF0670` | Multi-kick decrement & animation rewind (`frame = 0`) | Dragon Talon (`#255`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `7` | `0x6FAF0910` | Target impact explosion missile spawner | Dragon Tail (`#270`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `9` | `0x6FAF1780` | Radial AoE client missile spawner | Fists of Fire (`#259` `CltPrgFunc2/3`), Blades of Ice (`#274` `CltPrgFunc2/3`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `10` | `0x6FAF07C0` | 64-direction Nova ring spawner | Claws of Thunder (`#269` `CltPrgFunc2`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `11` | `0x6FAF1690` | Radial Charged Bolt ring spawner | Claws of Thunder (`#269` `CltPrgFunc3`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `12` | `0x6FAF0B60` | Progressive overlay on target + sound on caster | Tiger Strike (`#254` `CltPrgFunc1..3`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `13` | `0x6FAF0A70` | Progressive overlay + sound on caster | Cobra Strike (`#265` `CltPrgFunc1..3`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `14` | `0x6FAF0880` | Client meteor center spawner | Royal Strike (`#280` `CltPrgFunc1`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `15` | `0x6FAF14F0` | 16-bolt Chaos Ice spiral spawner | Royal Strike (`#280` `CltPrgFunc3`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `83` | `0x6FAF15A0` | Radial Chain Lightning spawner | Royal Strike (`#280` `CltPrgFunc2`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | Standard client missile step | `dragontail missile` (`#533`), `dragonflight` (`#534`), `fistsoffireexplode` (`#556`), `clawsofthunderbolt` (`#558`), `clawsofthundernova` (`#559`), `bladesoficeexplode` (`#560`), `bladesoficecubes` (`#561`), `royalstrikemeteor` (`#563`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `5` | `0x6FB62F90` | Ground fire subloop animation controller | `fistsoffirefirewall` (`#557`), `royalstrikemeteorfire` (`#567`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `8` | `0x6FB691C0` | Lightning trail spawner (`lightninghit` `#99`) | `royalstrikechainlightning` (`#568`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `9` | `0x6FB68F00` | Meteor descent & impact shake controller | `royalstrikemeteorcenter` (`#564`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `58` | `0x6FB625D0` | 45° spiral rotation step (`Param1 = 3` frames) | `royalstrikechaosice` (`#569`) |
| `g_apfnCltHitFunc` | `0x6FB8DA10` | `10` | `0x6FB62570` | Target hit overlay applicator | `lightninghit` (`#99`) |
| `g_apfnCltHitFunc` | `0x6FB8DA10` | `16` | `0x6FB667D0` | Chain Lightning arc client hit handler | `royalstrikechainlightning` (`#568`) |
| `g_apfnCltHitFunc` | `0x6FB8DA10` | `18` | `0x6FB66540` | Meteor impact explosion & fire ring spawner | `royalstrikemeteorcenter` (`#564`) |

---

## Data Tables (`Skills.txt` & `Missiles.txt`)

### 1. `Skills.txt` — Martial Arts Skills (`#254`–`#280`)

| ID | Skill Name | Req Lvl | Anim / Seq | Mana (`min`, `shift`, `base`, `+lvl`) | `SrvSt` / `SrvDo` | `SrvPrgFunc` `[1, 2, 3]` | `CltSt` / `CltDo` | `CltPrgFunc` `[1, 2, 3]` | `ToHit` (`base`, `+lvl`) | `AuraState` (Len) | `PrgDam` / `prgstack` | Key Parameters & Formulas |
| :-: | :--- | :-: | :-: | :--- | :-: | :-: | :-: | :-: | :--- | :--- | :-: | :--- |
| `254` | **Tiger Strike** | 1 | `A1` | `1`, `8`, `1`, `0` (1 mana) | `23` / `34` | `[0, 0, 0]` | `0` / `0` | `[12, 12, 12]` | `15%`, `+7%` | `progressive_damage` (`375`f) | `1` / `0` | `Calc1 = ln12` (`100 + 20*(slvl-1)%` ED per charge); `progressive_tohit = +50%` AR |
| `255` | **Dragon Talon** | 1 | `KK` / `19` | `1`, `8`, `6`, `0` (6 mana) | `24` / `42` | `[0, 0, 0]` | `6` / `4` | `[0, 0, 0]` | `20%`, `+35%` | — | — | `Calc1 = lvl/6 + 1` kicks; Kick ED% = `ln12` (`5 + 7*(slvl-1)%`); KB chance: Normal `100%`, Unique `dm34` (`50..100%`), Boss/Player `dm56` (`25..99%`) |
| `259` | **Fists of Fire** | 6 | `SQ` / `16` | `1`, `8`, `2`, `0` (2 mana) | `23` / `35` | `[143, 38, 39]` | `0` / `0` | `[0, 9, 9]` | `15%`, `+7%` | `progressive_fire` (`375`f) | `4` / `1` | `Calc1 = lvl*3`% Phys→Fire conversion (capped at 100% at slvl 34); `Param1=4` (C2 radius), `Param2=4` (C3 radius); Synergy: `+12%` Fire dmg per `Royal Strike` blvl |
| `260` | **Dragon Claw** | 6 | `SQ` / `16` | `1`, `8`, `2`, `0` (2 mana) | `25` / `46` | `[0, 0, 0]` | `0` / `0` | `[0, 0, 0]` | `40%`, `+25%` | — | — | `Calc1 = ln12 + skill('Claw Mastery'.blvl)*4` (`50 + 5*(slvl-1) + 4*ClawMastery_blvl`% ED); requires dual-wielding two `h2h` claws |
| `265` | **Cobra Strike** | 12 | `A1` | `1`, `8`, `2`, `0` (2 mana) | `23` / `34` | `[0, 0, 0]` | `0` / `0` | `[13, 13, 13]` | `15%`, `+7%` | `progressive_steal` (`375`f) | `2` / `0` | `ln12 = 40 + 5*(slvl-1)%` leech (`C1`: Life, `C2`: Life+Mana, `C3`: `2*ln12` Life+Mana); `progressive_tohit = +50%` AR |
| `269` | **Claws of Thunder** | 18 | `SQ` / `16` | `1`, `8`, `4`, `0` (4 mana) | `23` / `35` | `[0, 36, 37]` | `0` / `0` | `[0, 10, 11]` | `15%`, `+7%` | `progressive_lightning` (`375`f) | `4` / `1` | `PrgCalc3 = Param1 = 4` (step 4 in 64-dir circle = 16 Charged Bolts); Synergy: `+8%` Ltng dmg per `Royal Strike` blvl |
| `270` | **Dragon Tail** | 18 | `KK` | `1`, `8`, `10`, `0` (10 mana) | `27` / `50` | `[0, 0, 0]` | `9` / `7` | `[0, 0, 0]` | `20%`, `+15%` | — | — | `Calc1 = ln12` (`50 + 10*(slvl-1)%` of actual post-resistance physical kick damage dealt as radial Fire AoE in `AuraRange = Param3 = 6` sub-tiles) |
| `274` | **Blades of Ice** | 24 | `SQ` / `16` | `1`, `8`, `3`, `0` (3 mana) | `23` / `35` | `[0, 38, 39]` | `0` / `0` | `[0, 9, 9]` | `15%`, `+7%` | `progressive_cold` (`375`f) | `4` / `1` | `Param1=6` (C2 cold AoE radius), `Param2=3` (C3 freeze radius); `ELen = 100 + 10*(slvl-1)` frames; Synergy: `+8%` Cold dmg per `Royal Strike` blvl |
| `275` | **Dragon Flight** | 24 | `SQ` / `21` | `1`, `8`, `15`, `0` (15 mana) | `12` / `52` | `[0, 0, 0]` | `5` / `0` | `[0, 0, 0]` | `60%`, `+25%` | — | — | `Delay = 25`f (1.0s); Kick ED% = `ln12` (`100 + 25*(slvl-1)%`); `AuraRange = Param7 = 27` sub-tiles max teleport range |
| `280` | **Royal Strike** *(Phoenix Strike)* | 30 | `A1` | `1`, `8`, `4`, `0` (4 mana) | `23` / `34` | `[40, 143, 41]` | `0` / `0` | `[14, 83, 15]` | `15%`, `+7%` | `progressive_other` (`375`f) | `0` / `0` | Non-stacking (`prgstack=0`): `C1` Meteor (`Param2=6` radius, `30+15*(slvl-1)`f fire), `C2` Chain Lightning (`PrgCalc2=Param6=10` step -> 7 bolts), `C3` Chaos Ice (`PrgCalc3=Param5=16` bolts) |

### 2. `Skills.txt` — Base Elemental Damage Curves (Charge-Ups)

| ID | Skill Name | `EType` | `HitShift` | `EMin` (`L1`, `+L2..8`, `+L9..16`, `+L17..22`, `+L23..28`, `+L29+`) | `EMax` (`L1`, `+L2..8`, `+L9..16`, `+L17..22`, `+L23..28`, `+L29+`) | `ELen` (`L1`, `+L2..8`, `+L9..16`, `+L17+`) |
| :-: | :--- | :-: | :-: | :--- | :--- | :--- |
| `259` | **Fists of Fire** *(C1/C2/C3 base)* | `fire` | `8` (`/1`) | `6` (`+5`, `+10`, `+20`, `+30`, `+40`) | `10` (`+5`, `+11`, `+22`, `+33`, `+44`) | — |
| `269` | **Claws of Thunder** *(C1/C2/C3 base)* | `ltng` | `8` (`/1`) | `1` (`+0`, `+0`, `+0`, `+0`, `+0`) | `80` (`+20`, `+40`, `+60`, `+80`, `+100`) | — |
| `274` | **Blades of Ice** *(C1/C2/C3 base)* | `cold` | `8` (`/1`) | `15` (`+8`, `+10`, `+20`, `+30`, `+40`) | `35` (`+8`, `+10`, `+22`, `+32`, `+42`) | `100` (`+10`, `+10`, `+10`) |

### 3. `Missiles.txt` — Martial Arts Sub-Missiles

| ID | Missile Name | `Vel` | `Range` | `Size` | `SrvDo` / `SrvHit` / `SrvDmg` | `CltDo` / `CltHit` | `NextDelay` | `EType` (`HitShift`) | `EMin` / `Emax` (`+Lev1..5`) | Synergy (`EDmgSymPerCalc`) |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- | :--- |
| `533` | `dragontail missile` | 0 | 16 | 1 | `1` / `0` / `0` | `1` / `0` | 0 | — | Visual explosion only (damage dealt in `SrvDo050`) | — |
| `534` | `dragonflight` | 0 | 15 | 1 | `1` / `0` / `0` | `1` / `0` | 0 | — | Teleport origin/destination VFX | — |
| `556` | `fistsoffireexplode` | 0 | 16 | 1 | `1` / `0` / `0` | `1` / `0` | 0 | — | Client-only C2 impact VFX | — |
| `557` | `fistsoffirefirewall` | 0 | 64 | 2 | `1` / `0` / `0` | `5` / `0` | 0 | `fire` (`3` = `/32`) | `6..10` (`+5,+10,+16,+22,+30` / `+5,+10,+17,+24,+32`) | `Royal Strike.blvl * 6`% |
| `558` | `clawsofthunderbolt` | 12 | 98 | 1 | `1` / `0` / `0` | `1` / `0` | 4 | `ltng` (`8`) | `1..40` (`+0..0` / `+20,+40,+60,+80,+100`) | `Royal Strike.blvl * 8`% |
| `559` | `clawsofthundernova` | 24 | 13 | 1 | `1` / `0` / `0` | `1` / `0` | 4 | `ltng` (`8`) | `1..30` (`+0..0` / `+15,+25,+35,+45,+65`) | `Royal Strike.blvl * 8`% |
| `560` | `bladesoficeexplode` | 0 | 16 | 1 | `1` / `0` / `0` | `1` / `0` | 0 | — | Client-only C2 impact VFX | — |
| `561` | `bladesoficecubes` | 0 | 30 | 1 | `1` / `0` / `10` | `1` / `0` | 0 | `frze` (`8`) | `1..1` (`ELen`: `100` + `10/lvl`, converted to `dwFrzLen`) | — |
| `563` | `royalstrikemeteor` | 0 | 60 | 0 | `0` / `14` / `0` | `1` / `0` | 0 | `fire` (`8`) | `20..40` (`+10,+19,+29,+38,+46` / `+10,+21,+33,+42,+50`) | `Fists of Fire.blvl * 10`% |
| `564` | `royalstrikemeteorcenter` | 0 | 60 | 1 | `1` / `4` / `0` | `9` / `18` | 0 | — | `Range=60`f (`2.4s` meteor fall timer); spawns `#563` on hit | — |
| `567` | `royalstrikemeteorfire` | 0 | 37 | 2 | `1` / `0` / `0` | `5` / `0` | 0 | `fire` (`3` = `/32`) | `6..10` (`+5,+10,+16,+22,+30` / `+5,+10,+17,+24,+32`) | `Fists of Fire.blvl * 6`% |
| `568` | `royalstrikechainlightning` | 30 | 60 | 2 | `1` / `*12` / `0` | `8` / `*16` | 4 | `ltng` (`8`) | `1..40` (`+0..0` / `+20,+40,+60,+80,+100`) | `Claws of Thunder.blvl * 13`% |
| `569` | `royalstrikechaosice` | 16 | 40 | 1 | `35` / `0` / `2` | `58` / `0` | 4 | `cold` (`8`) | `16..32` (`+4,+8,+12,+20,+28` / `+4,+8,+13,+21,+29`; `ELen`: `100`, `+10,+15,+20`) | `Blades of Ice.blvl * 10`% |

---

## Core Martial Arts Architecture

### 1. Progressive Charge-Up System (`SKILLS_SrvDo034` @ `0x6FCB5690`)

Every Martial Arts Charge-Up skill has `progressive = 1` in `Skills.txt` and maps to one of six dedicated states in `States.txt` (`progressive_damage` `#122` through `progressive_lightning` `#127`) and a corresponding stat (`STAT_PROGRESSIVE_DAMAGE` `#327` through `STAT_PROGRESSIVE_LIGHTNING` `#332`).

1. **Melee Range Check (`SKILLS_SrvSt23_AssasinChargeStrikes` @ `0x6FCB2030`)**:
   - Validates that the Assassin has a valid target unit within melee weapon range via `UNITS_IsInMeleeRange(pUnit, pTarget, 0)`.
2. **Charge Allocation & Increment (`SKILLS_SrvDo034` @ `0x6FCB5690`)**:
   - Performs a melee attack roll (`SUNITDMG_AllocCombat`) with skill `ToHit` (`+15% + 7%*(slvl-1)`), plus any currently active `STAT_PROGRESSIVE_TOHIT` bonus from existing charges.
   - **Charge Gain Condition**: Charges are ONLY awarded if `pDamage->dwResultFlags & DAMAGERESULTFLAG_SUCCESSFULHIT` (`0x01`) is true! A missed or blocked charge-up swing consumes mana and durability but does **not** add or refresh charges.
   - **State & StatList Management**:
     - Evaluates `AuraLenCalc` (`375` frames = **15.0 seconds** for all 6 skills) and registers/updates a timed statlist (`STATLIST_AllocStatList` with `pGame->dwGameFrame + 375`) for `wAuraState`.
     - Increments `wAuraStat[0]` (`STAT_PROGRESSIVE_*`) by `1`, clamped to `[1, 3]`.
     - Evaluates `dwAuraStatCalc[1]` (`Param4 = 50` for Tiger/Cobra/FoF/CoT/BoI; `Param7 = 25` for Royal Strike) and adds it to `wAuraStat[1]` (`STAT_PROGRESSIVE_TOHIT`) so each accumulated charge grants **+50% Attack Rating** (+25% for Royal Strike) on subsequent melee swings!
     - Attaches the charge-orbit visual overlay (`wCltOverlayA + charge - 1`) to the Assassin.
   - **Multiple Simultaneous Charge Types**: Because each of the 6 Charge-Up skills uses a distinct `AuraState` (`#122`–`#127`) with `group = 0` in `States.txt`, an Assassin can hold up to **3 charges of all 6 Charge-Up skills simultaneously**, and a single finishing move will release **all active charge states at once**!

### 2. Dual-Claw Charge-Up Mechanics (`SKILLS_SrvDo035` @ `0x6FCB61A0`)

**Fists of Fire (`#259`)**, **Claws of Thunder (`#269`)**, and **Blades of Ice (`#274`)** use `anim = SQ` (`seqnum = 16`) and `SrvDoFunc = 35` (`SKILLS_SrvDo035_FistsOfFire_ClawsOfThunder_BladesOfIce` @ `0x6FCB61A0`):

- If the Assassin is wielding a single weapon (or non-dual claws), `SrvDo035` simply delegates to `SKILLS_SrvDo034` (`0x6FCB5690`), building **1 charge** on hit.
- If the Assassin is dual-wielding two `h2h` claws (`D2Common_10434_CheckWeaponIsTwoHanded` / dual-wield check), the sequence animation (`seqnum = 16`) contains **two action frames** (`EVENT_DO_SKILL`).
- On the first claw swing (`(pUnit->dwSeqFrame >> 8) % 2 != 0`), `SrvDo035` sets `UNITFLAG_SKSRVDOFUNC` and calls `sub_6FCF6070` (primary claw combat roll + charge increment). On the second claw swing (`(dwSeqFrame >> 8) % 2 == 0`), it alternates weapon hand (`sub_6FCF8C70`) and executes a second combat roll + charge increment.
- **Result**: A single dual-claw cast of Fists of Fire, Claws of Thunder, or Blades of Ice can build **2 charges in one click** if both claws connect! By contrast, Tiger Strike (`#254`), Cobra Strike (`#265`), and Royal Strike (`#280`) use `anim = A1` and `SrvDoFunc = 34`, so they only swing **one weapon** per attack and build at most **1 charge** per click.

### 3. Finisher Charge Release & `prgstack` Dispatch (`sub_6FCF77E0` / `sub_6FCF5BC0`)

When any Finishing Move (`Dragon Talon`, `Dragon Claw`, `Dragon Tail`, `Dragon Flight`, or Normal Attack) lands a successful melee hit (`DAMAGERESULTFLAG_SUCCESSFULHIT`), it invokes `sub_6FCF77E0`:

1. Iterates through all active `STATLIST_FLAG_PROGRESSIVE` statlists on the Assassin.
2. Reads the charge count `nCharge = clamp(STATLIST_GetStatValue(pStatList, wAuraStat[0], 0), 1, 3)` and dispatches by `Skills.txt` `prgdam` (`nPrgDamage`):
   - **`prgdam = 1` (`sub_6FCF5680`, Tiger Strike `#254`)**:
     $$\text{ED\% Bonus} = \text{nCharge} \times \text{Calc1} = \text{nCharge} \times (100 + 20 \times (\text{slvl} - 1))$$
     Adds directly to `pDamage->dwEnDmgPct` (so 1x, 2x, 3x of `ln12`—e.g., at slvl 1: `+100%` / `+200%` / `+300%` ED; at slvl 20: `+480%` / `+960%` / `+1440%` ED).
   - **`prgdam = 2` (`sub_6FCF5870`, Cobra Strike `#265`)**:
     Computes base leech $\text{nLeech} = 40 + 5 \times (\text{slvl} - 1)$:
     - **Charge 1**: `pDamage->dwLifeLeech += nLeech`
     - **Charge 2**: `pDamage->dwLifeLeech += nLeech`, `pDamage->dwManaLeech += nLeech`
     - **Charge 3**: `pDamage->dwLifeLeech += 2 * nLeech`, `pDamage->dwManaLeech += 2 * nLeech`
   - **`prgdam = 4` (`sub_6FCF5BC0`, Fists of Fire `#259`, Claws of Thunder `#269`, Blades of Ice `#274`)**:
     - Rolls elemental melee damage via `D2GAME_RollElementalDamage(pUnit, pDamage, nChargeSkillId, nChargeSkillLvl)` and applies it to `pDamage` on **every charge level (1, 2, or 3)**.
     - Evaluates `Calc1` (`dwCalc[0]`) for physical-to-elemental conversion:
       $$\text{ConvPct} = \min(\text{Calc1}, 100)$$
       For **Fists of Fire (`#259`)**, `Calc1 = lvl * 3`. Thus Fists of Fire converts $3\% \times \text{slvl}$ of the finisher's physical damage into Fire damage—reaching **100% Physical-to-Fire conversion at slvl 34** (at which point Cobra Strike leeches 0 life/mana and Dragon Tail deals 0 Fire explosion damage because post-conversion physical damage is 0!).
     - Checks `prgstack`: since `prgstack = 1` (`SKILLSFLAG_PRGSTACK`) for `#259`, `#269`, and `#274`, `sub_6FCF5BC0` loops `for (int i = 0; i < nCharge; ++i)` and executes **all** `SrvPrgFunc[i]` from `0` up to `nCharge - 1` cumulatively!
   - **`prgdam = 0` (`sub_6FCF59C0`, Royal Strike `#280`)**:
     - Because `prgstack = 0` on Royal Strike, it does **not** stack across charge tiers: it executes **only** `SrvPrgFunc[nCharge - 1]` (Charge 1 = Meteor ONLY; Charge 2 = Chain Lightning ONLY; Charge 3 = Chaos Ice ONLY).
3. After executing all progressive callbacks, `sub_6FCF77E0` removes the progressive states (`STATES_ToggleState(..., 0)`) and frees their statlists (`D2Common_10474`).

### 4. Exact Kick Damage Formula (`SKILLS_CalculateKickDamage` & `sub_6FCF65D0`)

Dragon Talon (`#255`), Dragon Tail (`#270`), and Dragon Flight (`#275`) are **Kick skills**. Their physical damage is calculated in `sub_6FCF65D0` (`SkillAss.cpp`) and `SKILLS_CalculateKickDamage` (`D2Common.dll` `0x6FDB4260` in 1.10f / `D2Common#11234` in 1.13c):

1. **Unarmed Attribute Base (`sub_6FCF65D0`)**:
   $$\text{BaseAttrKick} = \left\lfloor \frac{\text{Strength} + \text{Dexterity} - 20}{4} \right\rfloor \quad (\text{clamped } \ge 0)$$
   $$\text{KickMin}_0 = \max(1, \text{BaseAttrKick}), \qquad \text{KickMax}_0 = \max(1, \text{BaseAttrKick}) + 1$$
2. **Boot Damage & Strength Scaling (`SKILLS_CalculateKickDamage`)**:
   - Temporarily merges active weapon statlists onto the player (`STATLIST_MergeStatLists`), fetches the item equipped in `BODYLOC_FEET` (`Boots`), and reads `Boots.MinDam` and `Boots.MaxDam` from `Armor.txt`.
   - In `Armor.txt`, all boots have `StrBonus = 120` and `DexBonus = 0`. `SKILLS_CalculateKickDamage` computes:
     $$\text{AttrED\%} = \left\lfloor \frac{\text{Str} \times 120}{100} \right\rfloor$$
   - Combines `AttrED%` with off-weapon `STAT_DAMAGEPERCENT` (from auras like Might/Fanaticism, Tiger Strike charges, non-weapon gear ED%, and the Kick skill's own ED% `Calc`):
     $$\text{TotalED\%} = \text{SkillED\%} + \text{TigerStrikeED\%} + \text{OffWeaponED\%} + \left\lfloor \frac{\text{Str} \times 120}{100} \right\rfloor$$
   - Scales the combined base + boot damage:
     $$\text{FinalKickMin} = \left\lfloor \frac{(\text{BaseAttrKick} + \text{BootsMin}) \times (100 + \text{TotalED\%})}{100} \right\rfloor$$
     $$\text{FinalKickMax} = \left\lfloor \frac{(\text{BaseAttrKick} + 1 + \text{BootsMax}) \times (100 + \text{TotalED\%})}{100} \right\rfloor$$
3. **Modifier Inheritance Rules for Kicks**:
   - **Applies to Kicks**: Crushing Blow, Open Wounds, Life/Mana Leech, Elemental/Magic/Venom damage on gear/charms, Chance to Cast on Striking/Attack, Prevent Monster Heal, Slows Target, Hit Blinds/Freezes/Flees Target, Ignore Target's Defense, `-Target Defense%`.
   - **Does NOT Apply to Kicks**: Weapon base physical damage, on-weapon `+Min/Max Damage` (and `+Min/Max` on charms/jewelry!), on-weapon Enhanced Damage %, Critical Strike (Claw Mastery), Deadly Strike.

---

## Skill-by-Skill Mechanics & Assembly Reverse Engineering

### 1. Tiger Strike (`#254`)
- **Server Start / Do**: `SKILLS_SrvSt23_AssasinChargeStrikes` (`0x6FCB2030`) / `SKILLS_SrvDo034_TigerStrike_CobraStrike_RoyalStrike` (`0x6FCB5690`).
- **Charge State**: `progressive_damage` (`#122`), duration `375` frames (15s), `+50%` AR per charge.
- **Finisher Effect (`prgdam = 1`, `sub_6FCF5680`)**:
  - Adds `nCharge * Calc1` (`Calc1 = 100 + 20*(slvl-1)`) to `pDamage->dwEnDmgPct`.
  - Charge 1 = `100 + 20*(slvl-1)%` ED; Charge 2 = `200 + 40*(slvl-1)%` ED; Charge 3 = `300 + 60*(slvl-1)%` ED.
- **Client Release (`SkillCltDoFunc[12]` @ `0x6FAF0B60`)**:
  - Validates target unit (`D2Common#10392` @ `0x6FAF0BBF`), reads charge count `[1..3]` (`D2Common#10680` @ `0x6FAF0C27`), offsets `wPrgOverlay` (`[esi+0x10C]`) and `wPrgSound` (`[esi+0x10E]`) by `charge - 1`, attaches the impact overlay to the **target** (`call 0x6FB1B300` @ `0x6FAF0C74`), and plays the release sound on the **caster** (`call 0x6FB38A70` @ `0x6FAF0C80`).

### 2. Dragon Talon (`#255`)
- **Server Start (`SKILLS_SrvSt24_DragonTalon` @ `0x6FCB2DF0`)**:
  - Evaluates kick count `Calc1 = lvl/6 + 1` (`1` kick at slvl 1–5, `2` kicks at slvl 6–11, `3` kicks at slvl 12–17, `4` kicks at slvl 18–23, `5` kicks at slvl 24–29, etc.) and stores it in `SkillParam1` (`SKILLS_SetParam1`).
  - Performs the initial kick combat roll via `sub_6FCF65D0` (`ED% = 5 + 7*(slvl-1)%`).
- **Server Do (`SKILLS_SrvDo042_DragonTalon` @ `0x6FCB5FE0`)**:
  - Calls `sub_6FCF77E0` to release active progressive charges on the **first** successful kick hit (`SUNITDMG_GetDamageFromUnits`), then drains weapon/boot durability (`SUNITDMG_DrainItemDurability`).
  - Decrements `SkillParam1` (`nParam = SKILLS_GetParam1(pSkill) - 1`).
  - **Knockback on Final Kick (`nParam <= 0`)**: Rolls knockback chance based on target type (`100%` vs Normal monsters; `Calc2 = dm34` `50..100%` vs Unique monsters; `Calc3/Calc4 = dm56` `25..99%` vs Bosses/Players/Mercenaries) and applies `DAMAGERESULTFLAG_KNOCKBACK` via `sub_6FCF7BC0`.
  - **Multi-Kick Chain (`nParam > 0`)**: If more kicks remain and the target is still alive/in range, clears `UNITFLAG_SKSRVDOFUNC` (`pUnit->dwFlags &= ~0x40`) and calls `sub_6FD15080(pUnit, 100)` to rewind the Assassin's sequence animation back to frame 0 for the next kick!
- **Client Start (`SkillCltStFunc[6]` @ `0x6FAF06F0`) & Do (`SkillCltDoFunc[4]` @ `0x6FAF0670`)**:
  - `SkillCltStFunc[6]` evaluates `dwCalc[0]` (`lvl/6 + 1`) via `D2Common#10786` (`0x6FAF079D`) and stores the kick count in `SkillParam1` (`D2Common#10243` @ `0x6FAF07A4`).
  - `SkillCltDoFunc[4]` decrements `SkillParam1` (`dec eax` @ `0x6FAF06C4`); if `eax > 0` (`jg`), writes `eax` back to `SkillParam1` (`0x6FAF06CB`) and resets the client unit's animation frame to zero (`mov DWORD PTR [esi+0x44], 0x0` @ `0x6FAF06D0`) so the kick animation repeats for each kick in the volley.

### 3. Fists of Fire (`#259`)
- **Server Start / Do**: `SKILLS_SrvSt23` (`0x6FCB2030`) / `SKILLS_SrvDo035` (`0x6FCB61A0`, dual-claw capable).
- **Charge State**: `progressive_fire` (`#125`), `prgdam = 4`, `prgstack = 1`.
- **Finisher Execution (`sub_6FCF5BC0` + `SrvPrgFunc = [143, 38, 39]`)**:
  - **All Charges (`1, 2, 3`)**: Adds Fists of Fire direct Fire damage (`EMin..EMax` + `+12%` synergy per `Royal Strike` base level) to the finishing melee attack, and converts $\min(3 \times \text{slvl}, 100)\%$ of physical damage into Fire damage. (`SrvPrgFunc1 = 143` is a no-op for `#259` because `wSrvMissileA == -1`.)
  - **Charge 2 (`SKILLS_SrvDo038` @ `0x6FCB3340`)**: Evaluates `PrgCalc2 = Param1 = 4` sub-tiles (`2.67` yards) and deals radial Fire explosion damage equal to Fists of Fire's direct Fire damage to all enemies within radius `4` (`sub_6FCF6C10`).
  - **Charge 3 (`SKILLS_SrvDo038` + `SKILLS_SrvDo039` @ `0x6FCB4970`)**: Executes Charge 2's radial explosion **plus** `SrvDo039`, which spawns `wSrvMissileC` (`fistsoffirefirewall` `#557`, `Range = 64` frames = `2.56s`, `HitShift = 3`, `+6%` synergy per `Royal Strike` blvl) across every walkable sub-tile in a circle of radius `PrgCalc3 = Param2 = 4` sub-tiles (`sub_6FD14170`).
- **Client Release (`SkillCltDoFunc[9]` @ `0x6FAF1780`)**:
  - Selects `wCltMissileB` (`fistsoffireexplode` `#556` on Charge 2) or `wCltMissileC` (`fistsoffirefirewall` `#557` on Charge 3) via `0x6FAF0550` (`0x6FAF17B2`), evaluates radius via `0x6FAF0450` (`0x6FAF17D2`), and calls `0x6FAF1100` (`0x6FAF1878`) to populate the radial fire/explosion visuals around the target.

### 4. Dragon Claw (`#260`)
- **Server Start (`SKILLS_SrvSt25_64_DragonClaw_MonFrenzy` @ `0x6FCB1B40`)**:
  - Validates that a target exists (`SUNIT_GetTargetUnit != nullptr`). Requires dual-wielding two `h2h` claws (`itypea1 = h2h`, `itypea2 = h2h`).
- **Server Do (`SKILLS_SrvDo046_DragonClaw` @ `0x6FCB3270`)**:
  - Uses `seqnum = 16` (`SQ` dual-claw sequence). Checks `bSetFlag = ((pUnit->dwSeqFrame >> 8) % 2) != 0`.
  - Calls `sub_6FCF8C70` to alternate between primary and secondary claws, rolling independent attack rating (`+40% + 25%*(slvl-1)`) and damage (`+50% + 5%*(slvl-1) + 4%*ClawMastery_blvl` ED) for each claw.
  - Calls `sub_6FCF77E0` on hit: progressive charges are consumed and released on the **first** claw hit; the second claw swings as a pure physical/weapon Dragon Claw strike.

### 5. Cobra Strike (`#265`)
- **Server Start / Do**: `SKILLS_SrvSt23` (`0x6FCB2030`) / `SKILLS_SrvDo034` (`0x6FCB5690`).
- **Charge State**: `progressive_steal` (`#123`), `prgdam = 2`, `prgstack = 0`.
- **Finisher Execution (`sub_6FCF5870`)**:
  - Evaluates $\text{nLeech} = 40 + 5 \times (\text{slvl} - 1)$:
    - **Charge 1**: $+\text{nLeech}\%$ Life Stolen per hit.
    - **Charge 2**: $+\text{nLeech}\%$ Life Stolen and $+\text{nLeech}\%$ Mana Stolen per hit.
    - **Charge 3**: $+2\text{nLeech}\%$ Life Stolen and $+2\text{nLeech}\%$ Mana Stolen per hit (e.g., at slvl 20: **270% Life Leech and 270% Mana Leech**!).
  - Because Cobra Strike adds directly to `pDamage->dwLifeLeech` and `pDamage->dwManaLeech`, it remains subject to difficulty leech penalties (`1/2` in Nightmare, `1/3` in Hell) and monster `Drain` effectiveness (`MonStats.txt`).
- **Client Release (`SkillCltDoFunc[13]` @ `0x6FAF0A70`)**:
  - Reads charge count `[1..3]` (`0x6FAF0AEE`), offsets `wPrgOverlay` (`+0x10C`) and `wPrgSound` (`+0x10E`) by `charge - 1`, and attaches the leech swirl overlay (`0x6FB1B300` @ `0x6FAF0B3B`) and sound (`0x6FB38A70` @ `0x6FAF0B47`) to the **caster** (`edi`).

### 6. Claws of Thunder (`#269`)
- **Server Start / Do**: `SKILLS_SrvSt23` (`0x6FCB2030`) / `SKILLS_SrvDo035` (`0x6FCB61A0`, dual-claw capable).
- **Charge State**: `progressive_lightning` (`#127`), `prgdam = 4`, `prgstack = 1`.
- **Finisher Execution (`sub_6FCF5BC0` + `SrvPrgFunc = [0, 36, 37]`)**:
  - **All Charges (`1, 2, 3`)**: Adds direct Lightning melee damage (`1` to `80 + 20..100/lvl`, `+8%` synergy per `Royal Strike` blvl) to the finishing attack.
  - **Charge 2 (`SKILLS_SrvDo036` @ `0x6FCB5040`)**: Spawns a 64-direction Nova ring of `wSrvMissileB` (`clawsofthundernova` `#559`, `Vel = 24`, `Range = 13`, `NextDelay = 4` frames) centered on the target via `SKILLS_SrvDo022_NovaAttack` (`sub_6FCF72D0`). Because `NextDelay = 4`, a monster hit by one Nova projectile is immune to the remaining Nova projectiles for 4 frames, preventing shotgunning on the primary target while hitting surrounding monsters.
  - **Charge 3 (`SKILLS_SrvDo036` + `SKILLS_SrvDo037` @ `0x6FCB4F50`)**: Fires Charge 2's 64-direction Nova **plus** `SrvDo037`, which iterates through a 64-direction circle table (`stru_6FD28150`) with step `PrgCalc3 = Param1 = 4` (`i = 0, 4, 8, ..., 60` = **16 bolts**), spawning 16 `clawsofthunderbolt` (`#558`, `Vel = 12`, `Range = 98`, `NextDelay = 4`) Charged Bolts outward from the target!
- **Client Release (`SkillCltDoFunc[10]` @ `0x6FAF07C0` & `SkillCltDoFunc[11]` @ `0x6FAF1690`)**:
  - `SkillCltDoFunc[10]` spawns the 64-direction client Nova ring (`0x6FB51020` @ `0x6FAF0863`) around the target (`ebp`).
  - `SkillCltDoFunc[11]` evaluates step `4` (`0x6FAF0450` @ `0x6FAF171B`) and calls `0x6FAF1000` (`0x6FAF1767`) to spawn 16 radial client Charged Bolts from the target.

### 7. Dragon Tail (`#270`)
- **Server Start (`SKILLS_SrvSt27_DragonTail` @ `0x6FCB2940`)**:
  - Validates melee range and rolls physical kick damage via `sub_6FCF65D0` (`ToHit = +20% + 15%*(slvl-1)`). Note that Dragon Tail's own `Calc1` (`50 + 10*(slvl-1)%`) is **not** passed as physical kick ED%; the physical kick only receives Tiger Strike / off-weapon ED% + Strength scaling!
- **Server Do (`SKILLS_SrvDo050_DragonTail` @ `0x6FCB3110`)**:
  - Retrieves combat damage (`pDamage = SUNITDMG_GetDamageFromUnits(pUnit, pTarget)`), applies active progressive charges via `sub_6FCF77E0`, and executes melee combat (`SUNITDMG_ExecuteEvents`).
  - **Post-Resistance Fire Explosion Formula**:
    If `pDamage->dwResultFlags & DAMAGERESULTFLAG_SUCCESSFULHIT`:
    1. Spawns `dragontail missile` (`#533`) on the target (`sub_6FD11420`).
    2. Reads `pDamage->dwPhysDamage`—which, because `SUNITDMG_ExecuteEvents` has already executed `SUNITDMG_ApplyResistancesAndAbsorb`, is the **actual post-resistance physical damage dealt to the primary target**!
    3. Computes radial Fire damage (`Calc1 = 50 + 10*(slvl-1)`):
       $$\text{FireAoEDmg} = \left\lfloor \frac{\text{PostResPhysKickDmg} \times (50 + 10 \times (\text{slvl} - 1))}{100} \right\rfloor$$
    4. Deals `FireAoEDmg` (as pure `DAMAGE_FIRE`) + Knockback (`DAMAGERESULTFLAG_KNOCKBACK`) to all enemies within `AuraRangeCalc = Param3 = 6` sub-tiles (`4` yards) of the target (`sub_6FCF8D60`).
    - **Critical Interaction**: Because `FireAoEDmg` scales off *post-resistance* physical damage on the primary target, kicking a Physically Immune (`100%` Physical Resist) monster—or using level 34+ Fists of Fire (`100%` Phys→Fire conversion)—results in **0 Fire explosion damage**! Conversely, Amplify Damage (`-100%` Phys Resist) or Decrepify (`-50%` Phys Resist) on the primary target multiplies both the physical kick and the resulting Fire AoE explosion!
- **Client Start (`SkillCltStFunc[9]` @ `0x6FAF0400`) & Do (`SkillCltDoFunc[7]` @ `0x6FAF0910`)**:
  - `SkillCltDoFunc[7]` verifies the target unit (`0x6FAF0944`), resolves `dragontail missile` (`#533`) via `0x6FAF0550` (`0x6FAF0975`), spawns it at the target (`0x6FB51540` @ `0x6FAF098E`), and sets `[esi+0xC4] |= 0x40`.

### 8. Blades of Ice (`#274`)
- **Server Start / Do**: `SKILLS_SrvSt23` (`0x6FCB2030`) / `SKILLS_SrvDo035` (`0x6FCB61A0`, dual-claw capable).
- **Charge State**: `progressive_cold` (`#126`), `prgdam = 4`, `prgstack = 1`.
- **Finisher Execution (`sub_6FCF5BC0` + `SrvPrgFunc = [0, 38, 39]`)**:
  - **All Charges (`1, 2, 3`)**: Adds direct Cold melee damage (`15..35` base + level scaling, `+8%` synergy per `Royal Strike` blvl) and chill duration (`ELen = 100 + 10*(slvl-1)` frames) to the finishing strike.
  - **Charge 2 (`SKILLS_SrvDo038` @ `0x6FCB3340`)**: Deals radial Cold AoE damage + chill (`ELen`) to all enemies within `PrgCalc2 = Param1 = 6` sub-tiles (`4` yards) of the target.
  - **Charge 3 (`SKILLS_SrvDo038` + `SKILLS_SrvDo039` @ `0x6FCB4970`)**: Executes Charge 2's radial Cold AoE **plus** `SrvDo039`, which spawns `bladesoficecubes` (`#561`) across a circle of radius `PrgCalc3 = Param2 = 3` sub-tiles (`2` yards).
  - **Freeze Conversion (`MISSMODE_SrvDmg10_BladesOfIceCubes` @ `0x6FC59040`)**:
    When `bladesoficecubes` (`#561`, `EType = frze`, `ELen = 100 + 10*(slvl-1)`) hits a unit, `MISSMODE_SrvDmg10` copies `pDamage->dwColdLen` into `pDamage->dwFrzLen` and zeroes `dwColdLen`, freezing monsters solid (subject to difficulty freeze-length divisor: `/1` Normal, `/2` Nightmare, `/4` Hell).

### 9. Dragon Flight (`#275`)
- **Server Start (`SKILLS_SrvSt12_Telekinesis_DragonFlight` @ `0x6FC62360`)**:
  - Validates that a target unit exists, is within `AuraRangeCalc = Param7 = 27` sub-tiles (`18` yards), and has unobstructed line-of-sight (`COLLISION_CheckMaskWithPattern` with `COLLIDE_MISSILE_BARRIER`).
- **Server Do (`SKILLS_SrvDo052_DragonFlight` @ `0x6FCB3680`)**:
  - Finds a free walkable sub-tile adjacent to the target via `COLLISION_GetFreeCoordinatesWithField` (`COLLIDE_MASK_PLAYER_FLYING`).
  - Spawns `dragonflight` (`#534`) teleport VFX missile at the Assassin's origin coordinates, teleports the Assassin to the destination room/coordinates (`D2Common_10295` / `sub_6FCBDFE0`), and spawns a second `dragonflight` (`#534`) VFX at the destination.
  - Immediately executes a single kick via `sub_6FCF65D0` (`ED% = 100 + 25*(slvl-1)%`, `ToHit = +60% + 25%*(slvl-1)`), releasing all active progressive charges (`sub_6FCF77E0`), and applies `Delay = 25` frames (1.0s global casting delay).
- **Client Start (`SkillCltStFunc[5]` @ `0x6FAF09B0`)**:
  - Verifies neither caster nor target is in town (`D2Common#10057`), target is a player or monster (`0 <= dwUnitType <= 1`), and line-of-sight is clear (`call 0x6FB562A0` @ `0x6FAF0A1B`).

### 10. Royal Strike / Phoenix Strike (`#280`)
- **Server Start / Do**: `SKILLS_SrvSt23` (`0x6FCB2030`) / `SKILLS_SrvDo034` (`0x6FCB5690`).
- **Charge State**: `progressive_other` (`#124`), `prgdam = 0`, `prgstack = 0` (non-stacking: executes ONLY the callback for the exact charge tier `[1, 2, or 3]`).
- **Charge 1 — Meteor (`SKILLS_SrvDo040` @ `0x6FCB2230` & `SkillCltDoFunc[14]` @ `0x6FAF0880`)**:
  - Spawns `royalstrikemeteorcenter` (`#564`, `Range = 60` frames = `2.4s` fall delay) at the target's coordinates.
  - **Client Descent (`MissileCltDoFunc[9]` @ `0x6FB68F00` & `MissileCltHitFunc[18]` @ `0x6FB66540`)**:
    - Identical to Sorceress Meteor (`#56`): on frame 0, spawns descending `royalstrikemeteor` (`#563`) and `royalstrikemeteortail` (`#565`) shifted upward in Z-space (`shl 0x0B`), descending over 60 frames. At frame 58 (`Range - 2`), triggers screen shake (`0x6FB38C20`). On expiration (`MissileCltHitFunc[18]`), spawns a 5-point cross of `royalstrikemeteorexplode` (`#566`), `whitelightmissile` (`#154`), and an 18-point ring of `firemedium` (`#105`).
  - **Server Impact (`MISSMODE_SrvHit04` @ `0x6FC5F220` -> `MISSMODE_SrvHit14` @ `0x6FC5DEF0`)**:
    - When `#564` expires after 60 frames, `SrvHit04` spawns `royalstrikemeteor` (`#563`, `EMin..EMax = 20..40` + level scaling, `+10%` synergy per `Fists of Fire` blvl), whose immediate `SrvHit14` deals radial Fire damage within `sHitPar1 = 6` sub-tiles (`4` yards) and spawns an 18-patch ground fire ring of `royalstrikemeteorfire` (`#567`, `HitShift = 3`, `+6%` synergy per `Fists of Fire` blvl, duration `Param3 + (slvl-1)*Param4 = 30 + 15*(slvl-1)` frames).
- **Charge 2 — Chain Lightning (`SKILLS_SrvDo143` @ `0x6FCB4E60` & `SkillCltDoFunc[83]` @ `0x6FAF15A0`)**:
  - Calls `sub_6FCF7390` with `wSrvMissileB` (`royalstrikechainlightning` `#568`, `Vel = 30`, `Range = 60`, `NextDelay = 4`, `EMin..EMax = 1..40` + level scaling, `+13%` synergy per `Claws of Thunder` blvl).
  - Iterates over the 64-entry circle offset table (`stru_6FD28150`) with step `PrgCalc2 = Param6 = 10` (`i = 0, 10, 20, 30, 40, 50, 60` = **7 radial Chain Lightning bolts**!).
  - Each bolt chains between nearby monsters on hit via `MISSMODE_SrvHit12_ChainLightning_LightningStrike` (`0x6FC5D020`) and `MissileCltHitFunc[16]` (`0x6FB667D0`), leaving a `lightninghit` (`#99`) trail via `MissileCltDoFunc[8]` (`0x6FB691C0`).
- **Charge 3 — Chaos Ice (`SKILLS_SrvDo041` @ `0x6FCB3BC0` & `SkillCltDoFunc[15]` @ `0x6FAF14F0`)**:
  - Evaluates bolt count `PrgCalc3 = Param5 = 16` and spawns **16** `royalstrikechaosice` (`#569`, `Vel = 16`, `Range = 40`, `NextDelay = 4`, `EMin..EMax = 16..32` + level scaling, `+10%` synergy per `Blades of Ice` blvl) bolts around the target with initial target offsets `(TargetX, TargetY)` evenly/randomly distributed in `[-20, 19]`.
  - **45° Spiral Trajectory (`MISSMODE_SrvDo35` @ `0x6FC5F890` & `MissileCltDoFunc[58]` @ `0x6FB625D0`)**:
    - Every `Param1 = 3` frames (`frame % 3 == 0`), both server (`0x6FC5F890`) and client (`0x6FB625D0`) step the missile's seed (`0x6AC690C5`) and rotate its `(TargetX, TargetY)` velocity vector:
      - In `MISSMODE_SrvDo35` (`0x6FC5F890`): `newTx = (tx - ty) / 2`, `newTy = (tx + ty) / 2` (or opposite sign based on initial chirality bit), rotating the flight path by 45° every 3 frames so all 16 ice bolts spiral outward in a vortex!
      - In `MissileCltDoFunc[58]` (`0x6FB625D0`): computes `newTx = (4*tx ± ty) >> 2` (`sar edi, 2` @ `0x6FB626B1`), `newTy = (4*ty ∓ tx) >> 2` (`sar ebp, 2` @ `0x6FB626B4`), and updates the client path (`D2Common#10286` / `D2Common#10334`).
  - **Freeze Application (`MISSMODE_SrvDmg02_IceArrow_RoyalStrikeChaos` @ `0x6FC59080`)**:
    - Converts `pDamage->dwColdLen` (`100` frames base + `+10/+15/+20` per level) into `pDamage->dwFrzLen`, freezing every monster struck by the spiraling Chaos Ice bolts!

---

## Summary Verification Checklist (Web Port Parity)

- [ ] **Charge Gain Gating**: Progressive charges (`#122`–`#127`) are ONLY incremented on `DAMAGERESULTFLAG_SUCCESSFULHIT` (`0x01`), capped at `3`, with a `375`-frame (15s) expiration timer and `+50%` AR (`+25%` on Royal Strike) per charge.
- [ ] **Dual-Claw Charge Generation**: Fists of Fire (`#259`), Claws of Thunder (`#269`), and Blades of Ice (`#274`) use `SrvDo035` (`0x6FCB61A0`) to swing both claws when dual-wielding, generating up to **2 charges per attack sequence**. Tiger Strike, Cobra Strike, and Royal Strike (`SrvDo034` `0x6FCB5690`) only swing 1 weapon per attack.
- [ ] **`prgstack` vs Non-Stacking**: Fists of Fire, Claws of Thunder, and Blades of Ice (`prgstack = 1`) execute `SrvPrgFunc[0..charge-1]` cumulatively (e.g., CoT Charge 3 fires melee lightning + 64-dir Nova + 16 Charged Bolts). Royal Strike (`prgstack = 0`) executes ONLY `SrvPrgFunc[charge-1]` (Charge 1 = Meteor, Charge 2 = 7 Chain Lightnings, Charge 3 = 16 Chaos Ice bolts).
- [ ] **Fists of Fire Physical-to-Fire Conversion**: Converts $\min(3 \times \text{slvl}, 100)\%$ of finisher physical damage to Fire (`sub_6FCF5BC0`), reaching 100% conversion at slvl 34.
- [ ] **Kick Damage & Dragon Tail Post-Resistance Scaling**: Kicks use `(Str + Dex - 20)/4` + `BootsMin..Max` scaled by `(100 + ED% + Str*120/100)%`. Dragon Tail's Fire AoE (`50 + 10*(slvl-1)%`) scales off **actual post-resistance physical damage dealt** to the primary target (`SKILLS_SrvDo050` @ `0x6FCB3110`).
