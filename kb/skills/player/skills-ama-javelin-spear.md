# Diablo II v1.13c Amazon Javelin & Spear Skills Mechanics (Skills #10, #14, #15, #19, #20, #24, #25, #30, #34, #35)

## 1. Dispatch Tables (`D2Client.dll` `0x6FAB0000`, `D2Game.dll` `0x6FC20000`, `D2Common.dll` `0x6FD50000`)

### 1.1 Skill Dispatch Tables
- `D2Game.dll` `g_apfnSkillSrvStFunc`: VA `0x6FD27338`
  - `g_apfnSkillSrvStFunc[4]` = `0x6FC6C840` (`SKILLS_SrvSt04_Arrow_Bolt`) — Throwing javelin & ammo validation (`#15`, `#20`, `#25`, `#35`)
  - `g_apfnSkillSrvStFunc[5]` = `0x6FC6C1C0` (`SKILLS_SrvSt05_Jab`) — Jab melee range check & `SkillParam1 = 0` reset (`#10`)
  - `g_apfnSkillSrvStFunc[6]` = `0x6FC6C720` (`SKILLS_SrvSt06_PowerStrike_ChargedStrike`) — Melee hit roll (`SUNITDMG_RollDamage`) & physical hit setup (`#14`, `#24`)
  - `g_apfnSkillSrvStFunc[7]` = `0x6FC6CC50` (`SKILLS_SrvSt07_Impale`) — Impale melee range check & damage/AR roll (`#19`)
  - `g_apfnSkillSrvStFunc[9]` = `0x6FC6C600` (`SKILLS_SrvSt09_Fend`) — Counts melee enemies within `MeleeRange + 4`, caps at `calc1 = 12` (`#30`)
  - `g_apfnSkillSrvStFunc[10]` = `0x6FC6C3A0` (`SKILLS_SrvSt10_LightningStrike`) — Melee hit roll & primary physical strike (`#34`)
- `D2Game.dll` `g_apfnSkillSrvDoFunc`: VA `0x6FD274A8`
  - `g_apfnSkillSrvDoFunc[1]` = `0x6FC6CA10` (`SKILLS_SrvDo001_BasicAttack`) — Default missile throw (`srvdofunc=0` on `#15`, `#20`, `#25`, `#35`)
  - `g_apfnSkillSrvDoFunc[2]` = `0x6FCC3220` (`SKILLS_SrvDo002_Kick_PowerStrike_MonIceSpear_Impale_Bash_Stun_Concentrate_BearSmite_Vengeance_Berserk_FireClaws`) — Executes melee damage & durability loss (`#14`, `#19`)
  - `g_apfnSkillSrvDoFunc[7]` = `0x6FC6CB00` (`SKILLS_SrvDo007_Jab`) — 3-strike rapid melee sequence (`#10`)
  - `g_apfnSkillSrvDoFunc[11]` = `0x6FC6D040` (`SKILLS_SrvDo011_ChargedStrike`) — Executes melee strike + spawns `3 + slvl/5` `chargedstrikebolt`s (`#24`)
  - `g_apfnSkillSrvDoFunc[13]` = `0x6FC6DAC0` (`SKILLS_SrvDo013_Fend_Zeal_Fury`) — Multi-target melee strike loop & animation rewind (`#30`)
  - `g_apfnSkillSrvDoFunc[14]` = `0x6FC6CE10` (`SKILLS_SrvDo014_LightningStrike`) — Executes melee strike + spawns chaining `lightningstrike` missile (`#34`)
- `D2Client.dll` `g_apfnSkillCltStFunc`: VA `0x6FB8E928`
  - `g_apfnSkillCltStFunc[11]` = `0x6FAC4F30` (`SKILLS_CltSt11_Arrow_Bolt`) — Client javelin/quantity validation (`#15`, `#20`, `#25`, `#35`)
  - `g_apfnSkillCltStFunc[12]` = `0x6FAC4F10` (`SKILLS_CltSt12_Jab`) — Resets client `SkillParam1 = 0` (`#10`)
  - `g_apfnSkillCltStFunc[14]` = `0x6FAC5350` (`SKILLS_CltSt14_Fend`) — Counts melee enemies (`0x2A783`), sets `SkillParam1..3` & faces target (`#30`)
