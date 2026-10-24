# Diablo II v1.13c Amazon Bow & Crossbow Skills Mechanics (Skills #6, #7, #11, #12, #16, #21, #22, #26, #27, #31)

## 1. Dispatch Tables (`D2Client.dll` `0x6FAB0000`, `D2Game.dll` `0x6FC20000`, `D2Common.dll` `0x6FD50000`)

### 1.1 Skill Dispatch Tables
- `D2Game.dll` `g_apfnSkillSrvStFunc`: VA `0x6FD27338`
  - `g_apfnSkillSrvStFunc[4]` = `0x6FC6C840` (`SKILLS_SrvSt04_Arrow_Bolt`) — Weapon & ammo check (`decquant=1`)
  - `g_apfnSkillSrvStFunc[8]` = `0x6FC6C870` (`SKILLS_SrvSt08_Strafe`) — Strafe volley count, target acquisition & ammo check
- `D2Game.dll` `g_apfnSkillSrvDoFunc`: VA `0x6FD274A8`
  - `g_apfnSkillSrvDoFunc[1]` = `0x6FC6CA10` (`SKILLS_SrvDo001_BasicAttack`) — Default missile launch when `srvdofunc=0` and `srvmissile > 0` (`SKILLS_DoSkill` fallback)
  - `g_apfnSkillSrvDoFunc[8]` = `0x6FC6D420` (`SKILLS_SrvDo008_MultipleShot_Teeth_ShockWave`) — Perpendicular fan volley spawner
  - `g_apfnSkillSrvDoFunc[10]` = `0x6FC6D270` (`SKILLS_SrvDo010_GuidedArrow_BoneSpirit`) — Homing arrow spawner with unit/ground target encoding
  - `g_apfnSkillSrvDoFunc[12]` = `0x6FC6DCD0` (`SKILLS_SrvDo012_Strafe`) — Multi-frame rapid fire loop & animation frame rewind
- `D2Client.dll` `g_apfnSkillCltStFunc`: VA `0x6FB8E928`
  - `g_apfnSkillCltStFunc[11]` = `0x6FAC4F30` (`SKILLS_CltSt11_Arrow_Bolt`) — Client ammo/weapon verification via `0x6FB50A30`
  - `g_apfnSkillCltStFunc[13]` = `0x6FAC5500` (`SKILLS_CltSt13_Strafe`) — Client Strafe volley setup & target facing
- `D2Client.dll` `g_apfnSkillCltDoFunc`: VA `0x6FB8EA48`
  - `g_apfnSkillCltDoFunc[17]` = `0x6FAC5DA0` (`SKILLS_CltDo17_MultipleShot`) — Client perpendicular fan arrow/bolt spawner
  - `g_apfnSkillCltDoFunc[18]` = `0x6FAC5C40` (`SKILLS_CltDo18_GuidedArrow`) — Client homing arrow spawner
  - `g_apfnSkillCltDoFunc[20]` = `0x6FAC5820` (`SKILLS_CltDo20_Strafe`) — Client Strafe rapid-fire loop & sequence frame rewind

### 1.2 Missile Dispatch Tables
- `D2Game.dll` `g_apfnMissileSrvDoFunc`: VA `0x6FD2D970`
  - `g_apfnMissileSrvDoFunc[1]` = `0x6FC5F540` (`MISSMODE_SrvDo01_BasicMissile`) — Standard linear flight & collision step
  - `g_apfnMissileSrvDoFunc[5]` = `0x6FC61980` (`MISSMODE_SrvDo05_FireWall_ImmolationFire_MeteorFire_MoltenBoulderFirePath`) — Ground fire periodic AoE tick
  - `g_apfnMissileSrvDoFunc[7]` = `0x6FC61710` (`MISSMODE_SrvDo07_GuidedArrow_BoneSpirit`) — Server homing trajectory recalculation
- `D2Game.dll` `g_apfnMissileSrvHitFunc`: VA `0x6FD2DA48`
  - `g_apfnMissileSrvHitFunc[1]` = `0x6FC5B990` (`MISSMODE_SrvHit01_Fireball_ExplodingArrow_FreezingArrowExplosion`) — Radial elemental splash damage (`sHitPar1` sub-tiles)
  - `g_apfnMissileSrvHitFunc[4]` = `0x6FC5F220` (`MISSMODE_SrvHit04_ExplodingArrow_FreezingArrow_RoyalStrikeMeteorCenter`) — Spawns `HitSubMissile1` (`#656`/`#657`) at impact
  - `g_apfnMissileSrvHitFunc[9]` = `0x6FC5E0B0` (`MISSMODE_SrvHit09_ImmolationArrow`) — Spawns radial splash + circular patch of `immolationfire` (`#230`)
  - `g_apfnMissileSrvHitFunc[10]` = `0x6FC5B140` (`MISSMODE_SrvHit10_GuidedArrow_BoneSpirit`) — Homing target filtering & ground-targeted enemy acquisition
