# Druid Elemental Skills (`Skills.txt` #225, #229, #230, #234, #235, #240, #244, #245, #249, #250) — Complete Server & Client Reverse-Engineering Reference (1.13c)

> **Ground Truth Binary / MPQ Data Sources**:
> - `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`)
> - `D2Client.dll` v1.13c (`ImageBase = 0x6FAB0000`)
> - `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`)
> - `Skills.txt`, `Missiles.txt`, `States.txt`, `Overlay.txt` (1.13c `patch_d2.mpq`)

---

## 1. Dispatch Tables (1.13c Virtual Addresses)

### 1.1 `D2Game.dll` Skill & State Server Dispatch (`ImageBase = 0x6FC20000`)
- **`SkillSrvStFunc` base**: `0x6FD27338`
- **`SkillSrvDoFunc` base**: `0x6FD274A8`

| Table | Index | 1.13c VA | Symbol / Role | Used By |
|---|---:|---|---|---|
| `SkillSrvStFunc` | `11` | `0x6FC64550` | `SKILLS_SrvSt11_Inferno_ArcticBlast` | Arctic Blast (#230) |
| `SkillSrvDoFunc` | `18` | `0x6FC628F0` | `SKILLS_SrvDo018_DefensiveBuff` | Cyclone Armor (#235) |
| `SkillSrvDoFunc` | `19` | `0x6FC64390` | `SKILLS_SrvDo019_Inferno_ArcticBlast` | Arctic Blast (#230) |
| `SkillSrvDoFunc` | `28` | `0x6FC62D90` | `SKILLS_SrvDo028_Meteor_Blizzard_Eruption` | Fissure / `Eruption` (#234) |
| `SkillSrvDoFunc` | `117` | `0x6FC656B0` | `SKILLS_SrvDo117_Firestorm` | Firestorm (#225) |
| `SkillSrvDoFunc` | `118` | `0x6FC65600` | `SKILLS_SrvDo118_Twister_Tornado` | Twister (#240), Tornado (#245) |
| `SkillSrvDoFunc` | `123` | `0x6FC652C0` | `SKILLS_SrvDo123_Volcano` | Volcano (#244) |
| `SkillSrvDoFunc` | `124` | `0x6FC65CE0` | `SKILLS_SrvDo124_Armageddon_Hurricane` | Armageddon (#249), Hurricane (#250) |
| `SkillSrvDoFunc` | `145` | `0x6FC65AF0` | `SKILLS_SrvDo145_HurricaneActive` (`States.txt` `srvactivefunc=145`) | Hurricane (`STATE_HURRICANE` #144) |
| `SkillSrvDoFunc` | `146` | `0x6FC65850` | `SKILLS_SrvDo146_ArmageddonActive` (`States.txt` `srvactivefunc=146`) | Armageddon (`STATE_ARMAGEDDON` #145) |
| `AuraEventFunc` | `25` | `D2GAME_EventFunc25` | Cyclone Armor `UNITEVENT_ABSORBDAMAGE` handler (`auraeventfunc1=25`) | Cyclone Armor (#235) |

> **Note on Molten Boulder (#229)**: Molten Boulder defines `srvdofunc = 0` and `srvmissile = moltenboulderemerge` (#453), so it is launched via the generic `wSrvMissile` path inside `D2GAME_SKILLS_Handler` (`Skills.cpp`).

### 1.2 `D2Client.dll` Skill & State Client Dispatch (`ImageBase = 0x6FAB0000`)
- **`SkillCltStFunc` base**: `0x6FB8E928`
- **`SkillCltDoFunc` base**: `0x6FB8EA48`

| Table | Index | 1.13c VA | Role | Used By |
|---|---:|---|---|---|
| `SkillCltStFunc` | `15` | `0x6FB240F0` | Channeled breath start (`Inferno` / `Arctic Blast` state & sound init) | Arctic Blast (#230) |
| `SkillCltDoFunc` | `24` | `0x6FB24D50` | Channeled breath per-tick (`arcticblast1` / `arcticblast2` stream) | Arctic Blast (#230) |
| `SkillCltDoFunc` | `28` | `0x6FB23DF0` | Target-point ground spawner (`erruption center` #461) | Fissure / `Eruption` (#234) |
| `SkillCltDoFunc` | `67` | `0x6FB79E30` | Firestorm client launcher (`0x6FB79A50` with `flags=0x200, bCenter=1, bTwister=0`) | Firestorm (#225) |
| `SkillCltDoFunc` | `68` | `0x6FB79D80` | Twister client launcher (`0x6FB79A50` with `flags=0, bCenter=0, bTwister=1`) | Twister (#240) |
| `SkillCltDoFunc` | `69` | `0x6FB79CD0` | Tornado client launcher (`0x6FB79A50` with `flags=0, bCenter=0, bTwister=0`) | Tornado (#245) |
| `SkillCltDoFunc` | `90` | `0x6FB79BE0` | Hurricane client active-state tick (`States.txt` `cltactivefunc=90`) | Hurricane (#250) |
| `SkillCltDoFunc` | `91` | `0x6FB794E0` | Volcano client progressive callback (`Skills.txt` `cltprgfunc1=91`) | Volcano (#244) |
| `SkillCltDoFunc` | `92` | `0x6FB795F0` | Armageddon client progressive meteor-drop callback (`Skills.txt` `cltprgfunc1=92`) | Armageddon (#249) |

### 1.3 `D2Game.dll` & `D2Client.dll` Missile Dispatch Tables
- **`MissileSrvDoFunc` base**: `0x6FD2D970`
- **`MissileSrvHitFunc` base**: `0x6FD2DA48`
- **`MissileSrvDmgFunc` base**: `0x6FD2DB68`
- **`MissileCltDoFunc` base**: `0x6FB8D8A0`
- **`MissileCltHitFunc` base**: `0x6FB8DA10`

| Table | Index | 1.13c VA | Symbol / Role | Missiles |
|---|---:|---|---|---|
| `MissileSrvDoFunc` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `firestorm` (#457), `moltenboulderemerge` (#453), `arcticblast1`/`2` (#459/#460), `erruption crack 1` (#462), `twister` (#477), `volcano debris 2` (#481), `volcano small fire` (#483), `armageddoncontrol` (#577), `armageddonfire` (#623) |
| `MissileSrvDoFunc` | `5` | `0x6FC61980` | `MISSMODE_SrvDo05_FireWall_MoltenBoulderFirePath` | `moltenboulderfirepath` (#455) |
| `MissileSrvDoFunc` | `6` | `0x6FC61850` | `MISSMODE_SrvDo06_MoltenBoulder_FireWallMaker` | `moltenboulder` (#452) |
| `MissileSrvDoFunc` | `23` | `0x6FC605E0` | `MISSMODE_SrvDo23_24_SuccFireBall_FirestormMaker` | `firestormmaker` (#458) |
| `MissileSrvDoFunc` | `25` | `0x6FC604D0` | `MISSMODE_SrvDo25_EruptionCenter` | `erruption center` (#461) |
| `MissileSrvDoFunc` | `27` | `0x6FC60280` | `MISSMODE_SrvDo27_Tornado` | `tornado` (#478) |
| `MissileSrvDoFunc` | `28` | `0x6FC60070` | `MISSMODE_SrvDo28_Volcano` | `volcano` (#479) |
| `MissileSrvHitFunc` | `47` | `0x6FC5D8C0` | `MISSMODE_SrvHit47_MoltenBoulder` | `moltenboulder` (#452) |
| `MissileSrvHitFunc` | `48` | `0x6FC5C260` | `MISSMODE_SrvHit48_MoltenBoulderEmerge` | `moltenboulderemerge` (#453) |
| `MissileSrvHitFunc` | `51` | `0x6FC5C160` | `MISSMODE_SrvHit51_VolcanoDebris` | `volcano debris 2` (#481) |
| `MissileSrvHitFunc` | `56` | `0x6FC5B210` | `MISSMODE_SrvHit56_ArmageddonControl` | `armageddoncontrol` (#577) |
| `MissileSrvDmgFunc` | `8` | `0x6FC58FF0` | `MISSMODE_SrvDmg08_EruptionCrack` | `erruption crack 1` (#462) |
| `MissileSrvDmgFunc` | `9` | `0x6FC59560` | `MISSMODE_SrvDmg09_Twister` | `twister` (#477) |
| `MissileSrvDmgFunc` | `14` | `0x6FC59A40` | `MISSMODE_SrvDmg14_MoltenBoulder` | `moltenboulder` (#452) |
| `MissileCltDoFunc` | `1` | `0x6FB617C0` | Standard client missile step | `moltenboulderemerge` (#453), `arcticblast1`/`2` (#459/#460), `erruption crack 1` (#462), `twister` (#477), `tornado` (#478), `volcano debris 2` (#481), `armageddonrock` (#578), `armageddontail` (#579), `armageddonfire` (#623) |
| `MissileCltDoFunc` | `5` | `0x6FB62F90` | Ground fire sub-loop renderer | `firestorm` (#457), `moltenboulderfirepath` (#455), `firesmall` (#104), `firemedium` (#105) |
| `MissileCltDoFunc` | `6` | `0x6FB692B0` | Firestorm trail emitter | `firestormmaker` (#458) |
| `MissileCltDoFunc` | `47` | `0x6FB6B470` | Molten Boulder rolling sound + trail wrapper (tail-calls `0x6FB692B0`) | `moltenboulder` (#452) |
| `MissileCltDoFunc` | `48` | `0x6FB675C0` | Fissure client crack + smoke spawner | `erruption center` (#461) |
| `MissileCltDoFunc` | `50` | `0x6FB6B2A0` | Volcano client lobbed debris spawner | `volcano` (#479) |
| `MissileCltDoFunc` | `60` | `0x6FB61C00` | Hurricane orbiting debris caster-tracker | `hurricaneswoosh` (#581), `hurricanerock` (#583), `hurricanetree` (#585) |
| `MissileCltHitFunc` | `52` | `0x6FB6A8F0` | Molten Boulder client explosion + flying rocks | `moltenboulder` (#452) |
| `MissileCltHitFunc` | `53` | `0x6FB65A10` | Molten Boulder emerge -> roll transition | `moltenboulderemerge` (#453) |
| `MissileCltHitFunc` | `55` | `0x6FB65930` | Volcano debris & Armageddon rock client impact spawner | `volcano debris 2` (#481), `armageddonrock` (#578) |

---

## 2. `Skills.txt` & `Missiles.txt` Summary Tables

### 2.1 `Skills.txt` Core Attributes (Druid Elemental #225–#250)

| ID | Skill Name | ReqLvl | `restrict` | `delay` (frames) | `HitShift` | `EType` / Phys | Server Missile(s) | Client Missile(s) | Key Calcs / Synergies |
|---:|---|---:|---:|---:|---:|---|---|---|---|
| **225** | **Firestorm** | 1 | `0` (Human only) | `15` (0.6s) | `2` (4/256) | `fire` | `firestormmaker` (#458) | `firestormmaker` (#458) | `calc1 = ln12` (`Param1=3`); Synergy: `(Molten Boulder.blvl + Eruption.blvl) * 23%` |
| **229** | **Molten Boulder** | 6 | `0` (Human only) | `50` (2.0s) | `8` (256/256) | Phys + `fire` | `moltenboulderemerge` (#453) | `moltenboulderemerge` (#453) | `aurarangecalc = 7`; Phys syn: `Volcano.blvl * 10%`; Fire syn: `Firestorm.blvl * 8%` |
| **230** | **Arctic Blast** | 6 | `0` (Human only) | `0` (channeled) | `2` (4/256) | `cold` (`ELen=100+15/lvl`) | `arcticblast1` (#459) | `arcticblast1` (#459), `arcticblast2` (#460) | `aurarangecalc = ln12/4 - 2` (`Param1=35, Param2=2`); `calc1 = ln12/2`; Syn: `(Cyclone Armor.blvl + Hurricane.blvl) * 15%` |
| **234** | **Eruption** (Fissure) | 12 | `0` (Human only) | `50` (2.0s) | `8` (256/256) | `fire` | `erruption center` (#461) | `erruption center` (#461) | `calc1 = 7` (radius), `calc2 = 6` (period); Syn: `(Firestorm.blvl + Volcano.blvl) * 12%` |
| **235** | **Cyclone Armor** | 12 | `0` (Human only) | `0` | `8` | Absorb (`F/C/L`) | *(State #151)* | *(State #151)* | `aurastatcalc1/2 = (ln12 * (100 + (Twister.blvl + Tornado.blvl + Hurricane.blvl)*7)/100) * 256` (`Param1=40, Param2=12`) |
| **240** | **Twister** | 18 | `0` (Human only) | `0` | `7` (128/256) | Phys + Stun | `twister` (#477) | `twister` (#477) | `calc1 = 3` (missiles), `Param2 = 10` (stun frames); Syn: `(Tornado.blvl + Hurricane.blvl) * 10%` |
| **244** | **Volcano** | 24 | `0` (Human only) | `100` (4.0s) | `8` (256/256) | Phys + `fire` | `volcano` (#479) | `volcano overlay fire` (#480), `volcano` (#479) | `aurarangecalc = 12`, `calc4 = 2`; Phys syn: `Molten Boulder.blvl * 12%`; Fire syn: `(Eruption.blvl + Armageddon.blvl) * 12%` |
| **245** | **Tornado** | 24 | `0` (Human only) | `0` | `8` (256/256) | Phys | `tornado` (#478) | `tornado` (#478) | `calc1 = 1`, `aurarangecalc = 3`, `calc4 = 15` (pulse period); Syn: `(Cyclone Armor.blvl + Twister.blvl + Hurricane.blvl) * 9%` |
| **249** | **Armageddon** | 30 | **`1`** (Shapeshift OK) | `150` (6.0s) | `8` (256/256) | Phys + `fire` | `armageddoncontrol` (#577) | `armageddontail` (#579), `armageddonrock` (#578) | `auralencalc = 250 + Eruption.blvl * 50`, `aurarangecalc = 8`, `Param4 = 8` (meteor period); Fire syn: `(Firestorm.blvl + Molten Boulder.blvl + Volcano.blvl) * 14%` |
| **250** | **Hurricane** | 30 | `0` (Human only) | `150` (6.0s) | `8` (256/256) | `cold` (`ELen=50`) | *(State #144)* | `hurricaneswoosh` (#581), `hurricanerock` (#583), `hurricanetree` (#585) | `auralencalc = 250 + Cyclone Armor.blvl * 50`, `aurarangecalc = 9`, `Param4 = 20` (pulse period); Syn: `(Twister.blvl + Tornado.blvl) * 9%` |

> **Shapeshift Casting Restriction (`restrict` column)**: Among all 10 Elemental skills, **only Armageddon (#249)** has `restrict = 1` (allowing it to be cast while in Werewolf or Werebear form). The other 9 Elemental skills have `restrict = 0` (blank) and are blocked while shapeshifted (`States.txt` `wolf`/`bear` have `restrict = 1`).

---

## 3. Skill-by-Skill Mechanics & Disassembly Analysis

---

### 3.1 Skill #225 — Firestorm

#### Server Cast: `SKILLS_SrvDo117_Firestorm` (`SkillSrvDoFunc[117]` @ `0x6FC656B0`)
1. Evaluates `nCount = SKILLS_EvaluateSkillFormula(pUnit, pSkillsTxtRecord->dwCalc[0], nSkillId, nSkillLevel)`:
   - `calc1 = ln12` with `Param1 = 3`, `Param2 = 0` $\implies$ always `3` missiles (`nCount = 3`).
2. Calls `sub_6FCFE4C0(pGame, pUnit, nSkillId, nSkillLevel, pSkillsTxtRecord->wSrvMissileA, nCount, a7=1)`:
   - Resolves target `(nTargetX, nTargetY)` from the cast coordinates (`SKILLS_GetTargetX_Y`).
   - Because `a7 == 1` (`bCenterStraight == 1`), **missile 0** is launched straight toward `(nTargetX, nTargetY)` via `sub_6FD11420` (`firestormmaker` #458, `Vel=8`, `Range=40`, `CollideType=8` wall-only).
   - The remaining `nCount - 1 = 2` lateral missiles are initialized with `SKILLS_MissileInit_ChargedBolt` (`pInitFunc = SKILLS_MissileInit_ChargedBolt`, `nInitNo = 2 * i`), which assigns `PATHTYPE_CHARGEDBOLT` so the two outer `firestormmaker` emitters weave erratically around the central straight trail!

#### Server Missile Trail: `MISSMODE_SrvDo23_24_SuccFireBall_FirestormMaker` (`MissileSrvDoFunc[23]` @ `0x6FC605E0`)
- `firestormmaker` (#458) advances along its path via `MISSMODE_SrvDo01_BasicMissile` (`0x6FC5F540`).
- Whenever `D2Common_10234(pMissile->pPath) > 0` (the emitter stepped onto a new subtile this frame), it spawns `SubMissile1 = firestorm` (#457) at the emitter's current `(X, Y)` with `dwFlags = 1` (`MISSILE_INIT_OWNER`), inheriting `nSkillId = 225` and `nSkillLevel`.
- **`firestorm` (#457) Damage Math**:
  - `Range = 15` frames, `Size = 2`, `CollideType = 3`, `HitShift = 2` ($4/256$ per frame), `DamageRate = 41`.
  - Base fire damage per frame (`HitShift = 2`):
    $$\text{EMin} = 3 + 3(L_{2..8}) + 5(L_{9..16}) + 7(L_{17..22}) + 14(L_{23..28}) + 21(L_{29+})$$
    $$\text{EMax} = 6 + 3(L_{2..8}) + 6(L_{9..16}) + 8(L_{17..22}) + 15(L_{23..28}) + 23(L_{29+})$$
  - Synergy: `EDmgSymPerCalc = (Molten Boulder.blvl + Eruption.blvl) * 23%`.
  - Because `NextHit = 0`, all 3 trails can damage the same target simultaneously every frame they overlap.

#### Client Cast & Trail (`SkillCltDoFunc[67]` @ `0x6FB79E30` & `MissileCltDoFunc[6]` @ `0x6FB692B0`)
- **`SkillCltDoFunc[67]` (`0x6FB79E30`)**: Evaluates `calc1` (`3`) via `D2Common#10786` (`0x6FDA1BF0`), loads `wCltMissileA = 458` (`firestormmaker`), and invokes shared helper `0x6FB79A50(pUnit, nMissileId, nSkillId, nSkillLevel, nCount, flags=0x200, bCenter=1, bTwister=0)`.
  - Helper `0x6FB79A50` spawns 1 straight center `firestormmaker` (`dwFlags = 0x221`) and 2 Charged-Bolt-path lateral `firestormmaker` missiles (`dwFlags = 0x200 | 0x8120 = 0x8320`, attaching `SKILLS_MissileInit_ChargedBolt` at `0x6FB760A0`).
- **`MissileCltDoFunc[6]` (`0x6FB692B0`)**: When `D2Common#11019` (`0x6FD84910`, path step change) is non-zero on `firestormmaker`:
  - If `pMissile->nOwnerType == UNIT_PLAYER (0)` and `CltSubMissile1` (`firestorm` #457) $\ge 0$, spawns `firestorm` (#457) at current `(X, Y)`.
  - Otherwise (monster-cast Firestorm, e.g. Diablo Clone / Torch proc if non-player), rolls a 1-bit RNG check to pick between `CltSubMissile2` (`firesmall` #104) and `CltSubMissile3` (`firemedium` #105).
  - Evaluates `remainingFrames % CltParam1` (`CltParam1 = 4`): only on every 4th frame does the spawned patch include `dwFlags |= 0x4000` (enabling the looping fire sound) to avoid saturating audio channels.

---

### 3.2 Skill #229 — Molten Boulder

#### Server & Client Launch (`moltenboulderemerge` #453 $\to$ `moltenboulder` #452)
1. **Emerge Phase (`moltenboulderemerge` #453)**:
   - Launched by generic `wSrvMissile` / `wCltMissile` (`srvdofunc = 0`, `cltdofunc = 0`).
   - `Vel = 3`, `Range = 5` frames, `InitSteps = 5`, `CollideType = 8` (walls), `AlwaysExplode = 1`.
   - Travels 5 frames as the emerging boulder animation (`expansion\MoltenBoulderEmerge`), then expires and triggers `pSrvHitFunc = 48` (`0x6FC5C260`) on server and `pCltHitFunc = 53` (`0x6FB65A10`) on client.
2. **Transition (`MISSMODE_SrvHit48_MoltenBoulderEmerge` @ `0x6FC5C260` & `MissileCltHitFunc[53]` @ `0x6FB65A10`)**:
   - Server `0x6FC5C260` checks if `moltenboulderemerge` hit an obstacle (`pTarget || D2Common_10164(pPath)`). If unobstructed, it spawns `HitSubMissile1 = moltenboulder` (#452) with `dwFlags = 0x21` (`MISSILE_INIT_OWNER | MISSILE_INIT_VELOCITY`) along the exact target vector `(TargetX, TargetY)`. If blocked during emerge, it immediately triggers `MISSMODE_SrvHit47_MoltenBoulder` (`0x6FC5D8C0`) to detonate!
   - Client `0x6FB65A10` spawns `CltHitSubMissile1 = moltenboulder` (#452) with `dwFlags = 0x21`, copies `cHitPar1=2` and `cHitPar2=50` into the client path (`[pPath+0x40] = 2`, `[pPath+0x44] = 50`, `pPath->dwFlags |= 4`), calls `0x6FB77C80` (`cHitPar3=10`), and clears path bit `0x2`.

#### Rolling Phase (`moltenboulder` #452)
- **Server Trail (`MISSMODE_SrvDo06_MoltenBoulder_FireWallMaker` @ `0x6FC61850`)**:
  - Advances via `MISSMODE_SrvDo01_BasicMissile` (`Vel = 4`, `Range = 100` frames).
  - On each subtile step (`D2Common_10234(pPath) > 0`), spawns `SubMissile1 = moltenboulderfirepath` (#455) at `(X, Y)`.
  - **`moltenboulderfirepath` (#455)**: `Range = 37` frames, `HitShift = 2`, `DamageRate = 41`, `EMin = 10..`, `EMax = 14..`, `EDmgSymPerCalc = skill('Firestorm'.blvl) * 8`.
- **Client Trail (`MissileCltDoFunc[47]` @ `0x6FB6B470`)**:
  - Checks if `TargetX` (stored in `[pMissile + 0x20]` via `D2Common#11018`) differs from the path's current `dwTargetX` (`[pPath + 0x40]`). If the boulder bounced/changed step, plays `ProgSound = sorceress_fireball_1` (`0x6FB38A70`) and syncs `TargetX`, then tail-jumps (`jmp 0x6FB692B0`) into `MissileCltDoFunc[6]` to spawn visual fire trail patches (`firesmall`/`firemedium`).
- **Knockback & Contact Damage (`MISSMODE_SrvDmg14_MoltenBoulder` @ `0x6FC59A40`)**:
  - When `moltenboulder` (#452) collides with a unit (`pDefender`), `SrvDmgFunc[14]` determines knockback (`pDamage->wResultFlags |= 8`):
    - **Monster (`UNIT_MONSTER`)**: Reads `MonStats2.txt` size flags (`0x100000` = `small`, `0x200000` = `large`).
      - If `small`: Knockback chance = `100 * dParam1 = 100%` (`dParam1 = 1`).
      - If neither `small` nor `large` (medium monster): Knockback chance = `dParam2 = 50%`.
      - If `large`: Knockback chance = `0%` (never knocked back — instead triggers explosion below!).
    - **Player (`UNIT_PLAYER`)**: Knockback chance = `dParam2 = 50%`.
  - Applies contact physical + fire damage from Skill #229 (`MinDam=6`, `MaxDam=12`, `EMin=6`, `EMax=12`, `HitShift=8`, `ResultFlags=5`, `HitFlags=2`).
- **Explosion (`MISSMODE_SrvHit47_MoltenBoulder` @ `0x6FC5D8C0` & `MissileCltHitFunc[52]` @ `0x6FB6A8F0`)**:
  - **Trigger Condition**: When `moltenboulder` hits a `UNIT_MONSTER` whose `MonStats2` flags have `large` (`0x200000`) set, **or** when it hits a wall/expires (`pTarget == NULL`), it detonates! (If it hits a small/medium monster or player, `SrvHit47` returns `0` so the boulder keeps rolling through them!)
  - **Radial Splash**: Evaluates `nRange = SKILLS_EvaluateSkillFormula(pOwner, aurarangecalc, 229, lvl)` (`aurarangecalc = Param1 = 7` subtiles), computes full physical + fire skill damage (`sub_6FD14EC0`), and calls `sub_6FD10200` (`aurafilter = 0x583`) to deal radial physical + fire splash damage to all enemies within 7 subtiles.
  - Spawns a 3-point triangle of `HitSubMissile1 = moltenboulderfirepath` (#455) around the impact point (`sHitPar2 = 1`).
  - Client `MissileCltHitFunc[52]` (`0x6FB6A8F0`) checks the same `MonStats2` `large` flag (via `0x6FAB1510` with `edx=11`), spawns `CltHitSubMissile1 = moltenboulderexplode` (#454), and calls `0x6FB65B70` to scatter `cHitPar1 = 10` to `cHitPar2 = 15` `moltenboulder-flyingrocks` (#456) and `moltenboulderfirepath` (#455) fragments.

---

### 3.3 Skill #230 — Arctic Blast

#### Server Channeling (`SKILLS_SrvSt11_Inferno_ArcticBlast` @ `0x6FC64550` & `SKILLS_SrvDo019_Inferno_ArcticBlast` @ `0x6FC64390`)
- **`SrvStFunc[11]` (`0x6FC64550`)**:
  - Verifies mana against `startmana = 6`.
  - Sets `STATE_INFERNO` (`id = 12`) on the Druid (`D2Common_10494` / `STATES_ToggleState`).
  - Transitions the Druid into `PLRMODE_SEQUENCE` (`seqnum = 18`, `seqinput = 10`), storing the loop frame counter in the `EVENTTYPE_MODECHANGE` event (`sub_6FD13220(..., 8)`).
- **`SrvDoFunc[19]` (`0x6FC64390`)**:
  - Executed repeatedly during the channeling sequence (`repeat = 1`).
  - Evaluates dynamic missile lifetime/range:
    $$\text{nSubRange} = \text{aurarangecalc} = \lfloor \text{ln12} / 4 \rfloor - 2 = \lfloor (35 + 2(L-1)) / 4 \rfloor - 2$$
    (At $L=1$, $\lfloor 35/4 \rfloor - 2 = 6$ frames; at $L=20$, $\lfloor 73/4 \rfloor - 2 = 16$ frames.)
  - Spawns `srvmissilea = arcticblast1` (#459, `Vel = 12`, `CollideType = 3`, `HitShift = 2`, `DamageRate = 41`, `ResultFlags = 4`) using `sub_6FD11710` with custom `nRange = nSubRange`.
  - Deducts per-tick mana cost (`mana = 24`, `lvlmana = 1`, `manashift = 2`, i.e. $\frac{24 + (L-1)}{64}$ mana per tick). If mana runs out, clears `STATE_INFERNO` and terminates the sequence.
- **Cold Damage & Chill Math**:
  - `HitShift = 2` ($4/256$ per frame), `DamageRate = 41`.
  - `ELen = 100 + 15(L-1)` frames ($4.0\text{s}$ at $L=1$, $+0.6\text{s}$ per level).
  - Synergy: `EDmgSymPerCalc = (Cyclone Armor.blvl + Hurricane.blvl) * 15%`.

#### Client Channeling (`SkillCltStFunc[15]` @ `0x6FB240F0` & `SkillCltDoFunc[24]` @ `0x6FB24D50`)
- **`SkillCltStFunc[15]` (`0x6FB240F0`)**: Checks `STATE_INFERNO` (`0xC`); if not yet active, applies `prgoverlay = arctic_blast_cast` (`0x6FB1B300`) and starts `prgsound = druid_windcast` (`0x6FB38A70`). Allocates or updates the client Inferno tracker (`D2Common#11013` / `D2Common#10871`) and sets sequence frame speed `0x500` (`[pUnit+0x48] = 0x500`).
- **`SkillCltDoFunc[24]` (`0x6FB24D50`)**: Thin wrapper around `0x6FB24930`, spawning alternating `cltmissilea = arcticblast1` (#459) and `cltmissileb = arcticblast2` (#460) with range `aurarangecalc`.

---

### 3.4 Skill #234 — Fissure (`Eruption`)

#### Server Cast & Spawner (`SKILLS_SrvDo028` @ `0x6FC62D90` & `MISSMODE_SrvDo25_EruptionCenter` @ `0x6FC604D0`)
1. **Cast (`SkillSrvDoFunc[28]` @ `0x6FC62D90`)**:
   - Reads target `(X, Y)` (`SearchOpenXY = 1`, `LineOfSight = 4`).
   - Spawns `srvmissilea = erruption center` (#461) at `(X, Y)` (`Range = 80` frames = 3.2 seconds).
2. **Vent Spawner (`MissileSrvDoFunc[25]` @ `0x6FC604D0`)**:
   - Evaluates `nRadius = calc1 = Param1 = 7` subtiles and `nPeriod = max(1, calc2) = Param2 = 6` frames.
   - Checks `D2Common_10985_MISSILE_GetRemainingFrames(pMissile) % 6 == 0`.
   - On every 6th frame (13 vents over 80 frames), seeds a local `D2SeedStrc` deterministically:
     ```c
     SEED_InitLowSeed(&seed, D2Common_10985_MISSILE_GetRemainingFrames(pMissile) + CLIENTS_GetUnitX(pMissile));
     ```
   - Rolls `(offsetX, offsetY)` in $[-(nRadius - 1), +(nRadius - 1)] = [-6, +6]$ subtiles:
     ```c
     nX = CLIENTS_GetUnitX(pMissile) - 7 + ITEMS_RollLimitedRandomNumber(&seed, 2 * (7 - 1));
     nY = CLIENTS_GetUnitY(pMissile) - 7 + ITEMS_RollLimitedRandomNumber(&seed, 2 * (7 - 1));
     ```
   - Checks walkability/collision at `(nX, nY)` with mask `0x45` (`D2Common_10482`). If clear (`== 0`), spawns `SubMissile1 = erruption crack 1` (#462) at `(nX, nY)` with `dwFlags = 1`.
3. **Crack Damage & Overlay (`erruption crack 1` #462 & `MISSMODE_SrvDmg08_EruptionCrack` @ `0x6FC58FF0`)**:
   - `Range = 84` frames (3.36s), `Size = 3`, `CollideType = 3`, `Collision = 1`, `NextHit = 1`, `NextDelay = 5` frames (0.2s per-unit hit cooldown).
   - `HitShift = 8` (full skill damage per vent hit, **not** per-frame fire damage!):
     $$\text{EMin} = 15 + 6(L_{2..8}) + 12(L_{9..16}) + 16(L_{17..22}) + 18(L_{23..28}) + 22(L_{29+})$$
     $$\text{EMax} = 25 + 6(L_{2..8}) + 12(L_{9..16}) + 16(L_{17..22}) + 19(L_{23..28}) + 23(L_{29+})$$
   - Synergy: `(Firestorm.blvl + Volcano.blvl) * 12%`.
   - On hit, `MISSMODE_SrvDmg08_EruptionCrack` (`0x6FC58FF0`) applies `ProgOverlay = fire_hit` (`UNITS_SetOverlay(pDefender, wProgOverlay, 0)`).

#### Client Cast & Spawner (`SkillCltDoFunc[28]` @ `0x6FB23DF0` & `MissileCltDoFunc[48]` @ `0x6FB675C0`)
- **`SkillCltDoFunc[28]` (`0x6FB23DF0`)**: Sets unit flag `0x40` (`[pUnit+0xC4] |= 0x40`), resolves `cltmissilea = erruption center` (#461), and calls `0x6FB51540` to spawn it at the target coordinates.
- **`MissileCltDoFunc[48]` (`0x6FB675C0`)**: Uses the **exact same deterministic seed formula** (`remainingFrames + X`) and `[-7, +5]` (`2*(7-1)`) random roll as the server, verifies collision mask `0x45` (`D2Common#10482`), and spawns both `CltSubMissile1 = erruption crack 1` (#462, setting client flag `0x10000` at `[pCrack+0xC4]`) and `CltSubMissile2 = erruption smoke 1` (#464) in lockstep with the server!

---

### 3.5 Skill #235 — Cyclone Armor

#### Server Cast: `SKILLS_SrvDo018_DefensiveBuff` (`SkillSrvDoFunc[18]` @ `0x6FC628F0`)
1. Sets `aurastate = cyclonearmor` (`STATE_CYCLONEARMOR = 151`) on the Druid (`STATES_ToggleState(pUnit, 151, 1)`).
2. Removes any existing stat list bound to state 151 (`D2Common_10319`), allocates a new `D2StatListEx` (`dwFlags = 0` — permanent until broken; `auralencalc` is empty), and links it to `STATE_CYCLONEARMOR`.
3. Calls `sub_6FCFE0E0` to evaluate and attach `aurastat1` (`STAT_BONEARMOR`) and `aurastat2` (`STAT_BONEARMORMAX`):
   $$\text{AbsorbHP}_{256} = \left\lfloor \frac{\text{ln12} \times (100 + (\text{Twister.blvl} + \text{Tornado.blvl} + \text{Hurricane.blvl}) \times 7)}{100} \right\rfloor \times 256$$
   where $\text{ln12} = 40 + 12(L-1)$ (`Param1 = 40`, `Param2 = 12`). Note the `* 256` factor (`HitShift = 8` fixed-point life units).
4. Registers unit event `auraevent1 = absorbdamage` (`UNITEVENT_ABSORBDAMAGE`) mapped to `auraeventfunc1 = 25` (`D2GAME_EventFunc25`).
5. Triggers `States.txt` `setfunc = 8` (`remfunc = 5`) on client/server to display the 3-tier Cyclone Armor overlays (`cyclonearmor1front`, `cyclonearmor2front`, `cyclonearmor3front`).

#### Damage Absorption: `D2GAME_EventFunc25` (`SkillDruid.cpp`)
When the Druid takes damage (`UNITEVENT_ABSORBDAMAGE`), `D2GAME_EventFunc25` executes:
1. Reads current `nArmor = STATLIST_UnitGetStatValue(pUnit, STAT_BONEARMOR, 0)` and `nMaxArmor = STATLIST_UnitGetStatValue(pUnit, STAT_BONEARMORMAX, 0)`.
2. Absorbs incoming elemental damage in **strict sequential order**:
   - **Step 1 — Fire (`pDamage->dwFireDamage`)**:
     ```c
     nAbsorbed = min(pDamage->dwFireDamage, nArmor);
     nArmor -= nAbsorbed;
     pDamage->dwFireDamage -= nAbsorbed;
     ```
   - **Step 2 — Cold (`pDamage->dwColdDamage`)**:
     ```c
     nAbsorbed = min(pDamage->dwColdDamage, nArmor);
     nArmor -= nAbsorbed;
     pDamage->dwColdDamage -= nAbsorbed;
     ```
   - **Step 3 — Lightning (`pDamage->dwLtngDamage`)**:
     ```c
     nAbsorbed = min(pDamage->dwLtngDamage, nArmor);
     nArmor -= nAbsorbed;
     pDamage->dwLtngDamage -= nAbsorbed;
     ```
   > **Important**: Cyclone Armor **never** absorbs Physical (`dwPhysDamage`), Magic (`dwMagDamage`), or Poison (`dwPoisDamage`) damage, and it does **not** reduce Cold/Freeze duration (`wColdLen`/`wFreezeLen`) unless Cold damage is relevant to hit processing.
3. **Overlay Tier Update & State Removal**:
   - Writes updated `nArmor` back into the stat list (`D2Common_10466_STATLIST_SetBaseStat`).
   - If `nArmor <= 0`: removes `STATE_CYCLONEARMOR` (`STATES_ToggleState(pUnit, 151, 0)`) and frees the stat list (`D2Common_10474`).
   - Otherwise, compares old percentage `100 * nOldArmor / nMaxArmor` vs new percentage `100 * nArmor / nMaxArmor`. If the difference is $\ge 5\%$, calls `D2GAME_STATES_SendState_6FCDF840(pUnit, 151, 0)` so the client updates the visual Cyclone Armor wind ring tier (`overlay1..3`).

---

### 3.6 Skills #240 (Twister) & #245 (Tornado)

#### Shared Server Cast: `SKILLS_SrvDo118_Twister_Tornado` (`SkillSrvDoFunc[118]` @ `0x6FC65600`)
Both Twister and Tornado use `SkillSrvDoFunc[118]`:
1. Evaluates `nCount = calc1` (`3` for Twister, `1` for Tornado).
2. Calls `sub_6FCFE4C0(pGame, pUnit, nSkillId, nSkillLevel, wSrvMissileA, nCount, a7=0)`:
   - Because `a7 == 0` (`bCenterStraight == 0`), **every** missile (including the single Tornado!) is initialized with `pInitFunc = SKILLS_MissileInit_ChargedBolt` (`PATHTYPE_CHARGEDBOLT`).
   - This is why Tornado's path weaves unpredictably just like a Charged Bolt rather than flying in a straight line!

#### Twister (#240) Missile & Stun (`twister` #477 & `MISSMODE_SrvDmg09_Twister` @ `0x6FC59560`)
- **`twister` (#477)**: `Vel = 10`, `Range = 50` frames (2.0s), `Size = 2`, `CollideType = 3`, `NextHit = 1`, `NextDelay = 25` frames (1.0s per-unit hit cooldown).
- **Physical Damage**: `HitShift = 7` ($128/256 = 0.5\times$ column values):
  $$\text{PhysMin} = \lfloor (12 + 4(L_{2..8}) + 7(L_{9..16}) + 10(L_{17..22}) + 13(L_{23..28}) + 16(L_{29+})) \times (1 + 0.10 \times (\text{Tornado.blvl} + \text{Hurricane.blvl})) \rfloor \times 128$$
- **Stun (`MissileSrvDmgFunc[9]` @ `0x6FC59560`)**:
  - Reads `nStunLen = Skills.txt[240].Param2 = 10` frames (0.4 seconds).
  - Sets `pDamage->dwStunLen += 10` and `pDamage->dwHitClass = 0x60`.
- **Client Launch (`SkillCltDoFunc[68]` @ `0x6FB79D80`)**: Calls `0x6FB79A50(..., flags=0, bCenter=0, bTwister=1)`, which spreads the 3 Twister targets laterally by $\pm\Delta Y / 8$ and $\pm\Delta X / 8$ perpendicular to the cast direction so the 3 twisters fan out.

#### Tornado (#245) Periodic Pulse + Collision (`tornado` #478 & `MISSMODE_SrvDo27_Tornado` @ `0x6FC60280`)
- **`tornado` (#478)**: `Vel = 8`, `Range = 75` frames (3.0s), `Size = 3`, `CollideType = 3`, `NextHit = 1`, `NextDelay = 25` frames (1.0s collision cooldown).
- **Dual Damage Mechanism in `MissileSrvDoFunc[27]` (`0x6FC60280`)**:
  1. **Periodic Radial Pulse (ignores `NextDelay`!)**:
     - Evaluates `nPeriod = max(1, calc4) = Param1 = 15` frames (0.6s) and `nRadius = max(1, aurarangecalc) = Param2 = 3` subtiles.
     - Checks `D2Common_10985_MISSILE_GetRemainingFrames(pMissile) % 15 == 0`.
     - On frames `75, 60, 45, 30, 15`, calls `sub_6FD0FE80(pGame, pOwner, X, Y, nRadius=3, nSkillId=245, nSkillLevel, nFilter=42371)` (`aurafilter = 0xA583`), dealing full Tornado physical damage (`ResultFlags = 5`, `HitFlags = 2`, `HitShift = 8`) to all valid enemies within 3 subtiles of the Tornado's center!
  2. **Standard Missile Collision (`MISSMODE_SrvDo01_BasicMissile`)**:
     - After checking the periodic pulse, calls `MISSMODE_SrvDo01_BasicMissile`, which moves the Tornado and applies standard missile collision damage gated by `NextHit = 1` / `NextDelay = 25` frames.
- **Client Launch (`SkillCltDoFunc[69]` @ `0x6FB79CD0`)**: Calls `0x6FB79A50(..., flags=0, bCenter=0, bTwister=0)` for 1 Charged-Bolt-path `tornado` missile.

---

### 3.7 Skill #244 — Volcano

#### Server Cast & Client Sync (`SKILLS_SrvDo123_Volcano` @ `0x6FC652C0` & `SkillCltDoFunc[91]` @ `0x6FB794E0`)
1. **Server (`0x6FC652C0`)**:
   - Resolves target `(X, Y)` (`SearchOpenXY = 1`, `LineOfSight = 4`).
   - Rolls a 32-bit random seed `nSeed = ITEMS_RollRandomNumber(&pUnit->pSeed)`.
   - Spawns `srvmissilea = volcano` (#479, `Range = 150` frames = 6.0s) at `(X, Y)` with `dwFlags = 1`, and stores `nSeed` inside the missile's `nTargetX` field (`MISSILE_SetTargetX(pMissile, nSeed)`).
   - Broadcasts server-to-client skill packet via `sub_6FCC6300(pUnit, 1, 244, nSkillLevel, X, Y, nSeed)`, which invokes `cltprgfunc1 = 91` (`SkillCltDoFunc[91]` @ `0x6FB794E0`) on the client.
2. **Client (`0x6FB794E0`)**:
   - Reads `(X, Y)` via `0x6FB51340`.
   - Spawns `cltmissilea = volcano overlay fire` (#480, `Range = 150`) and `cltmissileb = volcano` (#479, `Range = 150`) at `(X, Y)`, copying the server's `nSeed` (`[pUnit+0x28]`) into `volcano`'s `nTargetX` via `D2Common#10637` (`0x6FDB9FB0`).

#### Eruption Loop (`MISSMODE_SrvDo28_Volcano` @ `0x6FC60070` & `MissileCltDoFunc[50]` @ `0x6FB6B2A0`)
Both server (`0x6FC60070`) and client (`0x6FB6B2A0`) execute identical logic every frame on `volcano` (#479):
1. **Active Eruption Window**:
   - Reads `nRemaining = D2Common_10985_MISSILE_GetRemainingFrames(pMissile)` (starts at `150`, counts down to `0`).
   - Checks `Param3 < nRemaining && nRemaining < Param4` (`2 < nRemaining < 128`, i.e., active for 125 frames from frame 23 to frame 147 of its 150-frame life) and `nRemaining % calc4 == 0` (`calc4 = Param2 = 2` frames).
   - Thus Volcano launches **1 molten boulder debris every 2 frames** (62 boulders total per cast)!
2. **Deterministic Trajectory Roll**:
   - Loads the shared RNG seed from `MISSILE_GetTargetX(pMissile)` into a local `D2SeedStrc` (`SEED_InitLowSeed`), rolls:
     ```c
     nOffsetX = ITEMS_RollLimitedRandomNumber(&seed, 2 * nRadius + 1) - nRadius; // nRadius = aurarangecalc = 12 -> [-12, +12]
     nOffsetY = ITEMS_RollLimitedRandomNumber(&seed, 2 * nRadius + 1) - nRadius; // [-12, +12]
     ```
   - Saves the updated `seed.nLowSeed` back into `MISSILE_SetTargetX(pMissile, seed.nLowSeed)`.
3. **Lobbed Debris Launch (`volcano debris 2` #481)**:
   - Server spawns `SubMissile1 = volcano debris 2` (#481, `Range = 16`, `Vel = 14`) with `dwFlags = 0x520` (`1312`: `MISSILE_INIT_VELOCITY | MISSILE_INIT_BALLISTIC | MISSILE_INIT_GFXARG`) and `nGfxArg = Param5 = 30` (parabolic arc height/gravity parameter).
   - Client (`0x6FB6B2A0`) calls `0x6FB69A80` with `CltParam5 = 30` to launch the matching client ballistic rock.
4. **Volcano Base Direct Collision**:
   - `volcano` (#479) itself has `Collision = 1`, `Size = 3`, `NextHit = 1`, `NextDelay = 10` frames, `KnockBack = 1`, dealing Volcano's physical + fire damage directly to any unit standing on top of the cone!

#### Debris Impact (`MISSMODE_SrvHit51_VolcanoDebris` @ `0x6FC5C160` & `MissileCltHitFunc[55]` @ `0x6FB65930`)
- When `volcano debris 2` (#481) lands after 16 frames:
  - Server `0x6FC5C160` spawns `HitSubMissile1 = volcano small fire` (#483, `Range = 18` frames, `Size = 2`, `NextHit = 1`, `NextDelay = 5` frames, `Skill = Volcano`), which deals Volcano's full physical (`MinDam=8..`, `MaxDam=10..`) + fire (`EMin=8..`, `EMax=10..`) damage on contact!
  - Client `0x6FB65930` spawns `CltHitSubMissile1 = volcano explosion` (#482) and `CltHitSubMissile2 = volcano small fire` (#483).

---

### 3.8 Skills #249 (Armageddon) & #250 (Hurricane)

#### Shared Server Cast: `SKILLS_SrvDo124_Armageddon_Hurricane` (`SkillSrvDoFunc[124]` @ `0x6FC65CE0`)
Both level-30 elemental duration spells share `SkillSrvDoFunc[124]`:
1. Evaluates `nDuration = auralencalc`:
   - **Armageddon (#249)**: `250 + skill('Eruption'.blvl) * 50` frames ($10\text{s} + 2\text{s}$ per base level in Fissure; max $50\text{s}$).
   - **Hurricane (#250)**: `250 + skill('Cyclone Armor'.blvl) * 50` frames ($10\text{s} + 2\text{s}$ per base level in Cyclone Armor; max $50\text{s}$).
2. Enables `aurastate` (`STATE_ARMAGEDDON = 145` or `STATE_HURRICANE = 144`) on the Druid (`STATES_ToggleState`).
3. Creates or updates a timed `D2StatListEx` (`dwFlags = 0x40`) expiring at `dwGameFrame + nDuration` with expire callback `sub_6FD10E50`.
4. Schedules `EVENTTYPE_ACTIVESTATE` (`nEvent = 10`) at `dwGameFrame + Param4` (`Param4 = 8` frames for Armageddon, `Param4 = 20` frames for Hurricane), storing `nSkillId` and `nSkillLevel` on the active state tracker (`sub_6FCFE200`).

#### Armageddon Active State Tick (`SKILLS_SrvDo146_Unused` @ `0x6FC65850` via `States.txt` `srvactivefunc=146`)
Every `Param4 = 8` frames (0.32s) while `STATE_ARMAGEDDON` (145) is active:
1. Evaluates `nRadius = aurarangecalc = Param3 = 8` subtiles.
2. Loops up to **5 attempts** (`v18 = 0..4`) to find a valid impact point around the Druid's current position:
   ```c
   nTargetX = CLIENTS_GetUnitX(pUnit) + ITEMS_RollLimitedRandomNumber(&pUnit->pSeed, 2 * nRadius + 1) - nRadius; // [-8, +8]
   nTargetY = CLIENTS_GetUnitY(pUnit) + ITEMS_RollLimitedRandomNumber(&pUnit->pSeed, 2 * nRadius + 1) - nRadius; // [-8, +8]
   ```
   Checks `D2Common_10935` (radial LOS from Druid to `(nTargetX, nTargetY)`). Breaks on the first valid point.
3. Rolls 1 of `srvmissilea`/`b`/`c` (`armageddoncontrol` #577, all 3 slots are #577) and spawns it at `(nTargetX, nTargetY)` with `dwFlags = 1` (`Range = 25` frames = 1.0s delay before impact).
4. Broadcasts `sub_6FCC62D0(pUnit, 1, 249, nSkillLevel, nTargetX, nTargetY, 0)` to invoke `cltprgfunc1 = 92` (`SkillCltDoFunc[92]` @ `0x6FB795F0`) on clients!
5. Reschedules `EVENTTYPE_ACTIVESTATE` for `dwGameFrame + 8`.

#### Armageddon Client Meteor Fall (`SkillCltDoFunc[92]` @ `0x6FB795F0`) & Impact (`MISSMODE_SrvHit56_ArmageddonControl` @ `0x6FC5B210`)
- **Client Sky Fall (`0x6FB795F0`)**:
  - Evaluates `nFrames = cltcalc1 = 25`, `nFallRate = cltcalc2 = 25`, `nSlideRate = cltcalc3 = 15`.
  - Computes initial sky offset: `nStartZ = nFrames * nFallRate = 625` and `nStartXOffset = nFrames * nSlideRate = 375`.
  - Spawns `cltmissilea = armageddontail` (#579) and `cltmissileb = armageddonrock` (#578) at `(nTargetX, nTargetY)`, sets their starting height via `0x6FB77E30(nFrames=25, nStartZ=625)`, and writes fixed-point 3D velocity into their client paths (`[pPath+0x10] = (-nSlideRate) << 11`, `[pPath+0x14] = 0`, `[pPath+0x18] = (-nFallRate) << 11`), causing the meteor and its fire tail to fall diagonally from upper-left to the target subtile in 25 frames!
  - On landing (frame 25), `armageddonrock` (#578) triggers `MissileCltHitFunc[55]` (`0x6FB65930`) to spawn `armageddonexplosion` (#580) and `armageddonfire` (#623).
- **Server Impact (`MissileSrvHitFunc[56]` @ `0x6FC5B210`)**:
  - When `armageddoncontrol` (#577) expires at 25 frames:
  - Computes Armageddon's physical (`MinDam=4..`, `MaxDam=16..`, **no synergy**) + fire (`EMin=25..`, `EMax=75..`, `+14%` per base level of Firestorm, Molten Boulder, and Volcano) damage (`HitShift = 8`).
  - Deals radial splash damage within `sHitPar1 = 3` subtiles via `sub_6FD10200` (`aurafilter = 0x583`).
  - Spawns up to 5 `HitSubMissile1 = armageddonfire` (#623) ground fire patches at offsets `(-2,0), (0,0), (+2,0), (0,-2), (0,+2)` if unobstructed (`D2Common_10482(..., 0x1C09) == 0`).
  - **`armageddonfire` (#623)**: `Range = 37` frames, `HitShift = 2`, `DamageRate = 41`, `EDmgSymPerCalc = (Firestorm.blvl + Molten Boulder.blvl + Volcano.blvl) * 7%`.

#### Hurricane Active State Tick (`SKILLS_SrvDo145_Unused` @ `0x6FC65AF0` & `SkillCltDoFunc[90]` @ `0x6FB79BE0`)
- **Server (`SkillSrvDoFunc[145]` @ `0x6FC65AF0` via `States.txt` `srvactivefunc=145`)**:
  - Fires every `Param4 = 20` frames (0.8 seconds) while `STATE_HURRICANE` (144) is active.
  - Evaluates `nRadius = aurarangecalc = Param3 = 9` subtiles (`6` yards).
  - Rolls Hurricane cold damage (`EMin = 25..`, `EMax = 50..`, `HitShift = 8`, `+9%` per base level in Twister and Tornado, `ELen = 50` frames = 2.0s chill) via `sub_6FD10360` and applies it to all valid enemies within 9 subtiles (`aurafilter = 42883 = 0xA783`) via `sub_6FD0FAA0`.
  - Reschedules `EVENTTYPE_ACTIVESTATE` for `dwGameFrame + 20`.
- **Client (`SkillCltDoFunc[90]` @ `0x6FB79BE0` via `States.txt` `cltactivefunc=90`)**:
  - Called every frame on the client while `STATE_HURRICANE` (144) is active.
  - Checks if the Druid is in town (`D2Common#10057`): if in town, stops `prgsound = druid_hurricane` (`0x6FB38C20`) and returns `0` without spawning debris.
  - If outside town, ensures `druid_hurricane` looping sound is playing (`0x6FB38A70`), evaluates `cltcalc1 = 3`, and loops `3` times calling `0x6FB797D0` 3 times per iteration (`9` total attempts) to maintain orbiting client-only debris missiles (`cltmissilea = hurricaneswoosh` #581, `cltmissileb = hurricanerock` #583, `cltmissilec = hurricanetree` #585).
  - **`MissileCltDoFunc[60]` (`0x6FB61C00`)**: Updates each orbiting Hurricane debris missile. Every 2 frames (`remainingFrames & 1 == 0`), it computes the delta between the owner Druid's current `(X, Y)` and the missile's stored center `(TargetX, TargetY)` (`D2Common#11018` / `#10818`) and shifts the missile's path target (`D2Common#10286` / `#10334`) so the entire cyclone vortex smoothly translates along with the moving Druid!