- `D2Client.dll` `g_apfnSkillCltDoFunc`: VA `0x6FB8EA48`
  - `g_apfnSkillCltDoFunc[16]` = `0x6FAC4F40` (`SKILLS_CltDo16_Jab`) — Plays `dosound a` (`weapon_1ht_1`) or `dosound b` (`weapon_2ht_1`) on `[pUnit+0x4E] == 3` (`#10`)
  - `g_apfnSkillCltDoFunc[19]` = `0x6FAC5AB0` (`SKILLS_CltDo19_ChargedStrike`) — Spawns `3 + slvl/5` `chargedstrikebolt`s (`#215`) with `PATHTYPE_CHARGEDBOLT` (`#24`)
  - `g_apfnSkillCltDoFunc[21]` = `0x6FAC4FD0` (`SKILLS_CltDo21_Fend`) — Client multi-target melee loop & sequence frame rewind (`#30`)
  - `g_apfnSkillCltDoFunc[22]` = `0x6FAC5660` (`SKILLS_CltDo22_LightningStrike`) — Spawns client `lightningstrike` (`#232`) with `TargetX = calc2` (`#34`)

### 1.2 Missile Dispatch Tables
- `D2Game.dll` `g_apfnMissileSrvDoFunc`: VA `0x6FD2D970`
  - `g_apfnMissileSrvDoFunc[1]` = `0x6FC5F540` (`MISSMODE_SrvDo01_BasicMissile`) — Linear step & collision (`#99`, `#141`, `#205`, `#206`, `#215`, `#231`, `#232`)
  - `g_apfnMissileSrvDoFunc[2]` = `0x6FC61B80` (`MISSMODE_SrvDo02_PlagueJavelin_PoisonJavelin_PoisonTrap`) — Spawns `poisonjavcloud` (`#39`) on each flight step (`#38`)
  - `g_apfnMissileSrvDoFunc[3]` = `0x6FC61AE0` (`MISSMODE_SrvDo03_PoisonCloud_Blizzard_ThunderStorm_HandOfGod`) — Spawns trail clouds / periodic ticks (`#39`, `#43`, `#221`)
- `D2Game.dll` `g_apfnMissileSrvHitFunc`: VA `0x6FD2DA48`
  - `g_apfnMissileSrvHitFunc[2]` = `0x6FC5E330` (`MISSMODE_SrvHit02_PlagueJavelin_PoisonPotion`) — Spawns expanding circular cloud ring of `plaguejavcloud` (`#221`) (`#43`)
  - `g_apfnMissileSrvHitFunc[12]` = `0x6FC5D020` (`MISSMODE_SrvHit12_ChainLightning_LightningStrike`) — Chains `lightningstrike` (`#232`) across up to `calc2` targets (`#232`)
  - `g_apfnMissileSrvHitFunc[20]` = `0x6FC5DD60` (`MISSMODE_SrvHit20_LightningFury`) — Spawns up to `1 + slvl` `furylightning` (`#231`) bolts at enemies within `15` sub-tiles (`#206`)
- `D2Game.dll` `g_apfnMissileSrvDmgFunc`: VA `0x6FD2DB68`
  - `g_apfnMissileSrvDmgFunc[12]` = `0x6FC5A850` (`MISSMODE_SrvDmg12_LightningJavelin`) — Converts `100%` of `lightningjavelin` (`#205`) physical damage (`75%` weapon damage) into Lightning damage (`#205`)
- `D2Client.dll` `g_apfnMissileCltDoFunc`: VA `0x6FB8D8A0`
  - `g_apfnMissileCltDoFunc[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard`)
  - `g_apfnMissileCltDoFunc[3]` = `0x6FB6BE60` (`MISSMODE_CltDo03_PoisonJav`) — Spawns `poisonjavcloud` (`#39`) / `plaguejavcloud` (`#221`) trail on each flight step
  - `g_apfnMissileCltDoFunc[4]` = `0x6FB6BE00` (`MISSMODE_CltDo04_PoisonCloud`) — Randomly spawns `poisonpuff` (`#141`) drift visual
  - `g_apfnMissileCltDoFunc[8]` = `0x6FB691C0` (`MISSMODE_CltDo08_LightningStrike`) — Spawns `lightninghit` (`#99`) chain trail visual
- `D2Client.dll` `g_apfnMissileCltHitFunc`: VA `0x6FB8DA10`
  - `g_apfnMissileCltHitFunc[2]` = `0x6FB6B1B0` (`MISSMODE_CltHit02_PlagueJavelin`) — Spawns client expanding circular ring of `plaguejavcloud` (`#221`)
  - `g_apfnMissileCltHitFunc[10]` = `0x6FB62570` (`MISSMODE_CltHit10_LightningOverlay`) — Attaches `ProgOverlay = lightning` (`Overlay #1`, `ShockHitSm`) to hit target
  - `g_apfnMissileCltHitFunc[16]` = `0x6FB667D0` (`MISSMODE_CltHit16_LightningStrike`) — Applies `lightning` overlay & chains next `lightningstrike` (`#232`)
  - `g_apfnMissileCltHitFunc[25]` = `0x6FB6AEF0` (`MISSMODE_CltHit25_LightningFury`) — Spawns client `furylightning` (`#231`) bolts toward targets within `15` sub-tiles

---

## 2. `Skills.txt` & `Missiles.txt` Data Tables