- `D2Game.dll` `g_apfnMissileSrvDmgFunc`: VA `0x6FD2DB68`
  - `g_apfnMissileSrvDmgFunc[1]` = `0x6FC59CE0` (`MISSMODE_SrvDmg01_FireArrow_MagicArrow_ColdArrow`) — Physical-to-elemental conversion (`DmgCalc1 = dl12`)
  - `g_apfnMissileSrvDmgFunc[2]` = `0x6FC59080` (`MISSMODE_SrvDmg02_IceArrow_RoyalStrikeChaos`) — Applies freeze (`DAMAGE_FREEZE`) from skill `ELen` + `ELenSymPerCalc`
  - `g_apfnMissileSrvDmgFunc[3]` = `0x6FC59670` (`MISSMODE_SrvDmg03_Blaze_FireWall_ImmolationFire_MeteorFire`) — Ground fire frame damage (`DamageRate=41`)
- `D2Client.dll` `g_apfnMissileCltDoFunc`: VA `0x6FB8D8A0`
  - `g_apfnMissileCltDoFunc[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard`) — Standard client missile step, range expiry, light & subloop
  - `g_apfnMissileCltDoFunc[5]` = `0x6FB62F90` (`MISSMODE_CltDo05_GroundFire`) — Ground fire emergence, desynchronized steady loop & fade-out
  - `g_apfnMissileCltDoFunc[7]` = `0x6FB62EB0` (`MISSMODE_CltDo07_GuidedArrow`) — Client homing trajectory recalculation every `Param1` frames
- `D2Client.dll` `g_apfnMissileCltHitFunc`: VA `0x6FB8DA10`
  - `g_apfnMissileCltHitFunc[1]` = `0x6FB6C1A0` (`MISSMODE_CltHit01_ExplodingArrow`) — Radial `fireexplosion2` (`#265`) sub-missile burst
  - `g_apfnMissileCltHitFunc[12]` = `0x6FB6B070` (`MISSMODE_CltHit12_ImmolationArrow`) — Spawns circular ground fire field (`firewall`, `firesmall`, `firemedium`)
  - `g_apfnMissileCltHitFunc[13]` = `0x6FB61350` (`MISSMODE_CltHit13_GuidedArrow`) — Client target filtering & ground-targeted re-acquisition
  - `g_apfnMissileCltHitFunc[14]` = `0x6FB60870` (`MISSMODE_CltHit14_FreezingArrow`) — Spawns center `freezingarrowexp1` (`#88`) + 8-directional `freezingarrowexp2` (`#89`)

---

## 2. `Skills.txt` & `Missiles.txt` Data Tables

### 2.1 `Skills.txt` Configuration (Skills #6, #7, #11, #12, #16, #21, #22, #26, #27, #31)

| ID | Skill | ReqLvl | `SrvSt` | `SrvDo` | `CltSt` | `CltDo` | `SrcDam` | `Mana` (`Shift`, `+lvl`) | `Delay` | `ToHit` (`+lvl`) | `EType` (`HitShift`) | `EMin` (`Lev1..5`) | `EMax` (`Lev1..5`) | Missiles (`Srv` / `Clt`) | Key Calcs & Synergies |
|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---|---|---|---:|---|---|
| 6 | **Magic Arrow** | 1 | 0 | 0 | 0 | 0 | 128 (100%) | `12<<5>>8` = 1.5 (`-0.125`/lvl, min 0) | 0 | `10` (`+9`/lvl) | `none` (`8`) | Phys `+1` (`+1`/lvl) | Phys `+1` (`+1`/lvl) | `magicarrow` (`#27`) | `noammo=1`; missile converts `1+(slvl-1)*1`% phys to magic |
| 7 | **Fire Arrow** | 1 | 4 | 0 | 11 | 0 | 128 (100%) | `24<<5>>8` = 3.0 (`+0.125`/lvl) | 0 | `10` (`+9`/lvl) | `fire` (`8`) | `1` (`2,3,6,12,24`) | `4` (`2,3,7,14,27`) | `firearrow` (`#12`) | `EDmgSymPerCalc = ExplodingArrow.blvl * 12`%; missile converts `3+(slvl-1)*2`% phys to fire |
| 11 | **Cold Arrow** | 6 | 4 | 0 | 11 | 0 | 128 (100%) | `28<<5>>8` = 3.5 (`+0.125`/lvl) | 0 | `10` (`+9`/lvl) | `cold` (`7`) | `6` (`4,5,8,16,42` → `/2`: `3` + `2,2.5,4,8,21`) | `8` (`4,5,9,17,44` → `/2`: `4` + `2,2.5,4.5,8.5,22`) | `coldarrow` (`#40`) | `ELen=100` (`+30`/lvl); `EDmgSymPerCalc = IceArrow.blvl * 12`%; missile converts `3+(slvl-1)*2`% phys to cold |
| 12 | **Multiple Shot** | 6 | 4 | 8 | 11 | 17 | 96 (75%) | `4<<8>>8` = 4 (`+1`/lvl) | 0 | — (base AR) | — (`8`) | — | — | `multipleshotarrow` (`#213`) / `multipleshotbolt` (`#214`) | `calc1 = min(24, 2 + slvl - 1)` arrows; `calc2 = 1`; `NextDelay=4` |
| 16 | **Exploding Arrow** | 12 | 4 | 0 | 11 | 0 | 128 (100%) | `10<<7>>8` = 5 (`+0.5`/lvl) | 0 | `20` (`+9`/lvl) | `fire` (`8`) | `2` (`5,7,9,12,20`) | `6` (`5,8,11,14,23`) | `explodingarrow` (`#41`) | `EDmgSymPerCalc = FireArrow.blvl * 12`%; splash `sHitPar1=5` sub-tiles (`3.3` yds) |
| 21 | **Ice Arrow** | 18 | 4 | 0 | 11 | 0 | 128 (100%) | `16<<6>>8` = 4 (`+0.25`/lvl) | 0 | `20` (`+9`/lvl) | `cold` (`8`) | `6` (`6,12,18,26,36`) | `10` (`6,13,19,27,38`) | `icearrow` (`#28`) | `ELen=50` (`+5`/lvl) freeze frames; `EDmgSym = ColdArrow.blvl * 8`%; `ELenSym = FreezingArrow.blvl * 5`% |
| 22 | **Guided Arrow** | 18 | 4 | 10 | 11 | 18 | 128 (100%) | `32<<6>>8` = 8 (`-0.25`/lvl, min 1) | 0 | — (`ToHit=0` on missile: auto-hit) | — (`8`) | — | — | `guidedarrow` (`#86`) | `calc1 = (slvl-1)*5`% ED (`Param3=0, Param4=5`); `Pierce=0` (since 1.10) |
| 26 | **Strafe** | 24 | 8 | 12 | 13 | 20 | 96 (75%) | `11<<8>>8` = 11 (`+0`/lvl) | 0 | — (base AR) | — (`8`) | — | — | `strafearrow` (`#682`) / `strafebolt` (`#683`) (clt: `#213`/`#214`) | `calc1 = min(3+slvl, 10)` max shots; `calc3 = 2 + slvl/4` min shots; `calc2 = 5*slvl`% ED; `AuraRange = 35` sub-tiles (`NextDelay=4`) |
| 27 | **Immolation Arrow** | 24 | 4 | 0 | 11 | 0 | 128 (100%) | `12<<7>>8` = 6 (`+0.5`/lvl) | 25 (1.0s) | `30` (`+9`/lvl) | `fire` (`8`) | `12` (`12,23,34,36,38`) | `23` (`12,23,34,36,38`) | `immolationarrow` (`#85`) | `EDmgSym = ExplodingArrow.blvl * 10`%; ground fire `immolationfire` (`#230`) synerged by `FireArrow.blvl * 5`% |
| 31 | **Freezing Arrow** | 30 | 4 | 0 | 11 | 0 | 128 (100%) | `18<<7>>8` = 9 (`+0.5`/lvl) | 0 | `40` (`+9`/lvl) | `cold` (`8`) | `40` (`10,15,20,22,24`) | `50` (`10,15,20,22,24`) | `freezingarrow` (`#87`) | `ELen=50` (2.0s freeze, no `+lvl`); `EDmgSym = ColdArrow.blvl * 12`%; `ELenSym = IceArrow.blvl * 5`%; splash `sHitPar1=5` |

