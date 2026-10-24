# Diablo II v1.13c Sorceress Cold Spells — Server & Client Reverse-Engineering Reference

> **Ground Truth**: `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`), `D2Client.dll` v1.13c (`ImageBase = 0x6FAB0000`), `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`), and official v1.13c MPQ data tables (`Skills.txt`, `Missiles.txt`, `States.txt`, `Overlay.txt`, `DifficultyLevels.txt`).

---

## 1. Dispatch Tables (`D2Client.dll` & `D2Game.dll` v1.13c)

### 1.1 `D2Game.dll` (`ImageBase = 0x6FC20000`)

| Dispatch Table | Table VA | Index | Function VA | Symbol / Role | Used By (Cold Tree) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `—` | `—` | *(No custom `srvstfunc` in Cold tree)* | — |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | *(default)* | *(inline)* | `D2GAME_SKILLS_Handler` (`wSrvMissile` linear spawn) | Ice Bolt (#39), Ice Blast (#45), Glacial Spike (#55), Frozen Orb (#64) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `18` | `0x6FC628F0` | `SKILLS_SrvDo018_DefensiveBuff` | Frozen Armor (#40), Shiver Armor (#50), Chilling Armor (#60) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `22` | `0x6FC63AA0` | `SKILLS_SrvDo022_NovaAttack` | Frost Nova (#44) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `28` | `0x6FC62D90` | `SKILLS_SrvDo028_Meteor_Blizzard_...` | Blizzard (#59) |
| *(AuraEventCallback)* | *(event 0)* | `1` | *(SkillSor)* | `SKILLS_EventFunc01_ChillingArmor` (`UNITEVENT_HITBYMISSILE`) | Chilling Armor (#60) |
| *(AuraEventCallback)* | *(event 1)* | `2` | *(SkillSor)* | `SKILLS_EventFunc02_FrozenArmor` (`UNITEVENT_DAMAGEDINMELEE`) | Frozen Armor (#40) |
| *(AuraEventCallback)* | *(event 9)* | `3` | *(SkillSor)* | `SKILLS_EventFunc03_ShiverArmor` (`UNITEVENT_ATTACKEDINMELEE`) | Shiver Armor (#50) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `icebolt` (#59), `iceblast` (#91), `glacialspike` (#96), `frostnova` (#119), `frozenorbbolt` (#261), `chillingarmorbolt` (#264) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `3` | `0x6FC61AE0` | `MISSMODE_SrvDo03_PoisonCloud_Blizzard_ThunderStorm_...` | `blizzard1..4` (#159–162) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `10` | `0x6FC613D0` | `MISSMODE_SrvDo10_BlizzardCenter` | `blizzardcenter` (#158) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `15` | `0x6FC60CA0` | `MISSMODE_SrvDo15_FrozenOrb` | `frozenorb` (#260) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `16` | `0x6FC60BD0` | `MISSMODE_SrvDo16_FrozenOrbNova` | `frozenorbnova` (#262) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `13` | `0x6FC5B3E0` | `MISSMODE_SrvHit13_GlacialSpike_HellMeteorDown` | `glacialspike` (#96) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `29` | `0x6FC5C850` | `MISSMODE_SrvHit29_FrozenOrb` | `frozenorb` (#260) |
| `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | `4` | `0x6FC58E70` | `MISSMODE_SrvDmg04_IceBlast` | `iceblast` (#91) |

### 1.2 `D2Client.dll` (`ImageBase = 0x6FAB0000`)

| Dispatch Table | Table VA | Index | Function VA | Role / Behavior | Used By (Cold Tree) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `—` | `—` | *(No custom `cltstfunc` in Cold tree)* | — |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | *(default)* | *(inline)* | Standard `wCltMissile` linear spawn | Ice Bolt (#39), Ice Blast (#45), Glacial Spike (#55) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `25` | `0x6FB23CB0` | 64-missile radial ring spawner (`0x6FB51020`) | Frost Nova (#44) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `28` | `0x6FB23DF0` | Target-point ground anchor (`blizzardcenter` #158) spawn | Blizzard (#59) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `29` | `0x6FB23D70` | Sets unit flag `0x40` + spawns client `frozenorb` (#260) | Frozen Orb (#64) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `87` | `0x6FB24BE0` | Active state tick (`States.txt` `cltactivefunc = 87`): spawns ambient `sparkle` (#212) every `10` frames | Shiver Armor (#50) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | Standard client frame advance & step | `icebolt` (#59), `iceblast` (#91), `glacialspike` (#96), `frostnova` (#119), `blizzard1..4` (#159–162), `frozenorbbolt` (#261), `chillingarmorbolt` (#264), explosions |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `13` | `0x6FB6BC10` | Periodic random shard (`blizzard1..4`) spawn + 3D sky descent (`0x6FB62E00`) | `blizzardcenter` (#158) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `19` | `0x6FB68840` | Spiral `frozenorbbolt` (#261) emitter (`+19 mod 64` step per tick) | `frozenorb` (#260) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `20` | `0x6FB629B0` | Pinwheel $45^\circ$ path curvature during first `6` ticks (`step = 2`) | `frozenorbnova` (#262) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `10` | `0x6FB62570` | Applies `ProgOverlay` (`ice_explode`) to struck target | `frostnova` (#119) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `14` | `0x6FB60870` | Spawns central `freezingarrowexp1` + `rand % 3` pattern of `freezingarrowexp2` shards | `glacialspike` (#96) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `19` | `0x6FB61080` | Spawns random shard impact explosion in `[blizzardexplode1..3]` | `blizzard1..4` (#159–162) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `30` | `0x6FB66010` | Final 16-bolt `frozenorbnova` (#262) burst (`step = cHitPar1 = 4`) | `frozenorb` (#260) |

---

## 2. `Skills.txt` Ground-Truth Summary (Cold Spells #39, #40, #44, #45, #50, #55, #59, #60, #64, #65)

| ID | Skill | ReqLvl | `srvdo` / `cltdo` | Server Missiles | Client Missiles | Delay (f) | Mana (`mana` / `lvl` / `shift` / `min`) | `HitShift` | Base Elemental Damage (`EMin`–`EMax`, Tier 1–5) & Base Cold/Freeze Length | Synergy (`EDmgSymPerCalc` / `ELenSymPerCalc`) |
| :-: | :--- | :-: | :-: | :--- | :--- | :-: | :--- | :-: | :--- | :--- |
| `39` | **Ice Bolt** | 1 | `—` / `—` | `icebolt` (#59) | `icebolt` (#59) | 0 | `3` / `+0` / `8` / `1` | `7` ($\times \frac{128}{256}$) | `6–10` (`+2/+4/+6/+8/+10` min, `+3/+5/+7/+9/+11` max); Chill `150 + 35*(slvl-1)`f | `(Frost Nova + Ice Blast + Glacial Spike + Blizzard + Frozen Orb).blvl * 15`% |
| `40` | **Frozen Armor** | 1 | `18` / `—` | `—` | `—` | 0 | `7` / `+0` / `8` / `1` | `8` | Defense `+30 + 5*(slvl-1)`%; Melee hit freezes attacker for `(30 + 3*(slvl-1))`f | Duration: `+(Shiver + Chilling).blvl * 250`f; Freeze len: `+(Shiver + Chilling).blvl * 5`% |
| `44` | **Frost Nova** | 6 | `22` / `25` | `frostnova` (#119) | `frostnova` (#119) | 0 | `9` / `+1` / `8` / `1` | `7` ($\times \frac{128}{256}$) | `4–8` (`+4/+6/+8/+10/+12` min, `+5/+7/+9/+11/+13` max); Chill `200 + 25*(slvl-1)`f | `(Blizzard.blvl + Frozen Orb.blvl) * 10`% |
| `45` | **Ice Blast** | 6 | `—` / `—` | `iceblast` (#91) | `iceblast` (#91) | 0 | `12` / `+1` / `7` / `1` | `7` ($\times \frac{128}{256}$) | `16–24` (`+14/+28/+42/+56/+70` min, `+15/+29/+43/+57/+71` max); **Freeze** `75 + 5*(slvl-1)`f | Dmg: `(Ice Bolt + Blizzard + Frozen Orb).blvl * 8`%; Freeze len: `+Glacial Spike.blvl * 10`% |
| `50` | **Shiver Armor** | 12 | `18` / *(act 87)* | `—` | `sparkle` (#212) | 0 | `11` / `+0` / `8` / `1` | `7` ($\times \frac{128}{256}$) | Defense `+45 + 6*(slvl-1)`%; Dmg `12–16` (`+4/+6/+8/+10/+12` min, `+5/+7/+9/+11/+13` max); Chill `100`f (`+0/+25/+50`) | Dmg: `(Frozen + Chilling).blvl * 9`%; Duration: `+(Frozen + Chilling).blvl * 250`f |
| `55` | **Glacial Spike** | 18 | `—` / `—` | `glacialspike` (#96) | `glacialspike` (#96) | 0 | `20` / `+1` / `7` / `1` | `7` ($\times \frac{128}{256}$) | `32–48` (`+14/+26/+28/+30/+32` min, `+15/+27/+29/+31/+33` max); **Freeze** `50 + 3*(slvl-1)`f (`r=4` subtiles) | Dmg: `(Ice Bolt + Ice Blast + Frozen Orb).blvl * 5`%; Freeze len: `+Blizzard.blvl * 3`% |
| `59` | **Blizzard** | 24 | `28` / `28` | `blizzardcenter` (#158) | `blizzardcenter` (#158) | 45 (1.8s) | `23` / `+1` / `8` / `1` | `8` ($\times \frac{256}{256}$) | `45–75` (`+15/+30/+45/+55/+65` min, `+16/+31/+46/+56/+66` max); Chill `100`f (fixed 4.0s) | `(Ice Bolt + Ice Blast + Glacial Spike).blvl * 5`% |
| `60` | **Chilling Armor** | 24 | `18` / `—` | `chillingarmorbolt` (#264) | `chillingarmorbolt` (#264) | 0 | `17` / `+0` / `8` / `1` | `7` ($\times \frac{128}{256}$) | Defense `+45 + 5*(slvl-1)`%; Bolt `8–12` (`+2/+4/+6/+8/+10` min, `+3/+5/+7/+9/+11` max); Chill `100`f (`+0/+25/+25`) | Dmg: `(Frozen + Shiver).blvl * 7`%; Duration: `+(Frozen + Shiver).blvl * 250`f |
| `64` | **Frozen Orb** | 30 | `—` / `29` | `frozenorb` (#260) | `frozenorb` (#260) | 25 (1.0s) | `50` / `+1` / `7` / `1` | `7` ($\times \frac{128}{256}$) | `80–90` (`+20/+24/+28/+29/+30` min, `+21/+25/+29/+30/+31` max); Chill `200 + 25*(slvl-1)`f | `Ice Bolt.blvl * 2`% |
| `65` | **Cold Mastery** | 30 | *(passive)* | `—` | `—` | 0 | `0` | `8` | *(Passive: `passive_cold_pierce = 20 + 5*(slvl-1)`% `-Enemy Cold Resist`)* | `—` |

> **Difficulty Cold & Freeze Duration Penalties (`DifficultyLevels.txt`)**:
> All cold chill (`dwColdLen`) and freeze (`dwFrzLen`) durations are scaled in Expansion Nightmare ($\times \frac{1}{2}$) and Hell ($\times \frac{1}{4}$), and multiplied by target `chillEffectiveness` in `MonStats.txt` (where `chillEffectiveness <= 0` prevents freezing/chilling altogether).

---

## 3. `Missiles.txt` Ground-Truth Summary (Cold Tree Missiles & Sub-Missiles)

| ID | Missile Name | `pSrvDo` | `pSrvHit` | `pSrvDmg` | `pCltDo` | `pCltHit` | `Vel` / `MaxVel` | `Range` | `Size` | `CollideType` | `SubMissile1` / `HitSubMissile1` | `CltSubMissile1..2` / `CltHitSubMissile1..2` | Key Parameters & Flags |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- | :--- | :--- |
| `30` | `iceexplode` | `—` | `—` | `—` | `1` | `—` | `0` | `16` | `1` | `0` | `—` | `—` | `Explosion=1`, `CelFile=IceArrowExplode` |
| `59` | `icebolt` | `1` | `—` | `—` | `1` | `—` | `12` / `12` | `50` | `1` | `3` | `—` / `—` | `ExplosionMissile=iceexplode` (#30) | `Skill=Ice Bolt`, `CollideKill=1`, `LastCollide=1`, `ClientCol=1` |
| `88` | `freezingarrowexp1` | `1` | `—` | `—` | `1` | `—` | `0` | `16` | `1` | `0` | `—` | `—` | `Explosion=1`, `CelFile=FreezeExplodeCenter` |
| `89` | `freezingarrowexp2` | `1` | `—` | `—` | `1` | `—` | `0` | `16` | `1` | `0` | `—` | `—` | `Explosion=1`, `NumDirections=8`, `CelFile=FreezeExplodeEjecta` |
| `91` | `iceblast` | `1` | `—` | `4` | `1` | `—` | `12` / `12` | `50` | `1` | `3` | `—` / `—` | `ExplosionMissile=freezingarrowexp1` (#88) | `Skill=Ice Blast`, `pSrvDmgFunc=4` (chill $\to$ freeze), `CollideKill=1`, `LastCollide=1` |
| `96` | `glacialspike` | `1` | `13` | `—` | `1` | `14` | `16` / `16` | `40` | `1` | `3` | `—` / `—` | `CltHitSub1=freezingarrowexp1` (#88), `2=freezingarrowexp2` (#89) | `Skill=Glacial Spike`, `EType=frze`, `ResultFlags=5`, `HitFlags=2`, `CollideKill=1` |
| `119` | `frostnova` | `1` | `—` | `—` | `1` | `10` | `24` / `24` (`Accel=-1000`) | `14` | `1` | `3` | `—` / `—` | `—` | `Skill=Frost Nova`, `NextHit=1`, `NextDelay=4`, `LastCollide=1`, `ProgOverlay=ice_explode` |
| `158` | `blizzardcenter` | `10` | `—` | `—` | `13` | `—` | `0` | `100` | `1` | `0` | `blizzard1` (#159) / `—` | `CltSub1=blizzard1` (#159), `2=blizzard4` (#162) | `CelFile=null`, `ClientSend=1`, `LastCollide=1` |
| `159–162` | `blizzard1..4` | `3` | `—` | `—` | `1` | `19` | `0` | `9` | `2` | `3` | `—` / `—` | `CltHitSub1=blizzardexplode1` (#163), `2=blizzardexplode3` (#165) | `Skill=Blizzard`, `AlwaysExplode=1`, `CltParam1=120` (fall Z), `CltParam2=5` (fall rate) |
| `163–165` | `blizzardexplode1..3` | `1` | `—` | `—` | `1` | `—` | `0` | `6` | `1` | `0` | `—` | `—` | `Explosion=1`, `CelFile=BlizzExplode1..3` |
| `212` | `sparkle` | `1` | `—` | `—` | `1` | `—` | `4` / `4` | `30` | `1` | `3` | `—` | `—` | Client Shiver Armor ambient particle (`CelFile=Gleam`) |
| `260` | `frozenorb` | `15` | `29` | `—` | `19` | `30` | `10` / `10` | `30` | `1` | `3` | `frozenorbbolt` (#261) / `frozenorbnova` (#262) | `CltSub1=frozenorbbolt` (#261), `CltHitSub1=frozenorbnova` (#262), `Explosion=frozenorbexplode` (#263) | `CollideKill=0` (pierces!), `AlwaysExplode=1`, `Param1=1`, `Param2=19`, `sHitPar1=4`, `cHitPar1=4` |
| `261` | `frozenorbbolt` | `1` | `—` | `—` | `1` | `—` | `18` / `18` | `25` | `1` | `3` | `—` | `ExplosionMissile=iceexplode` (#30) | `Skill=Frozen Orb`, `CollideKill=1`, `LastCollide=1`, `NumDirections=16` |
| `262` | `frozenorbnova` | `16` | `—` | `—` | `20` | `—` | `24` / `24` | `25` | `1` | `3` | `—` | `ExplosionMissile=iceexplode` (#30) | `Skill=Frozen Orb`, `Param1=6`, `Param2=2`, `CltParam1=6`, `CltParam2=2`, `CollideKill=1` |
| `263` | `frozenorbexplode` | `1` | `—` | `—` | `1` | `—` | `0` | `16` | `1` | `0` | `—` | `—` | `Explosion=1`, `CelFile=IceOrbExplode` |
| `264` | `chillingarmorbolt` | `1` | `—` | `—` | `1` | `—` | `18` / `18` | `25` | `1` | `3` | `—` | `ExplosionMissile=iceexplode` (#30) | `Skill=Chilling Armor`, **`ReturnFire=0`** (prevents infinite ping-pong loops!), `CollideKill=1` |

---

## 4. Per-Skill Server & Client Mechanics

### 4.1 Ice Bolt (Skill #39)

- **Server Dispatch (`srvdofunc = ""`, `srvmissile = "icebolt"` #59)**:
  - Default linear projectile spawn (`sub_6FD11420`) of `icebolt` (#59): `Vel = 12`, `Range = 50` frames, `Size = 1`, `CollideType = 3`, `CollideKill = 1`, `LastCollide = 1`.
  - **Impact (`MISSMODE_SrvDmgHitHandler`)**: Rolls cold damage (`HitShift = 7`, i.e., $\times 0.5$ of 256ths scale, 5-skill synergy `(Frost Nova + Ice Blast + Glacial Spike + Blizzard + Frozen Orb).blvl * 15`%) and chill duration (`ELen = 150 + 35*(slvl-1)` frames), sets `ResultFlags = 4` (`GETHIT`), and destroys the bolt.
- **Client Dispatch (`cltdofunc = ""`, `cltmissile = "icebolt"` #59)**:
  - Default linear client missile (`MissileCltDoFunc[1] @ 0x6FB617C0`). On client collision (`ClientCol = 1`), spawns `ExplosionMissile = "iceexplode"` (#30, `IceArrowExplode`, `Range = 16`).

---

### 4.2 Cold Armors: Frozen Armor (#40), Shiver Armor (#50), Chilling Armor (#60)

All three Sorceress Cold Armors share the same cast function **`SKILLS_SrvDo018_DefensiveBuff @ 0x6FC628F0`** and belong to `States.txt` **`group = 1`** (`STATE_FROZENARMOR` #10, `STATE_CHILLINGARMOR` #20, `STATE_SHIVERARMOR` #88), making them **mutually exclusive**.

#### Shared Cast Logic (`SKILLS_SrvDo018_DefensiveBuff @ 0x6FC628F0`)
1. Calls `sub_6FD11C90(pUnit, nAuraState, 1)` to strip any previously active state belonging to `States.txt` `group = 1` (so casting Shiver Armor removes Frozen Armor or Chilling Armor).
2. Evaluates buff duration from `auralencalc = "ln34 + (other1.blvl + other2.blvl) * par7"`:
   - **Frozen Armor (#40)** & **Shiver Armor (#50)**:
     $$\text{Duration}_{\text{frames}} = 3000 + 300 \times (\text{slvl} - 1) + 250 \times (\text{OtherArmors.blvl}) \quad (120\text{s} + 12\text{s/lvl} + 10\text{s/synergy blvl})$$
   - **Chilling Armor (#60)**:
     $$\text{Duration}_{\text{frames}} = 3600 + 150 \times (\text{slvl} - 1) + 250 \times (\text{OtherArmors.blvl}) \quad (144\text{s} + 6\text{s/lvl} + 10\text{s/synergy blvl})$$
3. Creates a self-targeted `D2StatListStrc` for `nAuraState`, attaches `aurastat1 = "skill_armor_percent"` (`ln12` Defense bonus), toggles `nAuraState` GfxState on, and registers `wAuraEvent[0]` $\to$ `wAuraEventFunc[0]`.

#### Reactive Event 1: Frozen Armor (#40) — `SKILLS_EventFunc02_FrozenArmor` (`UNITEVENT_DAMAGEDINMELEE`)
- **Trigger Condition**: Fires on `auraevent1 = "damagedinmelee"` (`UNITEVENT_DAMAGEDINMELEE`), **only after** a melee attack (`pUnit` is player/monster) successfully hits the Sorceress and deals `pDamage->dwPhysDamage > 0` (`!(pDamage->wResultFlags & DAMAGERESULTFLAG_SUCCESSFULHIT)` or `dwPhysDamage <= 0` returns `0`).
- **Effect**:
  - Deals **zero damage**.
  - Evaluates freeze duration from `calc1 = "ln56 * (100 + (Shiver.blvl + Chilling.blvl) * 5) / 100"` (`Param5 = 30`, `Param6 = 3`, `Param8 = 5`):
    $$\text{FreezeFrames} = \left\lfloor\frac{(30 + 3 \times (\text{slvl} - 1)) \times (100 + 5 \times (\text{Shiver.blvl} + \text{Chilling.blvl}))}{100}\right\rfloor$$
  - Populates `damage.wResultFlags |= 0x20`, `damage.dwFrzLen = FreezeFrames`, calls `SUNITDMG_ExecuteEvents(pGame, pSorceress, pAttacker, 1, &damage)` to freeze the melee attacker, and attaches `cltoverlaya = "frozenarmor_hit"` (`UNITS_SetOverlay`) to the attacker.

#### Reactive Event 2: Shiver Armor (#50) — `SKILLS_EventFunc03_ShiverArmor` (`UNITEVENT_ATTACKEDINMELEE`)
- **Trigger Condition**: Fires on `auraevent1 = "attackedinmelee"` (`UNITEVENT_ATTACKEDINMELEE`) **as soon as a melee attack is swung at the Sorceress—even if the melee attack misses or is blocked!**
- **Server Effect**:
  - Rolls Skill #50 cold damage (`HitShift = 7`, `EMin = 12..`, `EMax = 16..`, `(Frozen.blvl + Chilling.blvl) * 9`% synergy) and chill length (`ELen = 100` frames at slvl 1–8, `+25/lvl` at 9–16, `+50/lvl` at 17+) via `D2GAME_RollElementalDamage_6FD14DD0`.
  - Sets `nHitClassActiveSet = 1`, `dwHitClass |= 0xD`, `wResultFlags = 0x4021` (`16417` = `SUCCESSFULHIT | 0x20 | SOFTHIT`), executes `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage` against the melee attacker, and attaches `cltoverlaya = "shiverarmor_hit"`.
- **Client Active State Visual (`States.txt` `shiverarmor` #88: `cltactivefunc = 87` $\to$ `SkillCltDoFunc[87] @ 0x6FB24BE0`)**:
  - Invoked every client frame while `STATE_SHIVERARMOR` (#88) is active on a unit.
  - Increments a per-state tick counter (`D2Common#10150` / `D2Common#11157` on the unit's StatList).
  - Evaluates period `cltcalc1 = 10` frames (`[edi+0x148]`), horizontal radius `cltcalc2 = 5` (`[edi+0x14c]`), and vertical Z-range `cltcalc3 = 3` (`[edi+0x150]`).
  - Every `10` frames (`counter % 10 == 0`), calls `0x6FB69A80` to spawn an ambient `cltmissilea = "sparkle"` (#212, `CelFile = "Gleam"`, `Vel = 4`, `Range = 30`) drifting around the Sorceress.

#### Reactive Event 3: Chilling Armor (#60) — `SKILLS_EventFunc01_ChillingArmor` (`UNITEVENT_HITBYMISSILE`)
- **Trigger Condition**: Fires on `auraevent1 = "hitbymissile"` (`UNITEVENT_HITBYMISSILE`) when the Sorceress is struck by a missile `pUnit` (`pUnit->dwUnitType == UNIT_MISSILE`).
- **Infinite-Loop Guard (`ReturnFire` Flag)**:
  - Checks `pMissilesTxtRecord->dwMissileFlags & gdwBitMasks[MISSILESFLAGINDEX_RETURNFIRE]` (`ReturnFire = 1` in `Missiles.txt`).
  - Crucially, `chillingarmorbolt` (#264) itself has **`ReturnFire = 0`** in `Missiles.txt`! If two Sorceresses with Chilling Armor hit each other, the retaliation bolt (`ReturnFire = 0`) will **not** trigger a second retaliation bolt, preventing an infinite server crash loop.
- **Effect**:
  - Resolves the missile's owner (`pOwner = SUNIT_GetOwner(pGame, pUnit)`).
  - Spawns `wSrvMissileA = "chillingarmorbolt"` (#264, `Vel = 18`, `Range = 25`, `CollideKill = 1`) from the Sorceress aimed at `pOwner` (`sub_6FD11420`) and attaches `cltoverlaya = "chillarmor_hit"` to the Sorceress.

---

### 4.3 Frost Nova (Skill #44)

Frost Nova emits an expanding ring of **64** `frostnova` (#119) cold projectiles around the caster, sharing the exact same radial ring architecture as **Nova** (#48).

- **Server Do (`SKILLS_SrvDo022_NovaAttack @ 0x6FC63AA0`)**:
  - Calls `sub_6FD14170` to spawn **64** `frostnova` (#119) missiles radially around `pUnit` (`Vel = 24`, `MaxVel = 24`, `Accel = -1000`, `Range = 14` frames = $0.56\text{s}$).
  - Each `frostnova` (#119) has `CollideType = 3`, `CollideKill = 0` (pierces), `LastCollide = 1`, **`NextHit = 1`, `NextDelay = 4`** (4-frame `STATE_JUSTHIT` lock ensures each enemy takes at most 1 hit per cast).
  - Rolls Skill #44 cold damage (`HitShift = 7`, `(Blizzard.blvl + Frozen Orb.blvl) * 10`% synergy) and chill duration (`ELen = 200 + 25*(slvl-1)` frames = $8\text{s} + 1\text{s/lvl}$ base).
- **Client Do & Hit (`SkillCltDoFunc[25] @ 0x6FB23CB0`, `MissileCltHitFunc[10] @ 0x6FB62570`)**:
  - `SkillCltDoFunc[25] @ 0x6FB23CB0` calls `0x6FB51020` to spawn the 64-direction client `frostnova` (#119) ring.
  - On hit, `MissileCltHitFunc[10] @ 0x6FB62570` attaches `ProgOverlay = "ice_explode"` (`0x6FB1B300`) to each struck client unit.

---

### 4.4 Ice Blast (Skill #45)

Ice Blast fires a single-target projectile (`iceblast` #91) whose custom damage handler converts its entire cold chill length into hard **Freeze** duration.

- **Server Dispatch (`srvdofunc = ""`, `srvmissile = "iceblast"` #91)**:
  - Default linear spawn (`sub_6FD11420`) of `iceblast` (#91): `Vel = 12`, `Range = 50`, `Size = 1`, `CollideType = 3`, `CollideKill = 1`, `LastCollide = 1`.
- **Server Chill-to-Freeze Conversion (`MISSMODE_SrvDmg04_IceBlast @ 0x6FC58E70`)**:
  - Note that in `Skills.txt`, Skill #45 has `EType = "cold"` (not `"frze"`), so `MISSMODE_FillDamageParams` initially computes the cold duration (`ELen = 75 + 5*(slvl-1)` frames boosted by `ELenSymPerCalc = "skill('Glacial Spike'.blvl) * 10"`%) into `pDamage->dwColdLen`.
  - When `iceblast` (#91) hits a target, `MISSMODE_SrvDmgHitHandler` invokes `gpMissileSrvDmgFnTable[4]` = **`MISSMODE_SrvDmg04_IceBlast @ 0x6FC58E70`**:
    ```cpp
    pDamage->dwFrzLen = pDamage->dwColdLen;
    pDamage->dwColdLen = 0;
    ```
  - This transfers 100% of `dwColdLen` into `dwFrzLen`, turning Ice Blast into a hard single-target freeze (`3.0s + 0.2s/lvl`, multiplied by $1 + 0.10 \times \text{Glacial Spike.blvl}$)!
- **Client Dispatch**:
  - Default linear client `iceblast` (#91). On client collision (`ClientCol = 1`), spawns `ExplosionMissile = "freezingarrowexp1"` (#88, `FreezeExplodeCenter`, `Range = 16`).

---

### 4.5 Glacial Spike (Skill #55)

Glacial Spike fires an icy projectile (`glacialspike` #96) that detonates on impact into a 4-subtile AoE hard freeze and cold explosion.

#### Server Hit (`MISSMODE_SrvHit13_GlacialSpike_HellMeteorDown @ 0x6FC5B3E0`)
1. Evaluates AoE blast radius from `aurarangecalc = "ln12"` (`Param1 = 4`, `Param2 = 0` $\implies$ **4 subtiles** $\approx 2.67$ yards, identical to Fire Ball!).
2. Evaluates AoE freeze duration from `auralencalc = "ln34 * (100 + skill('Blizzard'.blvl) * par7) / 100"` (`Param3 = 50`, `Param4 = 3`, `Param7 = 3`):
   $$\text{FreezeFrames} = \left\lfloor\frac{(50 + 3 \times (\text{slvl} - 1)) \times (100 + 3 \times \text{Blizzard.blvl})}{100}\right\rfloor$$
3. Calls `MISSMODE_FillDamageParams` to populate cold damage (`HitShift = 7`, `(Ice Bolt + Ice Blast + Frozen Orb).blvl * 5`% synergy).
4. Checks `pMissilesTxtRecord->nElemType` (`EType = "frze"` = `ELEMTYPE_FREEZE` on `glacialspike` #96): assigns `damage.dwFrzLen = FreezeFrames`, sets `ResultFlags |= 5`, `HitFlags |= 2`, and calls `sub_6FD10200` to apply radial cold damage and hard freeze to all enemies within `4` subtiles.
5. Returns `1` (or `3`), destroying the projectile without double-hitting the primary target.

#### Client Hit (`MissileCltHitFunc[14] @ 0x6FB60870`)
When `glacialspike` (#96) collides on the client:
1. Spawns **1** central `CltHitSubMissile1 = "freezingarrowexp1"` (#88, `FreezeExplodeCenter`) at impact `(X, Y)` via `0x6FB60450` (`0x6FB60918`).
2. Reads `CltHitSubMissile2 = "freezingarrowexp2"` (#89, `FreezeExplodeEjecta`, `NumDirections = 8`) (`[edi+0x2e]`).
3. Rolls `rand % 3` (`0x6FB60966`) to select one of 3 directional shard burst patterns from the lookup table at `0x6FB83CB0`, then loops over the pattern's directional offsets (`0x6FB83CEC` X-offsets, `0x6FB83D0C` Y-offsets) to spawn outward-flying `freezingarrowexp2` (#89) ice chunks around the impact point (`0x6FB609AD`).

---

### 4.6 Blizzard (Skill #59)

Blizzard (`delay = 45` frames = $1.8\text{s}$ casting delay) places an invisible 100-frame ($4.0\text{s}$) storm controller (`blizzardcenter` #158) at the target location that rains down 25 icy shards (`blizzard1..4` #159–162) across a 13×13 subtile square.

#### Server Cast & Storm Controller (`SKILLS_SrvDo028 @ 0x6FC62D90`, `MISSMODE_SrvDo10_BlizzardCenter @ 0x6FC613D0`)
1. **Cast (`SKILLS_SrvDo028 @ 0x6FC62D90`)**:
   - Validates line-of-sight (`LineOfSight = 4`) and open coordinates (`SearchOpenXY = 1`) via `sub_6FD15340`, then spawns `wSrvMissileA = "blizzardcenter"` (#158, `Range = 100` frames = $4.0\text{s}$, `CelFile = "null"`) at `(targetX, targetY)`.
2. **Periodic Shard Spawn (`MISSMODE_SrvDo10_BlizzardCenter @ 0x6FC613D0`)**:
   - Evaluates storm half-extent `nRange = calc1 = Param1 = 7` subtiles and shard period `nFrames = calc2 = Param3 = 4` frames.
   - Calls `MISSMODE_CreateMissileWithCollisionCheck(pGame, pMissile, 7, 4, wSubMissile[0] /* blizzard1 #159 */, 5)`:
     - Checks `MISSILE_GetRemainingFrames(pMissile) % 4 == 0` (**fires once every 4 frames = 25 shards over 100 frames**).
     - Seeds `pMissile->pSeed` with `centerX + nRemainingFrames` (`SEED_InitLowSeed`).
     - Rolls random offsets in $[-(nRange - 1),\; +(nRange - 1)] = [-6,\; +6]$ subtiles (`2 * 6 = 12` span via `ITEMS_RollLimitedRandomNumber(&pSeed, 12) - 6`):
       $$X_{\text{shard}} = X_{\text{center}} + \text{rand}(0..11) - 6, \qquad Y_{\text{shard}} = Y_{\text{center}} + \text{rand}(0..11) - 6$$
     - Checks `COLLISION_CheckMask(pRoom, X_shard, Y_shard, 5)` (`0x5` = `COLLIDE_WALL | COLLIDE_MISSILE_BARRIER`). If clear, spawns `blizzard1` (#159) at $(X_{\text{shard}}, Y_{\text{shard}})$ with `dwFlags = 3`.
3. **Shard Ground Collision (`blizzard1` #159, `MISSMODE_SrvDo03 @ 0x6FC61AE0`)**:
   - Each server shard is stationary (`Vel = 0`), lasts `Range = 9` frames, has `Size = 2` (footprintradius), `CollideType = 3`, `CollideKill = 0`, `LastCollide = 1`, `AlwaysExplode = 1`.
   - `MISSMODE_SrvDo03` sets `0x40` (`COLLIDE_MISSILE`) on the room collision grid and tests collision against monsters/players touching its Size-2 footprint, dealing Skill #59 cold damage (`HitShift = 8`, `(Ice Bolt + Ice Blast + Glacial Spike).blvl * 5`% synergy) and `ELen = 100` frames ($4.0\text{s}$ base chill).

#### Client Storm & 3D Falling Shards (`SkillCltDoFunc[28] @ 0x6FB23DF0`, `MissileCltDoFunc[13] @ 0x6FB6BC10`, `MissileCltHitFunc[19] @ 0x6FB61080`)
- **`SkillCltDoFunc[28] @ 0x6FB23DF0`**:
  - Spawns client `blizzardcenter` (#158) at `(targetX, targetY)` via `0x6FB51540`.
- **`MissileCltDoFunc[13] @ 0x6FB6BC10` (`blizzardcenter` #158)**:
  - Reads `CltSubMissile1` (`[eax+0x1e]` = `159`, `blizzard1`) and `CltSubMissile2` (`[eax+0x20]` = `162`, `blizzard4`).
  - Rolls a random shard ID uniformly in `[159..162]` (`blizzard1`, `blizzard2`, `blizzard3`, or `blizzard4` via `0x6FAB1380` @ `0x6FB6BC77`) for visual variety.
  - Evaluates `calc1` (`[esi+0x138]` = `7` subtiles) and `calc2` (`[esi+0x13c]` = `4` frames) via `D2Common#10786`.
  - Calls `0x6FB68DF0(nRange=7, nShardId)` (`0x6FB6BD0B`), the exact client mirror of `MISSMODE_CreateMissileWithCollisionCheck` (every 4 frames, rolls $(X, Y)$ in $[-6, +6]$ and spawns the shard if unobstructed).
  - If a shard was spawned (`eax != 0`), calls **`0x6FB62E00`** (`0x6FB6BD14`), which reads the shard's `CltParam1 = 120` (initial Z altitude in pixels) and `CltParam2 = 5` (vertical fall rate per frame) and initializes its 3D vertical descent trajectory (`0x6FB77E30`) so the ice shard streaks down from the sky onto $(X_{\text{shard}}, Y_{\text{shard}})$!
- **`MissileCltHitFunc[19] @ 0x6FB61080` (`blizzard1..4` #159–162)**:
  - Invoked when each client shard expires/lands (`AlwaysExplode = 1`).
  - Reads `CltHitSubMissile1` (`[eax+0x2c]` = `163`, `blizzardexplode1`) and `CltHitSubMissile2` (`[eax+0x2e]` = `165`, `blizzardexplode3`), rolls a random explosion ID in `[163..165]` (`0x6FAB1380` @ `0x6FB610D6`), and spawns it at the shard's `(X, Y)` via `0x6FB60450`.

---

### 4.7 Frozen Orb (Skill #64)

Frozen Orb (`delay = 25` frames = $1.0\text{s}$ casting delay) launches a piercing icy sphere (`frozenorb` #260) that fires a continuous golden-angle-like spiral of `frozenorbbolt` (#261) projectiles every single tick, culminating in a 16-bolt pinwheel nova (`frozenorbnova` #262) when the sphere expires.

#### 1. Cast (`srvdofunc = ""`, `SkillCltDoFunc[29] @ 0x6FB23D70`)
- **Server**: Handled by the default `wSrvMissile` linear projectile spawn (`sub_6FD11420`) of `frozenorb` (#260): `Vel = 10`, `Range = 30` frames ($1.2\text{ seconds}$), `Size = 1`, `CollideType = 3`, **`CollideKill = 0`** (the orb itself pierces straight through monsters/players and only stops on solid walls/obstacles or after 30 frames!), `LastCollide = 1`, `AlwaysExplode = 1`.
- **Client (`SkillCltDoFunc[29] @ 0x6FB23D70`)**: Sets unit flag `0x40` (`OR DWORD PTR [edi+0xc4], 0x40` @ `0x6FB23DBB`) and spawns client `frozenorb` (#260) via `0x6FB515C0`.

#### 2. In-Flight Spiral Bolt Emission (`MISSMODE_SrvDo15_FrozenOrb @ 0x6FC60CA0` & `MissileCltDoFunc[19] @ 0x6FB68840`)
Both server (`MISSMODE_SrvDo15_FrozenOrb @ 0x6FC60CA0`) and client (`MissileCltDoFunc[19] @ 0x6FB68840`) execute identical logic on every tick of `frozenorb` (#260):
1. Reads emission period `nFrames = max(Param1, 1)` (`Param1 = CltParam1 = 1` $\implies$ **fires 1 bolt every single frame**, i.e., **30 spiral bolts** over its 30-frame lifetime).
2. Reads the orb's current 64-direction circle index from `MISSILE_GetTargetX(pMissile)`:
   $$\text{nIndex} = \left|\text{MISSILE\_GetTargetX}(pMissile)\right| \bmod 64$$
3. Looks up the target vector offset in the 64-entry radius-30 circle tables `xPositions[64]` and `yPositions[64]` (client VAs `0x6FB83F10` and `0x6FB83E10`):
   ```text
   xPositions[0..16] = { 30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11,  8,  5,  2,  0, ... }
   yPositions[0..16] = {  0,  2,  5,  8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29, 30, ... }
   ```
4. Spawns `wSubMissile[0] = "frozenorbbolt"` (#261, `Vel = 18`, `Range = 25`, `CollideType = 3`, `CollideKill = 1`, `LastCollide = 1`) from the orb (`dwFlags = 2`, relative target offset `(xPositions[nIndex], yPositions[nIndex])`).
5. Advances the direction index by **`Param2 = CltParam2 = 19`** modulo 64 and stores it back via `MISSILE_SetTargetX`:
   $$\text{nIndex}_{\text{next}} = (\text{nIndex} + 19) \bmod 64$$
   - Because $\gcd(19, 64) = 1$, stepping by $19/64$ of a circle ($106.875^\circ$ per frame) visits all 64 directions without repeating until 64 bolts, producing Frozen Orb's dense, non-clumping spiral spray!

#### 3. Final 16-Bolt Nova Burst (`MISSMODE_SrvHit29_FrozenOrb @ 0x6FC5C850` & `MissileCltHitFunc[30] @ 0x6FB66010`)
- **Mid-Flight Unit Piercing vs Expiration (`MISSMODE_SrvHit29_FrozenOrb @ 0x6FC5C850`)**:
  - When `frozenorb` (#260) touches a monster/player mid-flight (`MISSILE_GetCurrentFrame(pMissile) != 0`), `MISSMODE_SrvHit29_FrozenOrb` immediately returns **`2`**! In `MISSMODE_SrvDmgHitHandler`, return code `2` deals collision damage to the unit without destroying the orb and **without** triggering the final nova burst.
  - When `frozenorb` (#260) reaches `Range == 0` (`MISSILE_GetCurrentFrame(pMissile) == 0`, triggered because `AlwaysExplode = 1`) or strikes a solid wall:
    1. Reads angular step `nParam = max(sHitPar1, 1)` (`sHitPar1 = cHitPar1 = 4`).
    2. Loops `i = 0, 4, 8, 12, ..., 60` (**$\frac{64}{4} = 16$ bolts**) around the 64-entry radius-30 circle table (client VAs `0x6FB83AB8` / `0x6FB839B8` with byte stride `4 << 2 = 16` at `0x6FB660B7`).
    3. At each angle `i`, spawns `wHitSubMissile[0] = "frozenorbnova"` (#262, `Vel = 24`, `Range = 25`, `CollideKill = 1`) with `dwFlags = 2` and initializes its stored vector:
       ```cpp
       MISSILE_SetTargetX(pHitSubMissile, xOffsets[i]);
       MISSILE_SetTargetY(pHitSubMissile, yOffsets[i]);
       ```
       *(Client calls `D2Common#10637` @ `0x6FB660EB` and `D2Common#10019` @ `0x6FB660F8`).*
    4. Returns `3` (and on client spawns `ExplosionMissile = "frozenorbexplode"` #263, `IceOrbExplode`).

#### 4. Pinwheel Curvature of Nova Bolts (`MISSMODE_SrvDo16_FrozenOrbNova @ 0x6FC60BD0` & `MissileCltDoFunc[20] @ 0x6FB629B0`)
Each of the 16 final `frozenorbnova` (#262) bolts runs a path-curving `DoFunc` (`Param1 = CltParam1 = 6`, `Param2 = CltParam2 = 2`):
- **Server (`MISSMODE_SrvDo16_FrozenOrbNova @ 0x6FC60BD0`)**:
  - When `nRemainingFrames < 6` and `nRemainingFrames % 2 == 0` (the final ticks of flight), reads `(TargetX, TargetY)` and applies a $45^\circ$ rotation + $\frac{1}{\sqrt{2}}$ scale step:
    $$\text{NewTargetX} = \left\lfloor\frac{\text{TargetX} - \text{TargetY}}{2}\right\rfloor, \qquad \text{NewTargetY} = \left\lfloor\frac{\text{TargetX} + \text{TargetY}}{2}\right\rfloor$$
  - Calls `D2COMMON_10170_PathSetTargetPos(pDynamicPath, UnitX + NewTargetX, UnitY + NewTargetY)` and `D2Common_10142` to bend the bolt's trajectory, then stores `(NewTargetX, NewTargetY)` back into `TargetX`/`TargetY`.
- **Client (`MissileCltDoFunc[20] @ 0x6FB629B0`)**:
  - Checks `D2Common#10985(pMissile)` (elapsed frames) `< CltParam1` (`6` at `[edi+0x58]`) and `elapsedFrames % CltParam2 == 0` (`2` at `[edi+0x5c]`).
  - Applies the identical `(TargetX - TargetY) / 2` (`sar edi, 1` @ `0x6FB62A30`) and `(TargetX + TargetY) / 2` (`sar ebx, 1` @ `0x6FB62A32`) transformation (`D2Common#10286` `PathSetTargetPos` + `D2Common#10334` recompute path), giving the 16-bolt final burst its characteristic outward pinwheel curl.

---

### 4.8 Cold Mastery (Skill #65)

- **Passive Skill (`passive = 1`)**:
  - Has no active `StFunc` or `DoFunc`.
  - Applies `passivestate = "coldmastery"` (State #73, `nosend = 1`) and grants `passivestat1 = "passive_cold_pierce"` (`STAT_PASSIVE_COLD_PIERCE`) evaluated from `passivecalc1 = "ln12"` (`Param1 = 20`, `Param2 = 5`):
    $$\text{EnemyColdResistReduction\%} = 20 + 5 \times (\text{slvl} - 1)$$
  - **Immunity & Cap Rules**:
    - Unlike **Fire Mastery** (#61) and **Lightning Mastery** (#63), which grant `+% Skill Damage`, **Cold Mastery** subtracts directly from the target's `STAT_COLDRESIST` during `SUNITDMG` damage calculation (`resist_effective = max(-100, resist_base - passive_cold_pierce)`).
    - **Does NOT break Cold Immunity**: If a target's Cold Resistance is $\ge 100\%$ (Cold Immune), `passive_cold_pierce` is skipped completely unless an active resistance-lowering curse/aura (Conviction or Lower Resist at $\frac{1}{5}$ effectiveness) first lowers the target's Cold Resistance below $100\%$, at which point Cold Mastery applies at **100% full effectiveness** down to the $-100\%$ resistance floor.