### 2.1 `Skills.txt` Configuration (Skills #10, #14, #15, #19, #20, #24, #25, #30, #34, #35)

| ID | Skill | ReqLvl | `itypea1` (`range`) | `Anim` (`seqnum`) | `SrvSt` / `SrvDo` | `CltSt` / `CltDo` | `SrcDam` | `Mana` (`Shift`, `+lvl`) | `Delay` | `ToHit` (`+lvl`) | `EType` (`HitShift`) | `EMin` (`Lev1..5`) | `EMax` (`Lev1..5`) | Key Calcs & Synergies |
|---:|---|---:|---|---|---|---:|---:|---|---:|---|---|---|---:|---|
| 10 | **Jab** | 1 | `spea` (`h2h`) | `SQ` (`1`) | `5` / `7` | `12` / `16` | 128 (100%) | `8<<6>>8` = 2 (`+0.25`/lvl) | 0 | `10` (`+9`/lvl) | — (`8`) | — | — | 3-hit sequence; `calc1 = -15 + 3*(slvl-1)`% ED |
| 14 | **Power Strike** | 6 | `spea` (`h2h`) | `A1` | `6` / `2` | `0` / `0` | 128 (100%) | `8<<6>>8` = 2 (`+0.25`/lvl) | 0 | `20` (`+12`/lvl) | `ltng` (`8`) | `1` (`0..0`) | `16` (`18,36,54,72,90`) | `EDmgSym = (LS+LB+CS+LF).blvl * 10`% |
| 15 | **Poison Javelin** | 6 | `jave` (`rng`) | `TH` | `4` / `0` | `11` / `0` | 128 (100%) | `16<<6>>8` = 4 (`+0.25`/lvl) | 15 (0.6s) | — (base AR) | `pois` (`8`) | `32` (`16,32,48,64,96`) | `48` (`16,36,52,68,84`) | `ELen = 200 + 50*(slvl-1)` frames (`8s + 2s/lvl`); `EDmgSym = PlagueJav.blvl * 12`% |
| 19 | **Impale** | 12 | `spea` (`h2h`) | `SQ` (`8`) | `7` / `2` | `0` / `0` | 128 (100%) | `3<<8>>8` = 3 (`+0`/lvl) | 0 | `100` (`+25`/lvl) | — (`8`) | — | — | `calc1 = 300 + 25*(slvl-1)`% ED; `calc2 = 50 - dm(0, 30, slvl)`% durability loss chance |
| 20 | **Lightning Bolt** | 12 | `jave` (`rng`) | `TH` | `4` / `0` | `11` / `0` | 96 (75%) | `24<<6>>8` = 6 (`+0.25`/lvl) | 0 | — (`ToHit=0` on missile: auto-hit) | `ltng` (`8`) | `1` (`0..0`) | `40` (`12,18,28,48,88`) | Converts `100%` of `75%` phys weapon dmg to Lightning (`SrvDmg12`); `EDmgSym = (LS+PS+CS+LF).blvl * 3`% |
| 24 | **Charged Strike** | 18 | `spea` (`h2h`) | `A1` | `6` / `11` | `0` / `19` | 128 (100%) | `16<<6>>8` = 4 (`+0.25`/lvl) | 0 | — (base AR) | `ltng` (`8`) | `1` (`0..0`) | `30` (`12,16,20,24,28`) | Spawns `calc1 = 3 + slvl/5` bolts (unconditional on swing); `EDmgSym = (LS+LB+PS+LF).blvl * 10`% |
| 25 | **Plague Javelin** | 18 | `jave` (`rng`) | `TH` | `4` / `0` | `11` / `0` | 128 (100%) | `14<<7>>8` = 7 (`+0.5`/lvl) | 100 (4.0s) | `30` (`+9`/lvl) | `pois` (`3`) | `10` (`6,12,20,40,60`) | `16` (`6,12,20,40,60`) | `HitShift=3` (`8/256`); `ELen = 75 + 10*(slvl-1)` frames (`3s + 0.4s/lvl`); `EDmgSym = PoisonJav.blvl * 10`% |
| 30 | **Fend** | 24 | `spea` (`h2h`) | `A1` (`9`) | `9` / `13` | `14` / `21` | 128 (100%) | `5<<8>>8` = 5 (`+0`/lvl) | 0 | `40` (`+10`/lvl) | — (`8`) | — | — | Strikes up to `calc1 = 12` nearby melee enemies; `calc2 = 70 + 10*(slvl-1)`% ED |
| 34 | **Lightning Strike** | 30 | `spea` (`h2h`) | `A1` | `10` / `14` | `0` / `22` | 128 (100%) | `9<<8>>8` = 9 (`+0`/lvl) | 0 | — (base AR) | `ltng` (`8`) | `1` (`0..0`) | `25` (`10,15,20,25,30`) | Chains `calc2 = 2 + (slvl-1)*1` hits (`1 + slvl` hits) within `calc1 = 20` sub-tiles; `EDmgSym = (CS+LB+PS+LF).blvl * 8`% |
| 35 | **Lightning Fury** | 30 | `jave` (`rng`) | `TH` | `4` / `0` | `11` / `0` | 128 (100%) | `20<<7>>8` = 10 (`+0.5`/lvl) | 0 | — (javelin `ToHit=0`? No, javelin `ToHit=0`! Auto-hit!) | `ltng` (`8`) | `1` (`0..0`) | `40` (`20,30,40,50,50`) | Releases up to `calc1 = 2 + (slvl-1)` (`1 + slvl`) bolts within `15` sub-tiles on each hit/pierce; `EDmgSym = (CS+LB+PS+LS).blvl * 1`% |