### 2.2 `Missiles.txt` Suite for Bow & Crossbow Skills

| ID | Missile | `SrvDo` | `SrvHit` | `SrvDmg` | `CltDo` | `CltHit` | `Vel` | `Range` (`+Lev`) | `Pierce` | `AlwaysExplode` | `NextHit` / `Delay` | `CelFile` (`Dirs`, `Len`) | Sub-Missiles (`Srv` / `Clt`) |
|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|---|
| 12 | `firearrow` | 1 | 0 | 1 | 1 | 0 | 24 | 40 | 1 | 0 | 0 / 0 | `FireArrow` (32, 8) | `Exp: fireexplode` (`#29`) |
| 27 | `magicarrow` | 1 | 0 | 1 | 1 | 0 | 24 | 40 | 1 | 0 | 0 / 0 | `SafeArrow` (32, 1) | `Exp: teethexplode` (`#204`) |
| 28 | `icearrow` | 1 | 0 | 2 | 1 | 0 | 24 | 40 | 1 | 0 | 0 / 0 | `IceArrow` (32, 8) | `Exp: iceexplode` (`#30`) |
| 29 | `fireexplode` | 0 | 0 | 0 | 1 | 0 | 0 | 12 | 0 | 0 | 0 / 0 | `FireArrowExplode2` (1, 12) | Visual explosion (`Light=13`) |
| 30 | `iceexplode` | 0 | 0 | 0 | 1 | 0 | 0 | 16 | 0 | 0 | 0 / 0 | `IceArrowExplode` (1, 16) | Visual explosion (`Light=11`) |
| 40 | `coldarrow` | 1 | 0 | 1 | 1 | 0 | 24 | 20 | 1 | 0 | 0 / 0 | `IceArrow` (32, 8) | `Exp: iceexplode` (`#30`) |
| 41 | `explodingarrow` | 1 | 4 | 0 | 1 | 1 | 24 | 40 | 1 | 1 | 0 / 0 | `FireArrow` (32, 8) | `SrvHit1: explodingarrowexp2` (`#656`); `CltHit1: fireexplosion2` (`#265`); `Exp: explodingarrowexp` (`#42`) |
| 42 | `explodingarrowexp` | 0 | 0 | 0 | 1 | 0 | 0 | 16 | 0 | 0 | 0 / 0 | `ExpArrowExplode` (1, 16) | Impact visual (`Light=15`) |
| 85 | `immolationarrow` | 1 | 9 | 0 | 1 | 12 | 24 | 40 | 1 | 1 | 0 / 0 | `FireArrow` (32, 8) | `SrvHit1: immolationfire` (`#230`); `CltHit1..3: firewall` (`#69`), `firesmall` (`#104`), `firemedium` (`#105`) |
| 86 | `guidedarrow` | 7 | 10 | 0 | 7 | 13 | 24 | 128 | 0 | 1 | 0 / 0 | `SafeArrow` (32, 1) | `ToHit=0` (auto-hit); `Param1=5`, `Param2=15` |
| 87 | `freezingarrow` | 1 | 4 | 0 | 1 | 14 | 24 | 40 | 1 | 1 | 0 / 0 | `IceArrow` (32, 8) | `SrvHit1: freezingarrowexp3` (`#657`); `CltHit1: freezingarrowexp1` (`#88`), `CltHit2: freezingarrowexp2` (`#89`) |
| 88 | `freezingarrowexp1` | 1 | 0 | 0 | 1 | 0 | 0 | 16 | 0 | 0 | 0 / 0 | `FreezeExplodeCenter` (1, 15) | Center visual (`Light=11`) |
| 89 | `freezingarrowexp2` | 1 | 0 | 0 | 1 | 0 | 0 | 16 | 0 | 0 | 0 / 0 | `FreezeExplodeEjecta` (8, 15) | 8-directional ejecta visual |
| 204 | `teethexplode` | 1 | 0 | 0 | 1 | 0 | 0 | 13 | 0 | 0 | 0 / 0 | `teethexplode` (1, 13) | Magic Arrow impact visual |
| 213 | `multipleshotarrow` | 1 | 0 | 0 | 1 | 0 | 24 | 50 | 1 | 0 | 1 / 4 | `Arrow` (32, 1) | Bow missile (`SrcDamage=96`, `NextDelay=4`) |
| 214 | `multipleshotbolt` | 1 | 0 | 0 | 1 | 0 | 24 | 50 | 1 | 0 | 1 / 4 | `XBowBolt` (32, 1) | Crossbow missile (`SrcDamage=96`, `NextDelay=4`) |
| 230 | `immolationfire` | 5 | 0 | 3 | 5 | 0 | 0 | 100 | 0 | 0 | 0 / 0 | `groundFireBig` (1, 37) | `DamageRate=41`, `HitShift=2`, `EMin=7..9` (`+5`/lvl), `SubLoop=1 (12..36)` |
| 265 | `fireexplosion2` | 1 | 0 | 0 | 1 | 0 | 0 | 12 | 0 | 0 | 0 / 0 | `FireArrowExplode2` (1, 12) | Spawned radially (`cHitPar1=3, cHitPar2=1`) by `CltHitFunc=1` |
| 656 | `explodingarrowexp2` | 1 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 1 | 0 / 0 | `null` (1, 16) | Invisible server AoE carrier (`Skill=Exploding Arrow`, `sHitPar1=5`) |
| 657 | `freezingarrowexp3` | 1 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 1 | 0 / 0 | `null` (1, 16) | Invisible server AoE carrier (`Skill=Freezing Arrow`, `EType=frze`, `sHitPar1=5`) |
| 682 | `strafearrow` | 1 | 0 | 0 | 1 | 0 | 24 | 50 | 1 | 0 | 1 / 4 | `Arrow` (32, 1) | Server Strafe bow missile (`SrcDamage=96`, `NextDelay=4`) |
| 683 | `strafebolt` | 1 | 0 | 0 | 1 | 0 | 24 | 50 | 1 | 0 | 1 / 4 | `XBowBolt` (32, 1) | Server Strafe crossbow missile (`SrcDamage=96`, `NextDelay=4`) |

