# Diablo II v1.13c Sorceress Fire Spells — Server & Client Reverse-Engineering Reference

> **Ground Truth**: `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`), `D2Client.dll` v1.13c (`ImageBase = 0x6FAB0000`), `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`), and official v1.13c MPQ data tables (`Skills.txt`, `Missiles.txt`, `States.txt`, `PetType.txt`, `MonStats.txt`).

---

## 1. Dispatch Tables (`D2Client.dll` & `D2Game.dll` v1.13c)

### 1.1 `D2Game.dll` (`ImageBase = 0x6FC20000`)

| Dispatch Table | Table VA | Index | Function VA | Symbol / Role | Used By (Fire Tree) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `11` | `0x6FC64550` | `SKILLS_SrvSt11_Inferno_ArcticBlast` | Inferno (#41) |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `14` | `0x6FC62AD0` | `SKILLS_SrvSt14_Hydra` | Hydra (#62) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | *(default)* | *(inline)* | `D2GAME_SKILLS_Handler` (`wSrvMissile` linear spawn) | Fire Bolt (#36), Fire Ball (#47), HydraMissile (#337) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `19` | `0x6FC64390` | `SKILLS_SrvDo019_Inferno_ArcticBlast` | Inferno (#41) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `23` | `0x6FC62730` | `SKILLS_SrvDo023_Blaze_EnergyShield_SpiderLay` | Blaze (#46) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `24` | `0x6FC637D0` | `SKILLS_SrvDo024_FireWall` | Fire Wall (#51) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `25` | `0x6FC62570` | `SKILLS_SrvDo025_Enchant` | Enchant (#52) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `28` | `0x6FC62D90` | `SKILLS_SrvDo028_Meteor_Blizzard_...` | Meteor (#56) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `144` | `0x6FC63D40` | `SKILLS_SrvDo144_Hydra` | Hydra (#62) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `firebolt` (#58), `infernoflame1` (#60), `fireball` (#62), `meteorcenter` (#101), `hydra` (#247) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `5` | `0x6FC61980` | `MISSMODE_SrvDo05_FireWall_ImmolationFire_MeteorFire_...` | `blaze` (#67), `firewall` (#69), `meteorfire` (#240) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `6` | `0x6FC61850` | `MISSMODE_SrvDo06_MoltenBoulder_FireWallMaker` | `firewallmaker` (#68) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `1` | `0x6FC5B990` | `MISSMODE_SrvHit01_Fireball_ExplodingArrow_...` | `fireball` (#62) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `8` | `0x6FC59F70` | `MISSMODE_SrvHit08_Blaze` | `blaze` (#67) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `14` | `0x6FC5DEF0` | `MISSMODE_SrvHit14_MeteorCenter_...` | `meteorcenter` (#101) |
| `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | `3` | `0x6FC59670` | `MISSMODE_SrvDmg03_Blaze_FireWall_...` | `blaze` (#67), `firewall` (#69), `meteorfire` (#240) |

### 1.2 `D2Client.dll` (`ImageBase = 0x6FAB0000`)

| Dispatch Table | Table VA | Index | Function VA | Role / Behavior | Used By (Fire Tree) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `15` | `0x6FB240F0` | Channeling state & sound/overlay init (`STATE_INFERNO`) | Inferno (#41) |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `17` | `0x6FB23C10` | Client target room & non-town validation | Hydra (#62) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | *(default)* | *(inline)* | Standard `wCltMissile` linear spawn | Fire Bolt (#36), Fire Ball (#47), HydraMissile (#337) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `24` | `0x6FB24D50` | Wrapper around `0x6FB24930` (channeling flame stream) | Inferno (#41) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `26` | `0x6FB24770` | Orthogonal `firewallmaker` pair + center `firewall` spawn | Fire Wall (#51) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `28` | `0x6FB23DF0` | Target-point ground anchor (`meteorcenter`) spawn | Meteor (#56) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | Standard client frame advance & step | `firebolt` (#58), `infernoflame1/2` (#60–61), `fireball` (#62), `hydra` (#247), explosions |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `5` | `0x6FB62F90` | Ground fire `SubLoop` (`[SubStart..SubStop]`) & fade-out | `blaze` (#67), `firewall` (#69), `firesmall` (#104), `firemedium` (#105), `meteorfire` (#240) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `6` | `0x6FB692B0` | Spawns trailing ground fire (`firewall`/`firesmall`/`firemedium`) on tile change | `firewallmaker` (#68) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `9` | `0x6FB68F00` | Delayed falling meteor visual + trail spawn | `meteorcenter` (#101) — see [d2client-meteor-cltdofunc-clthitfunc.md](../missiles/d2client-meteor-cltdofunc-clthitfunc.md) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `1` | `0x6FB6C1A0` | Circular scatter of `CltHitSubMissile1` (`fireexplosion2`) | `fireball` (#62) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `18` | `0x6FB66540` | Meteor impact flash, explosions, screen shake, ground fire | `meteorcenter` (#101) — see [d2client-meteor-cltdofunc-clthitfunc.md](../missiles/d2client-meteor-cltdofunc-clthitfunc.md) |

---

## 2. `Skills.txt` Ground-Truth Summary (Fire Spells #36, #37, #41, #46, #47, #51, #52, #56, #61, #62, #337)

| ID | Skill | ReqLvl | `srvst` / `srvdo` | `cltst` / `cltdo` | Server Missiles | Client Missiles | Delay (f) | Mana (`mana` / `lvl` / `shift` / `min`) | `HitShift` | Base Elemental Damage (`EMin`–`EMax`, Tier 1–5) | Synergy (`EDmgSymPerCalc`) |
| :-: | :--- | :-: | :-: | :-: | :--- | :--- | :-: | :--- | :-: | :--- | :--- |
| `36` | **Fire Bolt** | 1 | `—` / `—` | `—` / `—` | `firebolt` (#58) | `firebolt` (#58) | 0 | `5` / `+0` / `7` / `1` | `7` ($\times \frac{128}{256}$) | `6–12` (`+3/+4/+8/+18/+54` min, `+3/+6/+10/+20/+56` max) | `(Fire Ball.blvl + Meteor.blvl) * 16`% |
| `37` | **Warmth** | 1 | *(passive)* | *(passive)* | `—` | `—` | 0 | `0` | `8` | *(Passive: `manarecoverybonus = 30 + 12*(slvl-1)`%)* | `—` |
| `41` | **Inferno** | 6 | `11` / `19` | `15` / `24` | `infernoflame1` (#60) | `infernoflame1` (#60), `infernoflame2` (#61) | 0 (`repeat=1`) | `36` / `+1` / `2` / `0` (`startmana=6`) | `2` ($\times \frac{4}{256}$) | `32–64` (`+24/+26/+28/+32/+36` min, `+24/+27/+29/+33/+37` max) | `Warmth.blvl * 13`% |
| `46` | **Blaze** | 12 | `—` / `23` | `—` / `—` | `blaze` (#67) | `blaze` (#67), `firewall`, `firesmall`, `firemedium` | 0 | `22` / `+1` / `7` / `1` | `4` ($\times \frac{16}{256}$) | `4–8` (`+2/+3/+4/+6/+9` min & max) | `Warmth.blvl * 4 + Fire Wall.blvl * 1`% |
| `47` | **Fire Ball** | 12 | `—` / `—` | `—` / `—` | `fireball` (#62) | `fireball` (#62) | 0 | `10` / `+1` / `7` / `1` | `7` ($\times \frac{128}{256}$) | `12–28` (`+13/+23/+28/+33/+38` min, `+15/+25/+30/+35/+40` max) | `(Fire Bolt.blvl + Meteor.blvl) * 14`% |
| `51` | **Fire Wall** | 18 | `—` / `24` | `—` / `26` | `firewallmaker` (#68), `firewall` (#69) | `firewallmaker` (#68) | 35 (1.4s) | `22` / `+1` / `8` / `1` | `4` ($\times \frac{16}{256}$) | `15–20` (`+9/+14/+21/+21/+21` min & max) | `Warmth.blvl * 4 + Inferno.blvl * 1`% |
| `52` | **Enchant** | 18 | `—` / `25` | `—` / `—` | `—` | `—` | 0 | `25` / `+1` / `8` / `1` | `7` ($\times \frac{128}{256}$) | `16–20` (`+3/+7/+11/+15/+19` min, `+5/+9/+13/+17/+21` max); `ToHit=20 + 9*(slvl-1)`% | `Warmth.blvl * 9`% |
| `56` | **Meteor** | 24 | `—` / `28` | `—` / `28` | `meteorcenter` (#101) | `meteorcenter` (#101) | 30 (1.2s) | `34` / `+1` / `7` / `1` | `8` ($\times \frac{256}{256}$) | `80–100` (`+23/+39/+79/+81/+83` min, `+25/+41/+81/+83/+85` max) | `(Fire Bolt.blvl + Fire Ball.blvl) * 5`% |
| `61` | **Fire Mastery** | 30 | *(passive)* | *(passive)* | `—` | `—` | 0 | `0` | `8` | *(Passive: `passive_fire_mastery = 30 + 7*(slvl-1)`%)* | `—` |
| `62` | **Hydra** | 30 | `14` / `144` | `17` / `—` | *(pet `hydra1`..`3`)* | `—` | 40 (1.6s) | `40` / `+1` / `7` / `1` | `7` ($\times \frac{128}{256}$) | `28–39` (`+11/+15/+19/+23/+27` min, `+13/+17/+21/+25/+29` max) | `(Fire Bolt.blvl + Fire Ball.blvl) * 3`% |
| `337` | **HydraMissile** | 1 | `—` / `—` | `—` / `—` | `hydra` (#247) | `hydra` (#247) | 0 | `0` | `8` | *(Defers damage lookup to `Skill = Hydra` #62 on `hydra` #247)* | *(Uses Hydra #62)* |

> **Mana Cost Formula**:
> $$\text{ManaCost} = \max\!\left(\text{minmana} \ll 8,\; (\text{mana} + \text{lvlmana} \times (\text{slvl} - 1)) \ll \text{manashift}\right)$$
> In 256ths of a mana point (divide by $256$ for displayed mana). Note `manashift = 7` means `mana` and `lvlmana` are specified in **half-mana ($128/256$) units**, whereas `manashift = 2` on **Inferno** means per-tick channeling drain is in $\frac{4}{256}$ mana units per tick.

---

## 3. `Missiles.txt` Ground-Truth Summary (Fire Tree Missiles & Sub-Missiles)

| ID | Missile Name | `pSrvDo` | `pSrvHit` | `pSrvDmg` | `pCltDo` | `pCltHit` | `Vel` / `MaxVel` | `Range` (`+LevRange`) | `Size` | `CollideType` | `SubMissile1` / `HitSubMissile1` | `CltSubMissile1..3` / `CltHitSubMissile1..4` | Key Parameters & Flags |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- | :--- | :--- |
| `29` | `fireexplode` | `—` | `—` | `—` | `1` | `—` | `0` | `12` | `1` | `0` | `—` | `—` | `Explosion=1`, `RandStart=5`, `CelFile=FireArrowExplode2` |
| `42` | `explodingarrowexp` | `—` | `—` | `—` | `1` | `—` | `0` | `16` | `1` | `0` | `—` | `—` | `Explosion=1`, `CelFile=ExpArrowExplode` |
| `58` | `firebolt` | `1` | `—` | `—` | `1` | `—` | `20` / `20` | `50` | `1` | `3` | `—` / `—` | `ExplosionMissile=fireexplode` (#29) | `Skill=Fire Bolt`, `CollideKill=1`, `LastCollide=1`, `ClientCol=1` |
| `60` | `infernoflame1` | `1` | `—` | `—` | `1` | `—` | `12` / `12` | `30` *(overridden)* | `1` | `3` | `—` | `—` | `Skill=Inferno`, `LastCollide=1`, `DamageRate=82`, `Param1=8`, `Param2=7` |
| `61` | `infernoflame2` | `1` | `—` | `—` | `1` | `—` | `12` / `12` | `30` *(overridden)* | `1` | `3` | `—` | `—` | Client alternating visual (`CelFile=Flamethrower2`) |
| `62` | `fireball` | `1` | `1` | `—` | `1` | `1` | `20` / `20` | `50` | `1` | `3` | `—` / `—` | `Explosion=explodingarrowexp` (#42), `CltHitSub1=fireexplosion2` (#265) | `sHitPar1=4` (AoE radius), `cHitPar1=3`, `cHitPar2=1`, `ResultFlags=5`, `HitFlags=2` |
| `67` | `blaze` | `5` | `8` | `3` | `5` | `—` | `0` | `90` (`+25/lvl`) | `1` | `3` | `—` | `—` | `Skill=Blaze`, `SubLoop=1` (`12..36`), `sHitPar1=19`, `dParam1=19`, `SrcTown=1` |
| `68` | `firewallmaker` | `6` | `—` | `—` | `6` | `—` | `12` / `12` | `7` (`+2/lvl`) | `1` | `8` | `firewall` (#69) / `—` | `CltSub1=firewall` (#69), `CltSub2=firesmall` (#104), `CltSub3=firemedium` (#105) | `CltParam1=4` (no-light freq), `LastCollide=1`, `ClientCol=1` |
| `69` | `firewall` | `5` | `—` | `3` | `5` | `—` | `0` | `90` | `1` | `3` | `—` | `—` | `Skill=Fire Wall`, `SubLoop=1` (`12..36`), `dParam1=19`, `DamageRate=41` |
| `100` | `meteor` | `—` | `—` | `—` | `1` | `—` | `0` | `60` | `0` | `0` | `—` | `—` | Client falling rock sprite (`CelFile=Meteor`) |
| `101` | `meteorcenter` | `1` | `14` | `—` | `9` | `18` | `0` | `60` | `1` | `0` | `—` / `meteorfire` (#240) | `CltSub1=meteor`, `2=meteortail`; `CltHitSub1=meteorexplode`, `2=whitelightmissile`, `3=firemedium`, `4=firesmall` | `Skill=Meteor`, `AlwaysExplode=1`, `CltParam1=59`, `CltParam2=25`, `CltParam3=15`, `sHitPar1=0`, `sHitPar2=1`, `cHitPar1..3=5,3,15` |
| `102` | `meteortail` | `—` | `—` | `—` | `1` | `—` | `0` | `60` | `0` | `0` | `—` | `—` | Client smoke/fire trail (`Range=60`, overridden to `12` by `CltDoFunc 9`) |
| `103` | `meteorexplode` | `1` | `—` | `—` | `1` | `—` | `0` | `16` | `1` | `0` | `—` | `—` | `Explosion=1`, `Light=13`, `CelFile=ExpArrowExplode` |
| `104` | `firesmall` | `1` | `—` | `—` | `5` | `—` | `0` | `90` (`+25/lvl`) | `1` | `3` | `—` | `—` | Client decorative ground fire (`CelFile=groundFireSmall`, `SubLoop 12..36`) |
| `105` | `firemedium` | `1` | `—` | `—` | `5` | `—` | `0` | `90` (`+25/lvl`) | `1` | `3` | `—` | `—` | Client decorative ground fire (`CelFile=groundFireMedium`, `SubLoop 12..36`) |
| `154` | `whitelightmissile` | `1` | `—` | `—` | `1` | `—` | `0` | `10` (`+10/lvl`) | `0` | `0` | `—` | `—` | Pure light flash (`CelFile=null`, `Light=5`, `Red/Green/Blue=255`) |
| `240` | `meteorfire` | `5` | `—` | `3` | `5` | `—` | `0` | `90` *(overridden)* | `2` | `3` | `—` | `—` | Own missile damage (`HitShift=3`, `ApplyMastery=1`, `EDmgSym=Inferno.blvl*3`%), `dParam1=19`, `DamageRate=41` |
| `247` | `hydra` | `1` | `—` | `—` | `1` | `—` | `16` / `16` | `30` | `1` | `3` | `—` | `ExplosionMissile=fireexplode` (#29) | `Skill=Hydra`, `CollideKill=1`, `LastCollide=1`, `CanDestroy=1`, `InitSteps=2` |
| `265` | `fireexplosion2` | `1` | `—` | `—` | `1` | `—` | `0` | `12` | `1` | `0` | `—` | `—` | `Explosion=1`, `RandStart=5`, `CelFile=FireArrowExplode2` |

---

## 4. Per-Skill Server & Client Mechanics

### 4.1 Fire Bolt (Skill #36)

- **Server Dispatch (`srvdofunc = ""`, `srvmissile = "firebolt"` #58)**:
  - Handled by the default `wSrvMissile` branch of `D2GAME_SKILLS_Handler` via linear projectile spawner `sub_6FD11420`.
  - Spawns 1 `firebolt` (#58) from caster's coordinates toward `(targetX, targetY)` with `Vel = 20`, `Range = 50` frames, `Size = 1`, `CollideType = 3` (`COLLIDE_MONSTER | COLLIDE_PLAYER | COLLIDE_MISSILE_BARRIER`), `CollideKill = 1`, `LastCollide = 1`.
  - **Flight (`MISSMODE_SrvDo01_BasicMissile @ 0x6FC5F540`)**: Calls `MISSMODE_HandleMissileCollision` each tick.
  - **Impact (`MISSMODE_SrvDmgHitHandler`)**: No `pSrvHitFunc` or `pSrvDmgFunc`. Rolls `firebolt` damage from Skill #36 (`HitShift = 7`, i.e., $\times \frac{128}{256} = 0.5$ of 256ths scale, plus `passive_fire_mastery` and `(Fire Ball.blvl + Meteor.blvl) * 16`% synergy), applies `ResultFlags = 4` (`DAMAGERESULTFLAG_GETHIT`), and destroys the missile (`CollideKill = 1`).
- **Client Dispatch (`cltdofunc = ""`, `cltmissile = "firebolt"` #58)**:
  - Default linear client missile spawn of `firebolt` (#58) using `MissileCltDoFunc[1] @ 0x6FB617C0`.
  - On client collision (`ClientCol = 1`), spawns visual `ExplosionMissile = "fireexplode"` (#29, `FireArrowExplode2`, `Range = 12`, `RandStart = 5`) and plays `HitSound = "sorceress_firebolt_impact_1"`.

---

### 4.2 Warmth (Skill #37)

- **Passive Skill (`passive = 1`)**:
  - Has no active `StFunc` or `DoFunc` on server or client.
  - Applies `passivestate = "warmth"` (State #70, `nosend = 1`) and grants `passivestat1 = "manarecoverybonus"` evaluated from `passivecalc1 = "ln12"`:
    $$\text{ManaRecoveryBonus\%} = \text{Param1} + \text{Param2} \times (\text{slvl} - 1) = 30 + 12 \times (\text{slvl} - 1)$$
  - Also serves as the primary base-level (`blvl`) fire synergy for **Inferno** (`+13%/blvl`), **Blaze** (`+4%/blvl`), **Fire Wall** (`+4%/blvl`), and **Enchant** (`+9%/blvl`).

---

### 4.3 Inferno (Skill #41)

Inferno is a continuous channeling (`repeat = 1`, `anim = SQ`, `seqnum = 6`, `seqinput = 10`) flamethrower skill.

#### Server Start (`SKILLS_SrvSt11_Inferno_ArcticBlast @ 0x6FC64550`)
1. Checks that `pUnit` either already has `STATE_INFERNO` (#12) or has current mana $\ge \text{startmana} \ll 8$ (`6 << 8 = 1536` in 256ths = 6 mana), and validates `wSrvMissileA = 60` (`infernoflame1`).
2. Calls `SKILLS_StartInferno`:
   - **First tick (State #12 not yet active)**: Allocates a `D2StatListStrc` for `STATE_INFERNO` (#12) with initial expire frame `dwGameFrame + 20`, registers `EVENTTYPE_REMOVESTATE` at `dwGameFrame + 20`, toggles `STATE_INFERNO` on, and sets `Skill.Param1 = 0` (suppressing flame spawn on the wind-up frame).
   - **Subsequent channeling ticks (State #12 already active)**: Consumes mana (`sub_6FCBD120`), extends the `STATE_INFERNO` StatList and `EVENTTYPE_REMOVESTATE` timer to `dwGameFrame + 6` frames, and immediately invokes `SKILLS_DoInferno`.

#### Server Do (`SKILLS_SrvDo019_Inferno_ArcticBlast @ 0x6FC64390` $\to$ `SKILLS_DoInferno`)
1. Reads `Skill.Param1`. If non-zero (true on every channeling tick after the wind-up):
   - Evaluates missile lifetime (range in frames) from `calc1 = "ln12/2"`:
     $$\text{Range}_{\text{frames}} = \max\!\left(1,\; \left\lfloor\frac{\text{Param1} + \text{Param2} \times (\text{slvl} - 1)}{2}\right\rfloor\right) = \left\lfloor\frac{20 + 3 \times (\text{slvl} - 1)}{2}\right\rfloor$$
   - Spawns `infernoflame1` (#60) with `dwFlags = 0x8020` (`0x20` velocity/path towards target + `0x8000` custom range override `nRange`), `Vel = 12`, `CollideType = 3`, `LastCollide = 1`, `HitShift = 2` ($\times \frac{4}{256}$ per hit), `DamageRate = 82`.
2. Sets `Skill.Param1 = 1` so all subsequent channeling ticks spawn flame missiles.
3. For monsters (`UNIT_MONSTER`), locks animation at `nSeqCurrentFramePrecise = 0xB00` until `dwGameFrame >= Skill.Param1` (`calc2 = 20` frames); for players, calls `sub_6FCBD120` to drain channeling mana per tick (`manashift = 2`).

#### Client Start & Do (`SkillCltStFunc[15] @ 0x6FB240F0`, `SkillCltDoFunc[24] @ 0x6FB24D50`)
- **`SkillCltStFunc[15] @ 0x6FB240F0`**:
  - Checks if `STATE_INFERNO` (#12) is already active on the client unit (`D2Common#10494`).
  - If **not** active: attaches `castoverlay` (if any) and plays `stsound` (`0x6FB38A70`), allocates a client StatList (`D2Common#11013` with flags `0x15`, state `12`) and toggles client `STATE_INFERNO` on (`D2Common#10945`).
  - If **already** active (`0x6FB241ED`): forces the unit's animation sequence frame to `DWORD PTR [edi+0x48] = 0x500` (frame 5.0 in 8-bit fixed point) and updates the StatList duration (`D2Common#11043` with `+7` frames) so the casting pose loops seamlessly while the button is held.
- **`SkillCltDoFunc[24] @ 0x6FB24D50`**:
  - Thin wrapper calling `0x6FB24930`, which alternates/selects between `cltmissilea = "infernoflame1"` (#60, `Flamethrower`) and `cltmissileb = "infernoflame2"` (#61, `Flamethrower2`) and spawns the flame projectile with range override `calc1 = ln12 / 2`.

---

### 4.4 Blaze (Skill #46)

Blaze buffs the caster with `STATE_BLAZE` (#13); while the state is active, moving across subtile boundaries leaves a trail of damaging ground fire (`blaze` #67).

#### Server Do (`SKILLS_SrvDo023_Blaze_EnergyShield_SpiderLay @ 0x6FC62730`)
1. Evaluates state duration from `auralencalc = "dm12"` (diminishing returns between `Param1 = 50` and `Param2 = 500` frames):
   $$\text{Duration}_{\text{frames}} = \left\lfloor\frac{(500 - 50) \times (110 \times \text{slvl}) / (\text{slvl} + 6)}{100}\right\rfloor + 50$$
2. Creates a self-targeted `D2StatListStrc` for `aurastate = "blaze"` (State #13) and stores `STAT_MODIFIERLIST_SKILL = 46` and `STAT_MODIFIERLIST_LEVEL = slvl` on the StatList.

#### Server Movement Hook (`SKILLS_CreateBlazeMissile`)
- Whenever a unit with `STATE_BLAZE` (#13) steps onto a new subtile (`D2Common_10234(pUnit->pDynamicPath)` returns non-zero) outside of town:
  - Reads `STAT_MODIFIERLIST_SKILL` and `STAT_MODIFIERLIST_LEVEL` from the unit's `STATE_BLAZE` StatList.
  - Spawns `wSrvMissileA = "blaze"` (#67) at `(CLIENTS_GetUnitX(pUnit), CLIENTS_GetUnitY(pUnit))` with `dwFlags = 0x21`.
- **Client Movement Hook (`States.txt`: `blaze` #13 has `setfunc = 3`)**:
  - Client state handler spawns the matching client ground fire trail (`cltmissile = "blaze"` #67 plus decorative `firewall`/`firesmall`/`firemedium` variants) as the unit moves.

#### Ground Fire Lifecycle (`blaze` #67)
- **Server Do (`MISSMODE_SrvDo05 @ 0x6FC61980`)**:
  - Sets `0x40` (`COLLIDE_MISSILE`) on the room's collision grid at the fire's coordinates (`Size = 1`).
  - Loops animation frames between `SubStart = 12` and `SubStop = 36` until `Range = 90 + 25*(slvl-1)` frames expire, then rewinds toward frame `0` (`nCurrentFrame - 2` per tick) for the extinguish animation.
- **Server Hit (`MISSMODE_SrvHit08_Blaze @ 0x6FC59F70`)**:
  - Prevents the caster (`pUnit == pOwner` while `STATE_BLAZE` is active) from colliding with their own Blaze fire (`return 0`), while returning `2` (apply damage without destroying the fire missile) for enemies.
- **Server Damage (`MISSMODE_SrvDmg03 @ 0x6FC59670`)**:
  - Rolls `(ITEMS_RollRandomNumber(&pMissile->pSeed) & 127) < dParam1` (`19 / 128` $\approx 14.84\%$ chance) to set `wResultFlags |= 0x4000` (`DAMAGERESULTFLAG_SOFTHIT`). Because `blaze` (#67) has `GetHit = 0`, it deals continuous per-frame fire damage (`HitShift = 4`, i.e., $\frac{16}{256}$ scale per frame) without putting monsters into full hit-recovery lock, triggering soft-hit sound/feedback on $19/128$ ticks.
- **Client Do (`MissileCltDoFunc[5] @ 0x6FB62F90`)**:
  - Exact client-side counterpart to `MISSMODE_SrvDo05`: loops `nSeqCurrentFramePrecise` (`[ebx+0x44]`) inside `[SubStart, SubStop)` (`12..36`) while `D2Common#10737` (remaining range frames) $\ge \text{SubStart}$, and steps `edi -= 2` per tick down to `0` during fade-out before calling `MissileCltDoFunc[1] @ 0x6FB617C0`.

---

### 4.5 Fire Ball (Skill #47)

- **Server Dispatch (`srvdofunc = ""`, `srvmissile = "fireball"` #62)**:
  - Default linear projectile spawn (`sub_6FD11420`) of `fireball` (#62): `Vel = 20`, `Range = 50`, `Size = 1`, `CollideType = 3`, `CollideKill = 1`, `LastCollide = 1`.
  - **Impact (`MISSMODE_SrvHit01_Fireball_ExplodingArrow_FreezingArrowExplosion @ 0x6FC5B990`)**:
    1. Reads AoE radius from `sHitPar1 = 4` subtiles ($\approx 2.67$ yards).
    2. Calls `MISSMODE_GetDamageValue` to roll fire damage from Skill #47 (`HitShift = 7`, `passive_fire_mastery`, synergy `(Fire Bolt.blvl + Meteor.blvl) * 14`%).
    3. Sets `ResultFlags = 5` (`0x1` successful hit | `0x4` get-hit) and `HitFlags = 2` (`DAMAGEHITFLAG_2`), then calls `sub_6FD10200` to deal radial AoE damage to all valid hostile targets within radius `4` subtiles of impact `(X, Y)`.
    4. Returns `1` (destroy missile). Note that because `MISSMODE_SrvHit01` returns `1` (bit `2` clear), `MISSMODE_SrvDmgHitHandler` does **not** deal a second direct-hit damage instance on top of the radial AoE!
- **Client Dispatch (`cltdofunc = ""`, `cltmissile = "fireball"` #62)**:
  - Spawns client `fireball` (#62). On collision (`ClientCol = 1`):
    1. Standard explosion handler spawns `ExplosionMissile = "explodingarrowexp"` (#42, `ExpArrowExplode`, `Range = 16`, `Light = 15`) and plays `HitSound = "sorceress_fireball_impact_1"`.
    2. Invokes **`MissileCltHitFunc[1] @ 0x6FB6C1A0`**:
       - Validates `CltHitSubMissile1` (`[esi+0x2c]` = `fireexplosion2` #265).
       - Reads `cHitPar1 = 3` (`[esi+0x6c]`, explosion scatter radius) and `cHitPar2 = 1` (`[esi+0x70]`, explosion density).
       - Calls circular scatter helper `0x6FB6B210` (`flags = 0x109`) to spawn secondary `fireexplosion2` (#265) puffs across the 3-subtile blast area.

---

### 4.6 Fire Wall (Skill #51)

Fire Wall creates two invisible `firewallmaker` (#68) path-tracers that march in opposite directions **perpendicular** to the caster-to-target vector, laying down stationary `firewall` (#69) columns on every subtile they traverse.

#### Server Do (`SKILLS_SrvDo024_FireWall @ 0x6FC637D0`)
1. Resolves target point $(X_t, Y_t)$ (from target unit or cast coordinates) and rejects if in town.
2. Computes the caster-to-target delta:
   $$\Delta X = X_{\text{caster}} - X_t, \qquad \Delta Y = Y_{\text{caster}} - Y_t$$
3. Rotates $(\Delta X, \Delta Y)$ by $\pm 90^\circ$ to form two orthogonal target points:
   - **Maker 1 (`firewallmaker` #68)**: Origin $(X_t, Y_t) \to$ Target $(X_t - \Delta Y,\; Y_t + \Delta X)$, `dwFlags = 0x21`.
   - **Maker 2 (`firewallmaker` #68)**: Origin $(X_t, Y_t) \to$ Target $(X_t + \Delta Y,\; Y_t - \Delta X)$, `dwFlags = 0x21`.
   - Each `firewallmaker` (#68) has `Vel = 12` and `Range = 7 + 2*(slvl-1)` frames (`CollideType = 8`, stopping on walls/barriers).
4. **Center Pillar**: Immediately spawns 1 stationary `wSrvMissileB = "firewall"` (#69) at $(X_t, Y_t)$ with `dwFlags = 1` so there is no gap at the center origin.

#### Server Maker & Fire Column (`firewallmaker` #68 & `firewall` #69)
- **`MISSMODE_SrvDo06_MoltenBoulder_FireWallMaker @ 0x6FC61850`**:
  - Each tick that `firewallmaker` (#68) advances onto a new subtile (`D2Common_10234(pMissile->pDynamicPath)` != 0), spawns `wSubMissile[0] = "firewall"` (#69) at the maker's current `(X, Y)` with `dwFlags = 0x21`.
- **`firewall` (#69)**:
  - Runs `MISSMODE_SrvDo05 @ 0x6FC61980` (`Range = 90` frames = 3.6 seconds, `SubLoop` frames `12..36`) and `MISSMODE_SrvDmg03 @ 0x6FC59670` (`19/128` soft-hit chance).
  - Deals continuous per-frame fire damage (`HitShift = 4` = $\frac{16}{256}$ per tick, `DamageRate = 41` for character sheet display). Three overlapping/adjacent subtile pillars can damage large targets simultaneously.

#### Client Do & Maker (`SkillCltDoFunc[26] @ 0x6FB24770`, `MissileCltDoFunc[6] @ 0x6FB692B0`)
- **`SkillCltDoFunc[26] @ 0x6FB24770`**:
  - Exact client-side mirror of `SKILLS_SrvDo024_FireWall`: computes $\Delta X = X_{\text{caster}} - X_t$ (`0x6FB248AF`) and $\Delta Y = Y_{\text{caster}} - Y_t$ (`0x6FB248B8`), spawns two `cltmissilea = "firewallmaker"` (#68) missiles aimed at $(X_t - \Delta Y, Y_t + \Delta X)$ (`0x6FB248CD`) and $(X_t + \Delta Y, Y_t - \Delta X)$ (`0x6FB248E2`) with `dwFlags = 0x21`, plus one stationary `firewall` (#69, read from `firewallmaker`'s `CltSubMissile1` at offset `+0x1E`) at $(X_t, Y_t)$ with `dwFlags = 1` (`0x6FB24905`).
- **`MissileCltDoFunc[6] @ 0x6FB692B0` (`firewallmaker` #68)**:
  - Checks if `firewallmaker`'s path stepped to a new subtile (`D2Common#10203` @ `0x6FB692C6`).
  - Selects the ground fire visual missile (`0x6FB693A6`–`0x6FB693F3`):
    - Base default is `CltSubMissile1 = "firewall"` (#69, `[ebx+0x1e]`).
    - If both `CltSubMissile2` (`firesmall` #104, `[ebx+0x20]`) and `CltSubMissile3` (`firemedium` #105, `[ebx+0x22]`) are valid, rolls `rand % 3` (`0x6FB693BC`): `0` $\to$ `firesmall` (#104), `1` $\to$ `firemedium` (#105), `2` $\to$ `firewall` (#69).
  - Rolls `rand % CltParam1` (`CltParam1 = 4` at `[ebx+0x58]`, `0x6FB693FD`): if non-zero ($3/4$ of pillars), sets `dwFlags |= 0x4000` (suppresses dynamic light allocation on 75% of pillars to save light channels!).
  - Spawns the client ground fire via `0x6FB630F0` and copies path step coordinates (`D2Common#10236`, `D2Common#10575`).

---

### 4.7 Enchant (Skill #52)

- **Server Do (`SKILLS_SrvDo025_Enchant @ 0x6FC62570`)**:
  1. Checks `SUNIT_GetTargetUnit(pGame, pUnit)`: if the target exists and `SUNIT_AreUnitsAligned(pGame, pUnit, pTarget)` is true (`TargetPet = 1`, `TargetAlly = 1`, `InTown = 1`), buffs `pTarget`; otherwise falls back to self (`pTarget = pUnit`).
  2. Evaluates duration from `auralencalc = "ln12"`:
     $$\text{Duration}_{\text{frames}} = 3600 + 600 \times (\text{slvl} - 1) \quad (144\text{s} + 24\text{s per level})$$
  3. Creates/updates `D2StatListStrc` for `aurastate = "enchant"` (State #16) on `pTarget` and attaches 3 stats:
     - `aurastat1 = "firemindam"` $\leftarrow$ `enma` (Skill #52 `EMin` + `Warmth.blvl * 9`% synergy + **caster's** `passive_fire_mastery` at cast time!).
     - `aurastat2 = "firemaxdam"` $\leftarrow$ `exma` (Skill #52 `EMax` + `Warmth.blvl * 9`% synergy + **caster's** `passive_fire_mastery` at cast time!).
     - `aurastat3 = "item_tohit_percent"` $\leftarrow$ `toht` (`ToHit + LevToHit*(slvl-1) = 20 + 9*(slvl-1)`% Attack Rating bonus).
  4. Toggles GfxState flag `STATE_ENCHANT` (#16) on `pTarget`.
  - **Double-Mastery & Ranged Penalty Note**: Because `enma`/`exma` bake the caster's Fire Mastery into the flat `firemindam`/`firemaxdam` stats, a Sorceress striking in **melee** applies her `passive_fire_mastery` a **second time** during combat damage calculation! On ranged weapon attacks, the flat Enchant fire damage is scaled by `Param3 = 33` ($\frac{1}{3}$).
- **Client Behavior**:
  - `cltdofunc = ""`. Handled via `STATE_ENCHANT` (#16) synchronization (`States.txt`: `castoverlay = "enchant"`, `itemtype = "weap"`, `itemtrans = "cred"`, `attblue = 1`, `damred = 1`), playing the `enchant` overlay on the target unit and tinting their weapon red.

---

### 4.8 Meteor (Skill #56)

> **Detailed Client Disassembly Reference**: See [d2client-meteor-cltdofunc-clthitfunc.md](../missiles/d2client-meteor-cltdofunc-clthitfunc.md) for the instruction-by-instruction breakdown of `SkillCltDoFunc[28]`, `MissileCltDoFunc[9]`, and `MissileCltHitFunc[18]`.

#### Server Mechanics (`SKILLS_SrvDo028 @ 0x6FC62D90`, `MISSMODE_SrvHit14 @ 0x6FC5DEF0`)
1. **Cast (`SKILLS_SrvDo028 @ 0x6FC62D90`)**:
   - Validates line-of-sight/room (`sub_6FD15340`) and spawns `wSrvMissileA = "meteorcenter"` (#101) at target coordinates `(X, Y)` via `D2GAME_CreateMissile_6FD115E0`.
2. **Countdown (`meteorcenter` #101, `MISSMODE_SrvDo01 @ 0x6FC5F540`)**:
   - `meteorcenter` is a stationary (`Vel = 0`), non-colliding (`CollideType = 0`), `AlwaysExplode = 1` timer missile with `Range = 60` frames ($2.4\text{ seconds}$).
   - It counts down for 60 frames and triggers `MISSMODE_SrvDmgHitHandler` with `a4 = 1` when `Range` reaches `0`.
3. **Impact (`MISSMODE_SrvHit14_MeteorCenter_CatapultMeteor_RoyalStrikeMeteor @ 0x6FC5DEF0`)**:
   - Evaluates explosion radius from `aurarangecalc = "ln12"` (`Param1 = 6`, `Param2 = 0` $\implies$ **6 subtiles** = 4 yards).
   - Fills fire damage from `meteorcenter` (Skill #56 `EMin`/`EMax`, `HitShift = 8`, `(Fire Bolt.blvl + Fire Ball.blvl) * 5`% synergy, `passive_fire_mastery`) with `ResultFlags = 5`, `HitFlags = 2`, and calls `sub_6FD10200` to damage all enemies within radius `6` subtiles.
   - Spawns **18** `wHitSubMissile[0] = "meteorfire"` (#240) ground fire patches via `MISSMODE_CreateMeteor_MoltenBoulderSubmissiles` using fixed 18-point offset arrays:
     - `xOffsets[18] = { 2, -2, 0, 0, -3, 0, 3, -1, 1, -1, 2, -4, -3, -1, 0, 1, 3, 4 }`
     - `yOffsets[18] = { -2, -2, 2, 5, 3, 3, 3, 2, 1, -1, -1, -2, -2, -3, -4, -3, -3, -2 }`
     - Overrides each `meteorfire`'s `Range` (`dwFlags = 0x8001`) to:
       $$\text{FireFrames} = \text{Param3} + \text{Param4} \times (\text{slvl} - 1) = 30 + 15 \times (\text{slvl} - 1)$$
     - Note: `meteorfire` (#240) uses its **own** `Missiles.txt` damage columns (`HitShift = 3`, `ApplyMastery = 1`, `EDmgSymPerCalc = "skill('Inferno'.blvl)*3"`%) rather than Skill #56's impact damage!

#### Client Summary (`SkillCltDoFunc[28] @ 0x6FB23DF0`, `MissileCltDoFunc[9] @ 0x6FB68F00`, `MissileCltHitFunc[18] @ 0x6FB66540`)
- **`SkillCltDoFunc[28] @ 0x6FB23DF0`**: Spawns `meteorcenter` (#101, `MeteorTargetIndicator` ground reticle) at the target coordinates via `0x6FB51540`.
- **`MissileCltDoFunc[9] @ 0x6FB68F00`**: Waits until `nRemainingFrames <= CltParam1` (`59`, i.e., tick 2). At `nRemainingFrames == 59`, spawns `CltSubMissile1 = "meteor"` (#100) shifted diagonally up-left in screen space (`pixelOffset = -(59 * 15) = -885` px X, `-885` px Z) with `vX = +15`, `vZ = +25` (`CltParam3`, `CltParam2`), and on every subsequent tick spawns `CltSubMissile2 = "meteortail"` (#102, `Range` overridden to `12`).
- **`MissileCltHitFunc[18] @ 0x6FB66540`**: On expiration, triggers `whitelightmissile` (#154) flash, `5` `meteorexplode` (#103) bursts, `3` `firemedium` (#105) + `15` `firesmall` (#104) ground flames (`Range = 30 + 15*(slvl-1)`), and camera shake (`0x6FB4C290(1, 0)`).

---

### 4.9 Fire Mastery (Skill #61)

- **Passive Skill (`passive = 1`)**:
  - Has no active `StFunc` or `DoFunc`.
  - Applies `passivestate = "firemastery"` (State #71) and grants `passivestat1 = "passive_fire_mastery"` evaluated from `passivecalc1 = "ln12"`:
    $$\text{FireMastery\%} = \text{Param1} + \text{Param2} \times (\text{slvl} - 1) = 30 + 7 \times (\text{slvl} - 1)$$
  - Multiplies all outgoing fire skill damage in `MISSMODE_RollDamageValue` (`STAT_PASSIVE_FIRE_MASTERY`) and melee fire damage (`SUNITDMG`), and is inherited by **Hydra** pets via `passivestat1` on Skill #62.

---

### 4.10 Hydra (Skill #62) & HydraMissile (Skill #337)

Hydra summons a trio of stationary turret pets (`hydra1` #351, `hydra2` #352, `hydra3` #353) under `pettype = "hydra"` (PetType #19), each of which independently casts `HydraMissile` (Skill #337) to fire `hydra` (#247) bolts at nearby enemies.

#### Server Start (`SKILLS_SrvSt14_Hydra @ 0x6FC62AD0`)
- Resolves the target coordinates `(nX, nY)` via `D2GAME_GetXAndYFromTargetUnit_6FD14020`, looks up the target room (`D2GAME_GetRoom_6FC52070`), and returns `1` iff the room exists and is **not** in town (`!DUNGEON_IsRoomInTown(pRoom)`). Because `stsuccessonly = 1`, failed town casts abort cleanly.

#### Server Do (`SKILLS_SrvDo144_Hydra @ 0x6FC63D40`)
1. Resolves base summon monster `summon = "hydra1"` (`hcIdx = 351` in `MonStats.txt`) and `summode = "S2"`.
2. Computes the pet expiration game frame from `Param1 = 250` ($10.0\text{ seconds}$) and `Param2 = 0`:
   $$t_{\text{expire}} = \text{dwGameFrame} + 250$$
3. Loops `i = 0..2` to summon **3 individual Hydra heads** in a tight triangle around `(nX, nY)`:
   - `i = 0`: `hcIdx = 351` (`hydra1`) at `(nX - 1, nY - 1)`
   - `i = 1`: `hcIdx = 352` (`hydra2`) at `(nX + 0, nY + 0)`
   - `i = 2`: `hcIdx = 353` (`hydra3`) at `(nX + 1, nY - 1)`
   - All 3 heads share `pettype = 19` (`hydra`, `petmax = 99`, `range = 1` in `PetType.txt`, so heads despawn if the Sorceress moves too far away without teleporting).
4. For each spawned Hydra head (`pPet`):
   - **`D2GAME_SetSkills_6FD14C60`**: Grants the pet the 3 `sumskill` entries from Skill #62:
     - `sumskill1 = "HydraMissile"` (#337) at level `lvl` (`slvl` of Hydra).
     - `sumskill2 = "Fire Bolt"` (#36) at level `skill('Fire Bolt'.blvl)` (caster's base Fire Bolt level, enabling synergy evaluation on the pet!).
     - `sumskill3 = "Fire Ball"` (#37) at level `skill('Fire Ball'.blvl)` (caster's base Fire Ball level, enabling synergy evaluation on the pet!).
   - **`D2GAME_SetSummonPassiveStats_6FD0C530`**: Copies the Sorceress's Fire Mastery and `-Enemy Fire Resist` onto the Hydra pet via Skill #62's `passivestat1`/`2`:
     - `passive_fire_mastery` $\leftarrow$ `stat('passive_fire_mastery'.accr)`
     - `passive_fire_pierce` $\leftarrow$ `stat('passive_fire_pierce'.accr)`
   - **`AITHINK_SetAiControlParams`**: Sets `AiControl` param 0 to $t_{\text{expire}}$ (`dwGameFrame + 250`) and params 1–2 to `-666` (`MONStats.txt` AI = `Hydra`).

#### Hydra Pet Attack (`HydraMissile` #337 & `hydra` #247)
- Each Hydra head's `Hydra` AI casts `Skill1 = "HydraMissile"` (#337) in animation mode `Sk1mode = "A1"`.
- **Skill #337 (`HydraMissile`)**:
  - Has `srvdofunc = ""`, `cltdofunc = ""`, `srvmissile = "hydra"` (#247), `cltmissile = "hydra"` (#247).
  - Spawns `hydra` (#247): `Vel = 16`, `Range = 30`, `InitSteps = 2`, `CollideType = 3`, `CollideKill = 1`, `LastCollide = 1`, `CanDestroy = 1`.
  - Crucially, `hydra` (#247) has **`Skill = "Hydra"`** (#62) in `Missiles.txt`! Thus when `hydra` (#247) rolls its elemental damage, it reads the damage curve (`HitShift = 7`, `EMin = 28..`, `EMax = 39..`) and synergy formula `(skill('Fire Bolt'.blvl) + skill('Fire Ball'.blvl)) * 3`% from **Skill #62 (Hydra)** on the Hydra pet unit (which holds `Fire Bolt`, `Fire Ball`, `passive_fire_mastery`, and `passive_fire_pierce` copied at summon time).
  - On client impact (`ClientCol = 1`), `hydra` (#247) spawns `ExplosionMissile = "fireexplode"` (#29) and plays `HitSound = "sorceress_firebolt_impact_1"`.

#### Client Start (`SkillCltStFunc[17] @ 0x6FB23C10`)
- Validates the caster's room (`D2Common#10331` @ `0x6FB23C1B`), extracts target coordinates `(X, Y)` (`0x6FB51340` @ `0x6FB23C39`), resolves the target room (`0x6FAB1400` @ `0x6FB23C58`), and checks `Skills.txt` `InTown` bit (`BYTE PTR [esi+0x5]`); if `InTown` is not set, rejects casts into a town room (`D2Common#10057` @ `0x6FB23C95`). Note that Hydra has no `cltdofunc` (`cltdofunc = ""`), because the 3 Hydra monster units are spawned on the server and replicated to the client via monster spawn packets.