*(Note on `itypea1`: Spear melee skills (`#10, #14, #19, #24, #30, #34`) specify `itypea1 = spea`, which encompasses Spears (`spea`), Amazon Spears (`aspe`), Javelins (`jave`), and Amazon Javelins (`ajav`) via `ItemTypes.txt` hierarchy; throwing skills (`#15, #20, #25, #35`) specify `itypea1 = jave`, requiring throwing Javelins (`jave` or `ajav`).)*

### 2.2 `Missiles.txt` Suite for Javelin & Spear Skills

| ID | Missile | `SrvDo` | `SrvHit` | `SrvDmg` | `CltDo` | `CltHit` | `Vel` | `Range` | `Size` | `Pierce` | `ToHit` | `AlwaysExplode` | `NextHit` / `Delay` | `CelFile` (`Dirs`, `Len`) | Sub-Missiles / Overlays |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| 38 | `poisonjav` | 2 | 0 | 0 | 3 | 0 | 24 | 25 | 1 | 1 | 1 | 0 | 0 / 0 | `Javelin` (32, 1) | `Sub1: poisonjavcloud` (`#39`) |
| 39 | `poisonjavcloud` | 3 | 0 | 0 | 4 | 0 | 0 | 60 | 2 | 0 | 0 | 0 | 0 / 0 | `PoisonSparks` (8, 31) | `SrcDamage=-1`, `CltSub1: poisonpuff` (`#141`) |
| 43 | `plaguejavelin` | 3 | 2 | 0 | 3 | 2 | 24 | 15 | 1 | 1 | 1 | 1 | 0 / 0 | `Javelin` (32, 1) | `Sub1` & `HitSub1`: `plaguejavcloud` (`#221`), `sHitPar1..3 = 1,2,3` |
| 99 | `lightninghit` | 1 | 0 | 0 | 1 | 10 | 0 | 12 | 1 | 0 | 0 | 0 | 0 / 0 | `LightningStrike` (32, 8) | Visual chain trail (`ProgOverlay = lightning` `#1`) |
| 141 | `poisonpuff` | 1 | 0 | 0 | 1 | 0 | 1 | 25 | 1 | 0 | 0 | 0 | 0 / 0 | `PoisonSmokePuff` (4, 26) | Visual poison drift puff |
| 205 | `lightningjavelin` | 1 | 0 | 12 | 1 | 10 | 30 | 25 | 2 | 1 | 0 | 0 | 0 / 0 | `LightningJavelin` (16, 5) | `ProgOverlay = lightning` (`#1`), `dParam1=100` (`SrvDmg12`) |
| 206 | `lightningfury` | 1 | 20 | 0 | 1 | 25 | 30 | 25 | 2 | 1 | 0 | 0 | 0 / 0 | `LightningJavelin` (16, 5) | `HitSub1: furylightning` (`#231`) |
| 215 | `chargedstrikebolt` | 1 | 0 | 0 | 1 | 10 | 12 | 98 | 1 | 0 | 0 | 0 | 0 / 0 | `ChargedBolt` (16, 10) | `Activate=3`, `SubLoop=1 (2..8)` |
| 221 | `plaguejavcloud` | 3 | 0 | 0 | 4 | 0 | 0 | 60 | 2 | 0 | 0 | 0 | 0 / 0 | `PoisonSparks` (8, 31) | `SrcDamage=-1`, `Collision=1`, `CltSub1: poisonpuff` (`#141`) |
| 231 | `furylightning` | 1 | 0 | 0 | 1 | 0 | 30 | 25 | 2 | 0 | 0 | 0 | 0 / 0 | `LightningStrike` (32, 8) | `SrcDamage=-1` (pure skill lightning bolt) |
| 232 | `lightningstrike` | 1 | 12 | 0 | 8 | 16 | 30 | 25 | 2 | 0 | 0 | 0 | 1 / 4 | `LightningStrike` (32, 8) | `NextDelay=4`, `CltSub1: lightninghit` (`#99`), `ProgOverlay: lightning` (`#1`) |