---

## 3. Weapon & Ammunition Validation (`SKILLS_SrvSt04_Arrow_Bolt` @ `0x6FC6C840`, `SKILLS_CltSt11_Arrow_Bolt` @ `0x6FAC4F30`)

1. **Server Start (`SKILLS_SrvSt04_Arrow_Bolt` @ `0x6FC6C840`)**:
   - Calls `D2GAME_CheckWeaponIsMissileBased_6FC6C7A0(pUnit, &nSkillLevel)` to verify the equipped weapon matches `ITYPE_MISSILE` (`bow`, `xbow`, `amabow`) or throwing weapon when applicable, and checks `SKILLS_CheckSkillDelay` (`delay=25` on Immolation Arrow).
   - For skills with `decquant=1` (all bow skills except **Magic Arrow**, which sets `noammo=1` and `srvstfunc=0` / `cltstfunc=0`, allowing firing with an empty quiver or `noammo` bow), `SKILLS_DoSkill` decrements 1 unit of ammunition (`STAT_QUANTITY`) on launch (`D2GAME_UpdateQuantity_6FC6C200`).
2. **Client Start (`SKILLS_CltSt11_Arrow_Bolt` @ `0x6FAC4F30`)**:
   - Calls `0x6FB50A30(pUnit)` (`D2Client.dll`), which verifies weapon class and non-zero ammo quantity before starting the `A1` client attack sequence.

---

## 4. Physical-to-Elemental Conversion Arrows: Magic Arrow (#6), Fire Arrow (#7), Cold Arrow (#11), Ice Arrow (#21)