---

## 3. Multi-Strike & Heavy Spear Melee Skills: Jab (#10), Impale (#19), & Fend (#30)

### 3.1 Jab (#10) (`SKILLS_SrvSt05` @ `0x6FC6C1C0`, `SKILLS_SrvDo007` @ `0x6FC6CB00`, `CltSt12` @ `0x6FAC4F10`, `CltDo16` @ `0x6FAC4F40`)
1. **Sequence & Damage Scaling**:
   - Uses `anim = SQ` (`seqnum = 1` in `MonSeq.txt` / player sequence table), which defines **3 melee trigger frames** within a single rapid thrusting animation.
   - `SKILLS_SrvSt05_Jab` (`0x6FC6C1C0`) and `SKILLS_CltSt12_Jab` (`0x6FAC4F10`) validate melee range against the target and initialize `SkillParam1 = 0`.
   - On each of the 3 trigger frames, `SKILLS_SrvDo007_Jab` (`0x6FC6CB00`) verifies the target is still in melee range (`MeleeRange`), rolls an independent Attack Rating (`+10 + 9*(slvl-1)`% AR) and physical damage strike with `calc1 = ln34 = -15 + 3 * (slvl - 1)`% Enhanced Damage (`-15%` ED at slvl 1, reaching `0%` at slvl 6 and `+42%` ED at slvl 20), applies weapon durability loss (`durability = 1`), and increments `SkillParam1`.
2. **Client Sound Trigger (`SKILLS_CltDo16_Jab` @ `0x6FAC4F40`)**:
   - Checks `[pUnit + 0x4E] == 3` (sequence frame trigger flag), selects `wDoSoundA` (`weapon_1ht_1` for 1H javelins) or `wDoSoundB` (`weapon_2ht_1` for 2H spears), and plays the swing sound via `0x6FB38A70`.

### 3.2 Impale (#19) (`SKILLS_SrvSt07` @ `0x6FC6CC50`, `SKILLS_SrvDo002` @ `0x6FCC3220`)
1. **Slow High-Multiplier Strike**:
   - Uses `anim = SQ` (`seqnum = 8`), a slow, heavy wind-up thrust (`interrupt = 1`), with `+100 + 25 * (slvl - 1)`% Attack Rating and `calc1 = ln12 = 300 + 25 * (slvl - 1)`% Enhanced Damage (`+300%` ED at slvl 1, `+775%` ED at slvl 20).
2. **Accelerated Durability Loss (`calc2` & `calc3`)**:
   - `SKILLS_SrvSt07_Impale` (`0x6FC6CC50`) rolls hit and damage (`SUNITDMG_RollDamage`) using `calc1`% ED.
   - On strike (`SKILLS_SrvDo002` @ `0x6FCC3220`), in addition to normal melee durability wear, Impale evaluates `calc2 = par6 - dm34 = 50 - dm(0, 30, slvl)`% (`38%` at slvl 1 down to `24%` at slvl 20, asymptote `20%`):
     - Rolls `rand(0..99) < calc2`. If true, immediately deducts `calc3 = par5 = 1` extra point of weapon durability (or 1 javelin quantity if used with a non-replenishing javelin)!

### 3.3 Fend (#30) (`SKILLS_SrvSt09` @ `0x6FC6C600`, `SKILLS_SrvDo013` @ `0x6FC6DAC0`, `CltSt14` @ `0x6FAC5350`, `CltDo21` @ `0x6FAC4FD0`)
1. **Target Acquisition & Cap (`SKILLS_SrvSt09_Fend` @ `0x6FC6C600`, `SKILLS_CltSt14_Fend` @ `0x6FAC5350`)**:
   - Computes melee reach `D2GAME_GetMeleeRange(pUnit) + 4` sub-tiles and counts all valid enemy monsters within reach (`filter = 0x2A783`).
   - Caps target count at `calc1 = 12` (`Shots = min(EnemyCount, 12)`), stores `SkillParam1 = Shots`, `SkillParam2 = TargetType`, `SkillParam3 = TargetGUID`, and faces the initial target. Unlike Zeal, Fend hits **each nearby monster at most once** per cycle (if only 1 monster is in melee range, Fend performs only 1 strike).
2. **Rapid Multi-Target Strike Loop (`SKILLS_SrvDo013` @ `0x6FC6DAC0`, `SKILLS_CltDo21` @ `0x6FAC4FD0`)**:
   - On each trigger frame (`seqnum = 9` / `A1`), attacks the current target with `+40 + 10*(slvl-1)`% AR and `calc2 = ln34 = 70 + 10 * (slvl - 1)`% Enhanced Damage, then decrements `SkillParam1`.
   - While `SkillParam1 > 0`, advances to the next distinct enemy within melee reach, rotates the Amazon to face it, and **rewinds the animation frame** (`0x6FAB2BE0` $\to$ `0x6FB505F0` on client; `D2COMMON_10446_SetUnitFrame` on server) for rapid consecutive thrusts.