### 4.1 Magic Arrow (#6), Fire Arrow (#7), Cold Arrow (#11) (`MISSMODE_SrvDmg01_FireArrow_MagicArrow_ColdArrow` @ `0x6FC59CE0`)
When `magicarrow` (`#27`), `firearrow` (`#12`), or `coldarrow` (`#40`) hits a target (`CollideType=3`, `ToHit=1`, `Pierce=1`):
1. **Standard Weapon & Skill Damage**:
   - Full weapon physical damage (`SrcDam = 128`, i.e., `128/128 = 100%`) is computed first (`MISSMODE_FillDamageStats`).
   - For **Magic Arrow (#6)**, `Skills.txt` defines flat physical damage bonus (`MinDam=1`, `MaxDam=1`, `+1` per slvl across all tiers: `+slvl` flat physical min/max damage) and Attack Rating bonus `10 + (slvl-1)*9`%.
   - For **Fire Arrow (#7)** and **Cold Arrow (#11)**, `Skills.txt` adds flat elemental damage (`EType=fire` with `HitShift=8`, or `EType=cold` with `HitShift=7`) scaled by synergy (`Exploding Arrow.blvl * 12`% or `Ice Arrow.blvl * 12`%). Note **Cold Arrow** has `HitShift=7` (`128/256 = 0.5x`), so its raw `EMin`/`EMax` values in `Skills.txt` (`6..8` at slvl 1) translate to `3..4` actual cold damage (`768..1024` in 256ths).
2. **Physical-to-Elemental Conversion (`0x6FC59CE0`)**:
   - `MISSMODE_SrvDmg01_FireArrow_MagicArrow_ColdArrow` evaluates the missile's `DmgCalc1` (`dl12`, linear formula `dParam1 + (slvl - 1) * dParam2`), clamped to `[0, 100]`:
     - **Magic Arrow (`#27`)**: `dParam1 = 1, dParam2 = 1` $\implies \text{pct} = \min(100, \text{slvl})\%$.
     - **Fire Arrow (`#12`)** & **Cold Arrow (`#40`)**: `dParam1 = 3, dParam2 = 2` $\implies \text{pct} = \min(100, 3 + 2(\text{slvl} - 1))\%$.
   - Computes `nConverted = pDamage->dwPhysDamage * pct / 100`, subtracts `nConverted` from `pDamage->dwPhysDamage`, and adds `nConverted` to:
     - `dwMagDamage` (`EType=mag` on `magicarrow`),
     - `dwFireDamage` (`EType=fire` on `firearrow`), or
     - `dwColdDamage` (`EType=cold` on `coldarrow`, also ensuring `dwColdLen > 0`).
   - Because conversion executes in `MissileSrvDmgFunc` **after** Critical Strike / Deadly Strike (`SUNITDMG_FillDamageValues`), Critical/Deadly Strike doubles `dwPhysDamage` *before* `pct%` is converted to Magic/Fire/Cold damage.

### 4.2 Ice Arrow (#21) (`MISSMODE_SrvDmg02_IceArrow_RoyalStrikeChaos` @ `0x6FC59080`)
- Fires `icearrow` (`#28`, `Pierce=1`, `SrcDam=128`). Unlike Cold Arrow, Ice Arrow does **not** convert physical damage (`EType` on `icearrow` is empty; `dParam1=100` is unused by `SrvDmgFunc=2`).
- On hit, `MISSMODE_SrvDmg02` (`0x6FC59080`) retrieves the missile's `Skill` (`Ice Arrow`, `#21`) and `slvl`, calls `SKILLS_GetElementalLength(pOwner, 21, slvl, 1)` (`ELen = 50 + (slvl-1)*5` frames = `2.0s + 0.2s/lvl`, multiplied by `1 + FreezingArrow.blvl * 0.05`), and assigns it directly to `pDamage->dwFrzLen` (complete freeze, rather than chill).

---

## 5. Multiple Shot (#12) (`SKILLS_SrvDo008` @ `0x6FC6D420`, `SKILLS_CltDo17` @ `0x6FAC5DA0`)

1. **Arrow Count & Weapon-Specific Missile Selection**:
   - Evaluates `calc1` = `min(24, ln12)` where `Param1 = 2, Param2 = 1`:
     $$\text{Count} = \min(24,\; 1 + \text{slvl})$$
   - Checks equipped weapon class via `D2Common_10076(pUnit)` (`ITEMS_GetMissileType`):
     - If Bow (`1`): selects `multipleshotarrow` (`#213`, `srvmissilea` / `cltmissilea`).
     - Otherwise (Crossbow): selects `multipleshotbolt` (`#214`, `srvmissileb` / `cltmissileb`).
2. **Perpendicular Fan Geometry (`0x6FC6D420` & `0x6FAC5DA0`)**:
   - Computes target delta $(\Delta X, \Delta Y) = (\text{targetX} - \text{casterX}, \text{targetY} - \text{casterY})$.
   - Normalizes or scales $(\Delta X, \Delta Y)$ so the aim distance is at least sufficient for angular spread, and derives the perpendicular step vector $P = (-\Delta Y', \Delta X')$ scaled by `calc2 = par3 = 1` (`0x6FB50800` / `0x6FB507C0` on client).
   - Computes initial aim point:
     $$(X_0, Y_0) = (\text{targetX}, \text{targetY}) - \left\lfloor \frac{\text{Count}}{2} \right\rfloor \cdot P$$
   - Loops `i = 0 .. Count - 1`, spawning a missile aimed at $(X_0 + i \cdot P_x,\; Y_0 + i \cdot P_y)$ (`D2GAME_InitMissileParams` / `0x6FB630F0` with flags `0x820`).
3. **Damage Scaling & `NextDelay = 4` Immunity Window**:
   - Both `multipleshotarrow` (`#213`) and `multipleshotbolt` (`#214`) have `SrcDamage = 96` (`96/128 = 75%` weapon damage), `Pierce = 1`, `NextHit = 1`, and `NextDelay = 4` (4 frames = 160ms).
   - When one arrow hits a target, `NextDelay = 4` sets the target's `STATE_NEXTDELAY` timer for 4 frames, preventing any other arrow in the same fan volley from damaging that same target.
   - **Inner 2 Arrows Triggering Restriction (`D2Game.dll`)**: Only the center 2 arrows in the fan carry full CtC (Chance-to-Cast on Striking) and special hit-effect flags; outer arrows suppress on-striking procs to prevent lag spikes.

---

## 6. Exploding Arrow (#16) & Freezing Arrow (#31) (`MISSMODE_SrvHit04` @ `0x6FC5F220`, `MISSMODE_SrvHit01` @ `0x6FC5B990`, `CltHit01` @ `0x6FB6C1A0`, `CltHit14` @ `0x6FB60870`)

### 6.1 Server Two-Stage Arrow Impact + AoE Carrier (`MISSMODE_SrvHit04` $\to$ `MISSMODE_SrvHit01`)
Both `explodingarrow` (`#41`) and `freezingarrow` (`#87`) have `SrcDamage = 128` (`100%` weapon damage), `ToHit = 1`, `Pierce = 1`, and `AlwaysExplode = 1`:
1. **Direct Arrow Hit (`CollideType=3`, `ToHit=1`)**:
   - Performs an Attack Rating check against the hit monster. If the AR roll succeeds, deals `100%` physical weapon damage + any elemental damage on gear/charms, and rolls **Pierce** (`MISSMODE_PierceHandler`).
2. **Unconditional Explosion (`AlwaysExplode = 1`, `MISSMODE_SrvHit04` @ `0x6FC5F220`)**:
   - Regardless of whether the physical arrow hit or missed (and on *each* pierced monster as well as final wall/range collision!), `AlwaysExplode = 1` invokes `MISSMODE_SrvHit04` (`0x6FC5F220`).
   - `MISSMODE_SrvHit04` spawns `HitSubMissile1` at the collision coordinates:
     - Exploding Arrow (`#41`) $\to$ spawns `explodingarrowexp2` (`#656`).
     - Freezing Arrow (`#87`) $\to$ spawns `freezingarrowexp3` (`#657`).
3. **Server Radial Elemental Splash (`MISSMODE_SrvHit01` @ `0x6FC5B990`)**:
   - `explodingarrowexp2` (`#656`) and `freezingarrowexp3` (`#657`) are 1-frame invisible carriers (`Range = 1`, `AlwaysExplode = 1`, `MissileSkill = 1`, `ResultFlags = 5`, `HitFlags = 2`) linked back to `Skill = Exploding Arrow` / `Freezing Arrow` with `sHitPar1 = 5`.
   - Upon expiring on tick 1, `MISSMODE_SrvHit01` (`0x6FC5B990`) evaluates the splash radius `sHitPar1 = 5` sub-tiles (`3.33` yards) and deals un-blockable, auto-hitting (`ToHit = 0`) elemental damage within radius `5`:
     - **Exploding Arrow (`#656`, `EType = fire`)**: Deals skill fire damage (`EMin`/`EMax` from Skill #16, `+12%` per base level of Fire Arrow) **plus all flat Fire Damage from items/charms/auras** (`HitFlags = 2` merges caster's item fire min/max damage into the splash!).
     - **Freezing Arrow (`#657`, `EType = frze`)**: Deals skill cold damage (`EMin`/`EMax` from Skill #31, `+12%` per base level of Cold Arrow) **plus all flat Cold Damage and Cold Length from items/charms** (`HitFlags = 2`), and applies **full freeze** (`EType = frze`, base `ELen = 50` frames = `2.0s` boosted by `+5%` per base level of Ice Arrow, plus item cold lengths divided by difficulty penalty).

### 6.2 Client Explosion Visuals (`CltHit01` @ `0x6FB6C1A0` & `CltHit14` @ `0x6FB60870`)
- **Exploding Arrow (`MISSMODE_CltHit01_ExplodingArrow` @ `0x6FB6C1A0`)**:
  - In addition to the engine's `ExplosionMissile = explodingarrowexp` (`#42`, `ExpArrowExplode`, `Light=15`), `CltHitFunc=1` calls `0x6FB6B210` with `wCltHitSubMissile1 = fireexplosion2` (`#265`), `cHitPar1 = 3` (count), and `cHitPar2 = 1` (radius offset), spawning 3 radial `FireArrowExplode2` (`#265`, `RandStart=5`) bursts around impact.
- **Freezing Arrow (`MISSMODE_CltHit14_FreezingArrow` @ `0x6FB60870`)**:
  - Spawns `wCltHitSubMissile1 = freezingarrowexp1` (`#88`, `FreezeExplodeCenter`, `Light=11`) at `(x, y)` via `0x6FB60450`.
  - Steps the missile LCG (`0x6AC690C5`) modulo 3 to choose one of 3 directional masks at `0x6FB83CB0`, then loops over the 8 directions (`0..7`) using offset tables `0x6FB83CEC` (X) and `0x6FB83D0C` (Y) to spawn `wCltHitSubMissile2 = freezingarrowexp2` (`#89`, `FreezeExplodeEjecta`, `NumDirections=8`) flying outward from the center.

---

## 7. Guided Arrow (#22) (`SKILLS_SrvDo010` @ `0x6FC6D270`, `MISSMODE_SrvDo07` @ `0x6FC61710`, `MISSMODE_SrvHit10` @ `0x6FC5B140`, `CltDo07` @ `0x6FB62EB0`, `CltHit13` @ `0x6FB61350`)

1. **Auto-Hit & Non-Piercing Setup**:
   - `guidedarrow` (`#86`) has `ToHit = 0` (bypasses Attack Rating check completely; still subject to Shield Block and Dodge/Avoid/Evade), `Pierce = 0` (cannot pierce since patch 1.10), `Range = 128` frames (`5.12` seconds at `Vel = 24`), and `SrcDam = 128` with `+calc1`% Enhanced Damage (`calc1 = (slvl - 1) * 5`%).
2. **Launch Target Mode Encoding (`SKILLS_SrvDo010` @ `0x6FC6D270` & `SKILLS_CltDo18` @ `0x6FAC5C40`)**:
   - Spawns `guidedarrow` (`#86`) and encodes its homing mode in the missile's path `TargetX` field (`PATH_SetTargetX` / `D2Common_10637`):
     - If cast directly on a **target unit**: sets `TargetX = 1` and binds `pTargetUnit` to the missile path (`flags = 0x20`).
     - If cast on **ground coordinates**: sets `TargetX = 2` (`flags = 0x420`) and packs `(diffY << 16) | (diffX & 0xFFFF)` into `TargetY` (`D2Common_10019`).
3. **In-Flight Homing (`MISSMODE_SrvDo07` @ `0x6FC61710` & `MISSMODE_CltDo07` @ `0x6FB62EB0`)**:
   - On each tick, checks if `TargetX & 1` (unit-locked mode).
   - Every `Param1 = 5` frames (`nCurrentFrame % 5 == 0`), if the missile's distance to its locked `pTargetUnit` satisfies `3 < distance < 25` sub-tiles (`0x19`), calls `D2Common_10334` (`PATH_RecalcMissilePath`) to re-steer the arrow toward the target's updated position.
   - Then executes standard linear step (`MISSMODE_SrvDo01` / `0x6FB617C0`).
4. **Target Filtering & Ground Re-Acquisition (`MISSMODE_SrvHit10` @ `0x6FC5B140` & `MISSMODE_CltHit13` @ `0x6FB61350`)**:
   - **Unit-locked (`TargetX & 1`)**: If the arrow collides with a unit `pHitUnit`:
     - If `pHitUnit == pLockedTarget` (or no locked target remains), returns `1` (applies hit damage and terminates).
     - If `pHitUnit != pLockedTarget`, returns `0` (**passes cleanly through non-target units** on the way to its locked target!).
   - **Ground-targeted (`TargetX & 2`)**: When the arrow reaches its ground destination (`nCurrentFrame <= 0` of initial leg) without hitting anything, `0x6FC5B060` (server) / `0x6FB61270` (client) searches within radius `Param2 = 15` sub-tiles (`10` yards) for a valid enemy target:
     - If an enemy is found, switches `TargetX = 1`, locks onto that enemy, resets the path (`D2Common_10334`), and continues flying!
     - If no enemy is within 15 sub-tiles, projects another ground leg along the stored `(diffX, diffY)` vector in `TargetY` until the 128-frame `Range` expires.

---

## 8. Strafe (#26) (`SKILLS_SrvSt08` @ `0x6FC6C870`, `SKILLS_SrvDo012` @ `0x6FC6DCD0`, `CltSt13` @ `0x6FAC5500`, `CltDo20` @ `0x6FAC5820`)

1. **Volley Count & Target Count Calculation (`SKILLS_SrvSt08_Strafe` @ `0x6FC6C870`, `SKILLS_CltSt13_Strafe` @ `0x6FAC5500`)**:
   - Verifies missile weapon and remaining ammo (`0x6FB50A30` on client; `D2GAME_CheckWeaponIsMissileBased` on server).
   - Evaluates:
     - Minimum arrows: `calc3 = 2 + slvl / 4`
     - Maximum arrows: `calc1 = min(4 + slvl - 1, 10) = min(3 + slvl, 10)`
     - Search radius: `AuraRangeCalc = par5 = 35` sub-tiles (`23.3` yards)
   - Counts valid enemy targets `N` within `35` sub-tiles (`filter = 0xA783`).
   - Clamps total volley count:
     $$\text{Shots} = \text{clamp}(N,\; \text{calc3},\; \text{calc1}) = \max\!\left(2 + \left\lfloor\frac{\text{slvl}}{4}\right\rfloor,\; \min(N,\; \min(3 + \text{slvl},\; 10))\right)$$
   - Also caps `Shots` at the player's remaining quiver quantity (`STAT_QUANTITY`).
   - Stores `SkillParam1 = Shots`, `SkillParam2 = TargetType`, `SkillParam3 = TargetGUID`, and rotates the Amazon to face the first target.
2. **Rapid-Fire Loop & Animation Frame Rewind (`SKILLS_SrvDo012_Strafe` @ `0x6FC6DCD0`, `SKILLS_CltDo20_Strafe` @ `0x6FAC5820`)**:
   - On each trigger frame of the `A1` attack animation:
     - Reads remaining `Shots` (`SkillParam1`, `D2Common_10980`).
     - Selects `strafearrow` (`#682`, server) / `multipleshotarrow` (`#213`, client) for Bows, or `strafebolt` (`#683` / `#214`) for Crossbows (`SrcDamage = 96` = `75%` weapon damage, `+calc2 = 5 * slvl`% skill ED, `Pierce = 1`, `NextDelay = 4` frames).
     - Validates the current target or acquires the next enemy within `35` sub-tiles (cycling through nearby targets before repeating on a single monster), fires 1 missile (`flags = 0x21`), and decrements `SkillParam1` (and consumes 1 ammo on the first/server shot per `SKILLS_SrvDo012`).
     - **If `SkillParam1 > 0`**: Acquires the next target within `35` sub-tiles, faces it, and **rewinds the unit's animation frame** back to the mid-draw release loop point (`0x6FAB2E90` $\to$ `0x6FB505F0` on client; `D2COMMON_10446_SetUnitFrame` on server) so the Amazon fires consecutive arrows rapidly without restarting the full `A1` wind-up!
     - **If `SkillParam1 == 0`**: Allows the `A1` animation to finish its follow-through frames normally.

---

## 9. Immolation Arrow (#27) (`MISSMODE_SrvHit09` @ `0x6FC5E0B0`, `MISSMODE_SrvDo05` @ `0x6FC61980`, `MISSMODE_SrvDmg03` @ `0x6FC59670`, `CltHit12` @ `0x6FB6B070`)

1. **Casting Delay & Arrow Flight**:
   - Has `delay = 25` frames (`1.0` second global casting delay), `SrcDam = 128` (`100%` physical weapon damage), `ToHit = 30 + (slvl-1)*9`% AR bonus, `Pierce = 1`, and `AlwaysExplode = 1`.
2. **Server Explosion & Ground Fire Patch (`MISSMODE_SrvHit09_ImmolationArrow` @ `0x6FC5E0B0`)**:
   - On impact (`AlwaysExplode = 1`), `MISSMODE_SrvHit09` performs two actions:
     1. **Immediate Radial Fire Splash**: Deals skill fire damage (`EMin`/`EMax` from Skill #27, `+10%` per base level of Exploding Arrow) + caster's item flat fire damage (`HitFlags = 2`) within radius `Param1 = 3` sub-tiles (`2.0` yards).
     2. **Circular `immolationfire` (`#230`) Field**: Uses `D2GAME_CreateCircularMissiles` (`0x6FC5DE90`) with radius `calc1 = par1 = 3` sub-tiles to spawn `HitSubMissile1 = immolationfire` (`#230`) patches across the `3`-sub-tile radius circle.
3. **Ground Fire Tick Damage (`immolationfire` `#230`, `SrvDo05` @ `0x6FC61980`, `SrvDmg03` @ `0x6FC59670`)**:
   - `immolationfire` (`#230`) lasts `Range = 100` frames (`4.0` seconds; wait: `Missiles.txt` `Range = 100`, though `Skills.txt` `Param2 = 4` / `calc2 = 4` is 3-second tooltip vs `Range = 100` frames = 4.0s or overridden to `75` frames if `sHitPar2` is non-zero; since `sHitPar2 = 0` on `immolationarrow`, `immolationfire` uses its `Missiles.txt` `Range = 100` frames = `4.0` seconds).
   - Has `HitShift = 2` (`4/256` per tick), `EMin = 7, EMax = 9` (`+5` per slvl across all tiers), `EDmgSymPerCalc = skill('Fire Arrow'.blvl) * 5`%, and `DamageRate = 41` (scales per-frame fire damage via `1024 / (DamageRate + 1)` in `SrvDmg03` @ `0x6FC59670`).
4. **Client Ground Fire Patch (`MISSMODE_CltHit12_ImmolationArrow` @ `0x6FB6B070` & `MISSMODE_CltDo05_GroundFire` @ `0x6FB62F90`)**:
   - `CltHit12` collects the 3 `wCltHitSubMissile` IDs on `immolationarrow` (`#85`): `firewall` (`#69`), `firesmall` (`#104`), and `firemedium` (`#105`), evaluates radius `calc1 = 3` sub-tiles and duration (`Range = 90 + slvl * 25` or `100` frames), and calls `0x6FB69740` to populate the circular fire patch.
   - Each ground fire uses `CltDoFunc = 5` (`0x6FB62F90`): plays emergence frames `0..11`, jumps to a randomized steady-burn frame `11 + rand(0..23)` (`SubStart=12..SubStop=36`) so patches flicker out of phase, and reverses through frames `11..0` during its final 12 ticks before expiring.