---

## 4. Melee Lightning Spear Skills: Power Strike (#14), Charged Strike (#24), & Lightning Strike (#34)

### 4.1 Power Strike (#14) (`SKILLS_SrvSt06` @ `0x6FC6C720`, `SKILLS_SrvDo002` @ `0x6FCC3220`)
- Standard `A1` single-target melee strike (`+20 + 12*(slvl-1)`% AR) that adds high-variance skill Lightning damage (`EMin = 1`, `EMax = 16` + `18/36/54/72/90` per tier) multiplied by `+10%` per base level in **Lightning Bolt**, **Charged Strike**, **Lightning Strike**, and **Lightning Fury** (`+800%` max synergy).
- `SKILLS_SrvSt06` rolls the melee attack and sets `SKILL_SetFlags(pSkill, 0x80)` if the AR roll succeeds; `SKILLS_SrvDo002` applies both physical and lightning damage on hit.

### 4.2 Charged Strike (#24) (`SKILLS_SrvSt06` @ `0x6FC6C720`, `SKILLS_SrvDo011` @ `0x6FC6D040`, `SKILLS_CltDo19` @ `0x6FAC5AB0`)
1. **Unconditional Bolt Release on Swing**:
   - `SKILLS_SrvSt06` rolls the physical melee hit.
   - On the `A1` hit frame, `SKILLS_SrvDo011_ChargedStrike` (`0x6FC6D040`) applies the melee physical damage (if the melee AR check succeeded), and **unconditionally** (even if the physical melee swing missed!) evaluates `calc1`:
     $$\text{BoltCount} = 3 + \left\lfloor \frac{\text{slvl}}{5} \right\rfloor$$
     *(3 bolts at slvl 1–4, 4 at slvl 5–9, 5 at slvl 10–14, 6 at slvl 15–19, 7 at slvl 20, etc.)*
2. **Away-Vector Trajectory & `PATHTYPE_CHARGEDBOLT` (`0x6FC6D040` & `0x6FAC5AB0`)**:
   - Computes the away-vector from caster `(casterX, casterY)` through the target `(targetX, targetY)`:
     $$\text{aimX} = 2 \cdot \text{targetX} - \text{casterX}, \qquad \text{aimY} = 2 \cdot \text{targetY} - \text{casterY}$$
   - Loops `BoltCount` times, spawning `chargedstrikebolt` (`#215`, `Vel = 12`, `Range = 98`, `ToHit = 0`, `NextDelay = 0`) originating at `(targetX, targetY)` aimed toward `(aimX, aimY)` with `PATHTYPE_CHARGEDBOLT` (`0x6FB23B60` init callback on client).
3. **Zero `NextDelay` Shotgun Overlap**:
   - Because `chargedstrikebolt` (`#215`) has **`NextDelay = 0`** and **`ToHit = 0`** (auto-hit) and spawns directly on top of the melee target's sub-tile, large targets (`Size = 2` or `Size = 3` act bosses like Diablo, Baal, Mephisto) immediately collide with **every single bolt** simultaneously, multiplying per-bolt damage (`1` to `EMax`, `+10%` per synergy level in LB/PS/LS/LF) by `BoltCount`!

### 4.3 Lightning Strike (#34) (`SKILLS_SrvSt10` @ `0x6FC6C3A0`, `SKILLS_SrvDo014` @ `0x6FC6CE10`, `MISSMODE_SrvHit12` @ `0x6FC5D020`, `CltDo22` @ `0x6FAC5660`, `CltHit16` @ `0x6FB667D0`)
1. **Initial Melee Strike & First Chain Launch**:
   - `SKILLS_SrvSt10` rolls the physical melee hit. Regardless of whether the physical swing hits or misses (`SKILLS_SrvDo014` @ `0x6FC6CE10` & `SKILLS_CltDo22` @ `0x6FAC5660`), evaluates:
     - Chain search radius: `calc1 = 20` sub-tiles (`13.33` yards)
     - Total chain hits: `calc2 = ln34 = 2 + (slvl - 1) * 1 = 1 + slvl` hits (`Param3 = 2, Param4 = 1`)
   - Searches within `20` sub-tiles of the primary target for a secondary enemy (`filter = 0xA283` on client / `0x88583` on server).
   - Spawns `lightningstrike` (`#232`, `Vel = 30`, `Range = 25`, `NextHit = 1`, `NextDelay = 4` frames) from the primary target toward the secondary target, storing remaining bounces `TargetX = calc2` (`PATH_SetTargetX` / `D2Common_10637`).
2. **Recursive Chain Bounce (`MISSMODE_SrvHit12` @ `0x6FC5D020` & `MISSMODE_CltHit16` @ `0x6FB667D0`)**:
   - In flight, `CltDoFunc = 8` (`0x6FB691C0`) spawns `lightninghit` (`#99`) visual trail segments behind the bolt on each path step.
   - Upon hitting a target (`ToHit = 0` auto-hit, dealing `1..EMax` lightning damage with `+8%` per synergy level in CS/LB/PS/LF, subject to `NextDelay = 4` frames):
     - Client attaches `ProgOverlay = lightning` (`Overlay #1`, `ShockHitSm`) via `0x6FB1B300`.
     - Reads remaining chain count `nBounces = TargetX` (`D2Common_11018`).
     - **If `nBounces > 1`**: Searches within `20` sub-tiles (`filter = 0x88583`) for the nearest valid enemy `pNext != pCurrentHit`, spawns a new `lightningstrike` (`#232`, flags `0x21`) from `pCurrentHit` to `pNext`, sets the new missile's `TargetX = nBounces - 1`, and records `pCurrentHit` (`D2Common_10024`) so the bolt cannot immediately bounce onto the same unit on tick 0.

---

## 5. Thrown Javelin Skills: Poison Javelin (#15), Plague Javelin (#25), Lightning Bolt (#20), & Lightning Fury (#35)

### 5.1 Poison Javelin (#15) (`MISSMODE_SrvDo02` @ `0x6FC61B80`, `MISSMODE_SrvDo03` @ `0x6FC61AE0`, `CltDo03` @ `0x6FB6BE60`, `CltDo04` @ `0x6FB6BE00`)
1. **Javelin Flight & Trail Spawning (`poisonjav` `#38`)**:
   - Has a `15`-frame (`0.6` second) casting delay (`delay = 15`), `SrcDam = 128` (`100%` physical throwing damage on javelin hit), `ToHit = 1`, and `Pierce = 1`.
   - As `poisonjav` (`#38`, `Vel = 24`, `Range = 25`) flies, `MISSMODE_SrvDo02` (`0x6FC61B80`) on server and `MISSMODE_CltDo03` (`0x6FB6BE60`) on client spawn `SubMissile1 = poisonjavcloud` (`#39`) on **every sub-tile path step** (`D2Common_10203`), leaving a continuous line of lingering poison clouds behind the javelin.
2. **Cloud Persistence & Poison Bitrate (`poisonjavcloud` `#39`)**:
   - Each `poisonjavcloud` (`#39`, `Size = 2`, `SrcDamage = -1` = no physical weapon damage) persists for `Range = 60` frames (`2.4` seconds) and uses `CltDo04` (`0x6FB6BE00`) to randomly drift `poisonpuff` (`#141`) smoke sprites.
   - Any enemy touching the javelin or any `poisonjavcloud` receives skill poison bitrate (`HitShift = 8`, `EMin = 32..48` at slvl 1, `+12%` per base level of Plague Javelin) over `ELen = 200 + 50 * (slvl - 1)` frames ($8 + 2(\text{slvl}-1)$ seconds).

### 5.2 Plague Javelin (#25) (`MISSMODE_SrvHit02` @ `0x6FC5E330`, `CltHit02` @ `0x6FB6B1B0`)
1. **Casting Delay, Trail, & Impact Explosion**:
   - Has a `100`-frame (`4.0` second) casting delay (`delay = 100`), `usemanaondo = 1`, `SrcDam = 128`, `ToHit = 30 + 9*(slvl-1)`% AR bonus, `Pierce = 1`, and `AlwaysExplode = 1`.
   - While `plaguejavelin` (`#43`, `Vel = 24`, `Range = 15`) flies, `SrvDo03` (`0x6FC61AE0`) and `CltDo03` (`0x6FB6BE60`) spawn a trail of `plaguejavcloud` (`#221`) along its path.
   - Upon hitting a target (and on every pierced target, as well as wall/range termination because `AlwaysExplode = 1`), `MISSMODE_SrvHit02` (`0x6FC5E330`) and `MISSMODE_CltHit02` (`0x6FB6B1B0`) invoke the radial expanding cloud spawner (`0x6FC5E1E0` / `0x6FB66BC0`) with `sHitPar1 = 1, sHitPar2 = 2, sHitPar3 = 3`, launching concentric expanding rings of `plaguejavcloud` (`#221`, `Range = 60` frames = `2.4s`, `Size = 2`, `SrcDamage = -1`) outward from the impact point.
2. **Poison Bitrate Scaling (`HitShift = 3`)**:
   - Skill #25 uses `HitShift = 3` (`8/256` per frame) and compact poison duration `ELen = 75 + 10 * (slvl - 1)` frames ($3.0 + 0.4(\text{slvl}-1)$ seconds), with `+10%` poison bitrate per base level of Poison Javelin, yielding dramatically higher DPS per frame than Poison Javelin at high levels.

### 5.3 Lightning Bolt (#20) (`MISSMODE_SrvDmg12_LightningJavelin` @ `0x6FC5A850`, `MISSMODE_CltHit10` @ `0x6FB62570`)
1. **Auto-Hit & 75% Weapon Damage Base**:
   - Throws `lightningjavelin` (`#205`, `Vel = 30`, `Range = 25`, `Size = 2`, `Pierce = 1`).
   - Crucially, `lightningjavelin` (`#205`) has **`ToHit = 0`** in `Missiles.txt`: the thrown bolt **auto-hits** (bypasses Attack Rating completely, though it can still be blocked or dodged/avoided/evaded).
   - `Skills.txt` sets `SrcDam = 96` (`96/128 = 75%` of physical throwing weapon damage).
2. **100% Physical-to-Lightning Conversion (`MISSMODE_SrvDmg12` @ `0x6FC5A850`)**:
   - On hit, after physical weapon damage (`75%` base, including Critical Strike / Deadly Strike doubling!) and skill flat lightning damage (`1` to `40 + ...`, `+3%` per synergy level in LS/PS/CS/LF) are computed into `pDamage`, `MISSMODE_SrvDmg12_LightningJavelin` (`0x6FC5A850`) evaluates `DmgCalc1 = dl12` (`dParam1 = 100, dParam2 = 0` $\implies 100\%$):
     ```c
     nConverted = MONSTERUNIQUE_CalculatePercentage(pDamage->dwPhysDamage, 100, 100);
     pDamage->dwPhysDamage = 0;
     pDamage->dwLtngDamage += nConverted;
     ```
   - Thus `100%` of the javelin's physical damage is converted into Lightning damage (leaving `0` physical damage for Life/Mana Leech, but immune to Physical Immunity and completely harmless under Iron Maiden!).

### 5.4 Lightning Fury (#35) (`MISSMODE_SrvHit20` @ `0x6FC5DD60`, `MISSMODE_CltHit25` @ `0x6FB6AEF0`)
1. **Primary Javelin (`lightningfury` `#206`) — Auto-Hit & Pierce**:
   - Throws `lightningfury` (`#206`, `Vel = 30`, `Range = 25`, `Size = 2`, `Pierce = 1`, `SrcDam = 128` = `100%` physical throwing damage + skill lightning damage `1..EMax`).
   - Like `lightningjavelin`, `lightningfury` (`#206`) has **`ToHit = 0`** in `Missiles.txt`! The main thrown javelin **always hits** its target (bypassing Attack Rating), which in turn guarantees that **Pierce (`MISSMODE_PierceHandler`)** is rolled on every monster in its line of flight!
2. **Multi-Target Bolt Release (`MISSMODE_SrvHit20` @ `0x6FC5DD60` & `MISSMODE_CltHit25` @ `0x6FB6AEF0`)**:
   - Whenever `lightningfury` (`#206`) collides with a unit **or** hits a wall (`MISSMODE_SrvHit20` / `CltHit25`):
     - Evaluates search radius `aurarangecalc = par3 = 15` sub-tiles (`10.0` yards) and max bolt count `calc1 = ln12 = 2 + (slvl - 1) * 1 = 1 + slvl` (`Param1 = 2, Param2 = 1`).
     - Scans all valid enemy targets within `15` sub-tiles matching `aurafilter = 42371` (`0xA583`, requiring alive, attackable, line-of-sight units) via `sub_6FD0FE80` (server) / `0x6FB51860` (client).
     - For up to `calc1` (`1 + slvl`) monsters in that radius (excluding the monster directly hit by the javelin on that specific impact), spawns one `HitSubMissile1 = furylightning` (`#231`) bolt originating from the impact point aimed directly at each target (`0x6FC5DCE0` / `0x6FB66480`).
3. **Secondary Bolt Properties (`furylightning` `#231`) & Quadratic Pack Scaling**:
   - Each `furylightning` (`#231`) has `Vel = 30`, `Range = 25`, `Size = 2`, **`ToHit = 0`** (auto-hit!), **`SrcDamage = -1`** (carries *only* skill Lightning damage `1..EMax` with `+1%` per synergy level in CS/LB/PS/LS—does not carry weapon physical damage or item elemental damage), **`Pierce = 0`**, and **`NextDelay = 0`**.
   - **Why `Pierce = 1` + `NextDelay = 0` Scales Quadratically**: When thrown into a dense pack of $M$ monsters with $100\%$ Pierce (hitting up to $P \le 5$ monsters in a line), the javelin triggers `MISSMODE_SrvHit20` up to $P$ separate times. Each trigger releases $\min(M - 1,\; 1 + \text{slvl})$ auto-hitting `furylightning` bolts with **`NextDelay = 0`**, all of which can strike monsters along their paths without any immunity frames!
