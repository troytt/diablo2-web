# Druid Summoning Skills (`Skills.txt` #221, #222, #226, #227, #231, #236, #237, #241, #246, #247) — Complete Server, Client & AI Reverse-Engineering Reference (1.13c)

> **Ground Truth Binary / MPQ Data Sources**:
> - `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`)
> - `D2Client.dll` v1.13c (`ImageBase = 0x6FAB0000`)
> - `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`)
> - `Skills.txt`, `Missiles.txt`, `PetType.txt`, `MonStats.txt`, `States.txt` (1.13c `patch_d2.mpq`)

---

## 1. Dispatch Tables (1.13c Virtual Addresses)

### 1.1 `D2Game.dll` Skill, Sub-Skill & Missile Server Dispatch (`ImageBase = 0x6FC20000`)
- **`SkillSrvStFunc` base**: `0x6FD27338`
- **`SkillSrvDoFunc` base**: `0x6FD274A8`
- **`MissileSrvDoFunc` base**: `0x6FD2D970`
- **`MissileSrvHitFunc` base**: `0x6FD2DA48`

| Table | Index | 1.13c VA | Symbol / Role | Used By |
|---|---:|---|---|---|
| `SkillSrvStFunc` | `32` | `0x6FC473C0` | `SKILLS_SrvSt32_..._BearSmite` | Grizzly sub-skill `BearSmite` (#326) |
| `SkillSrvStFunc` | `63` | `0x6FC2D170` | `SKILLS_SrvSt63_Corpse_VineCycler` | Vine sub-skills `CorpseCycler` (#307), `VineCycler` (#325) |
| `SkillSrvDoFunc` | `2` | `0x6FCC3220` | `SKILLS_SrvDo002_..._BearSmite` | Grizzly sub-skill `BearSmite` (#326) |
| `SkillSrvDoFunc` | `65` | `0x6FCBA8D0` | `SKILLS_SrvDo065_BasicAura` | Totem sub-skills `Barbs Aura` (#296), `Wolverine Aura` (#297), `Oak Sage Aura` (#298) |
| `SkillSrvDoFunc` | `98` | `0x6FCD46B0` | `SKILLS_SrvDo098_MonTeleport` | Wolf sub-skill `Teleport 2` (#292) |
| `SkillSrvDoFunc` | `114` | `0x6FC668A0` | `SKILLS_SrvDo114_Raven` | Raven (#221) |
| `SkillSrvDoFunc` | `115` | `0x6FC66720` | `SKILLS_SrvDo115_Vines` | Poison Creeper (`Plague Poppy` #222), Carrion Vine (`Cycle of Life` #231), Solar Creeper (`Vines` #241) |
| `SkillSrvDoFunc` | `119` | `0x6FC66560` | `SKILLS_SrvDo119_DruidSummon` | Oak Sage (#226), Summon Spirit Wolf (#227), Heart of Wolverine (#236), Summon Dire Wolf (`Summon Fenris` #237), Spirit of Barbs (#246), Summon Grizzly (#247) |
| `SkillSrvDoFunc` | `130` | `0x6FC2D7B0` | `SKILLS_SrvDo130_VineAttack` | Poison Creeper sub-skill `Vine Attack` (#294) |
| `SkillSrvDoFunc` | `137` | `0x6FC2DD50` | `SKILLS_SrvDo137_FenrisRage` | Dire Wolf sub-skill `fenris rage` (#314) |
| `MissileSrvDoFunc` | `26` | `0x6FC60420` | `MISSMODE_SrvDo26_Vines_PlagueVines` | `vines` (#471), `plague vines` (#474) |
| `MissileSrvDoFunc` | `29` | `0x6FC5FED0` | `MISSMODE_SrvDo29_RecyclerDelay` | `recycler delay` (#498) (Carrion Vine HP heal) |
| `MissileSrvDoFunc` | `33` | `0x6FC5FD30` | `MISSMODE_SrvDo33_VineRecyclerDelay` | `vine recycler delay` (#540) (Solar Creeper Mana heal) |
| `MissileSrvHitFunc` | `16` | `0x6FC5EC10` | `MISSMODE_SrvHit16_SpiderGoo_VinesTrail` | `vines trail` (#472), `vines wither` (#473) |
| `MissileSrvHitFunc` | `50` | `0x6FC591A0` | `MISSMODE_SrvHit50_PlagueVinesTrail` | `plague vines trail` (#475) |

### 1.2 `D2Client.dll` Skill, State & Missile Client Dispatch (`ImageBase = 0x6FAB0000`)
- **`SkillCltStFunc` base**: `0x6FB8E928`
- **`SkillCltDoFunc` base**: `0x6FB8EA48`
- **`MissileCltDoFunc` base**: `0x6FB8D8A0`
- **`MissileCltHitFunc` base**: `0x6FB8DA10`

| Table | Index | 1.13c VA | Role | Used By |
|---|---:|---|---|---|
| `SkillCltStFunc` | `48` | `0x6FB74550` | Wolf `Teleport 2` client start | `Teleport 2` (#292) |
| `SkillCltStFunc` | `49` | `0x6FB75C70` | Vine attack / corpse recycle client pod + missile spawner | `Vine Attack` (#294), `CorpseCycler` (#307), `VineCycler` (#325) |
| `SkillCltStFunc` | `51` | `0x6FB74990` | Dire Wolf corpse-eat target resolver | `fenris rage` (#314) |
| `SkillCltDoFunc` | `73` | `0x6FB744D0` | Wolf `Teleport 2` client arrival | `Teleport 2` (#292) |
| `SkillCltDoFunc` | `79` | `0x6FB742B0` | Dire Wolf corpse explosion client fx (`corpseexplosion`) | `fenris rage` (#314) |
| `SkillCltDoFunc` | `89` | `0x6FB750F0` | Underground vine pod active-state renderer (`States.txt` `cltactivefunc=89`) | `STATE_VINE_BEAST` (#150) |
| `SkillCltDoFunc` | `93` | `0x6FB75670` | Corpse recycler progressive client callback (`cltprgfunc1=93`) | `CorpseCycler` (#307), `VineCycler` (#325) |
| `MissileCltDoFunc` | `49` | `0x6FB62720` | Vine trail emitter (`vines` #471, `plague vines` #474) | `vines` (#471), `plague vines` (#474) |
| `MissileCltDoFunc` | `51` | `0x6FB673E0` | Corpse recycle vine + guts explosion + owner heal overlay spawner | `recycler delay` (#498), `vine recycler delay` (#540) |
| `MissileCltHitFunc` | `54` | `0x6FB60EE0` | Vine trail $\to$ wither transition | `vines trail` (#472), `plague vines trail` (#475) |
| `MissileCltHitFunc` | `56` | `0x6FB65850` | Recycler vine $\to$ fade transition | `recycler vine` (#499) |

### 1.3 Monster AI Dispatch (`AiThink.cpp`)

| AI Function ID | Symbol | `MonStats.txt` AI | Summoned Monsters |
|---:|---|---|---|
| `107` | `AITHINK_Fn107_Raven` | `Raven` | `druidhawk` (#419) |
| `108` | `AITHINK_Fn108_DruidWolf` | `DruidWolf` | `spiritwolf` (#420), `fenris` (#421) |
| `109` | `AITHINK_Fn109_Totem` | `Totem` | `oaksage` (#424), `heartofwolverine` (#423), `spiritofbarbs` (#422) |
| `110` | `AITHINK_Fn110_Vines` | `Vines` | `plaguepoppy` (#425) |
| `111` | `AITHINK_Fn111_CycleOfLife` | `CycleOfLife` | `cycleoflife` (#426), `vinecreature` (#427) |
| `112` | `AITHINK_Fn112_DruidBear` | `DruidBear` | `druidbear` (#428) |

---

## 2. `PetType.txt`, `Skills.txt` & `MonStats.txt` Reference Tables

### 2.1 `PetType.txt` Grouping & Mutual Exclusivity

All 10 Druid Summoning skills have `InTown = 1` and `restrict = 1` (castable in town and while shapeshifted in Werewolf/Werebear form).

| `pet type` | `idx` | `group` | `petmax` Formula | Skills / Monsters | Coexistence Rule |
|---|---:|---:|---|---|---|
| `raven` | `10` | *(None)* | `min(lvl, 5)` | #221 Raven (`druidhawk` #419) | Coexists with all other pets (`unsummon = 0`) |
| `spiritwolf` | `11` | **`1`** | `min(lvl, 5)` | #227 Summon Spirit Wolf (`spiritwolf` #420) | **Mutually exclusive with `fenris` & `grizzly`** (`group = 1`) |
| `fenris` | `12` | **`1`** | `min(lvl, 3)` | #237 Summon Fenris (`fenris` #421) | **Mutually exclusive with `spiritwolf` & `grizzly`** (`group = 1`) |
| `totem` | `13` | *(None)* | `1` | #226 Oak Sage (`#424`), #236 Heart of Wolverine (`#423`), #246 Spirit of Barbs (`#422`) | Only 1 Spirit Totem at a time (`petmax=1`); coexists with Ravens, Vines, and Group 1 |
| `vine` | `14` | *(None)* | `1` | #222 Plague Poppy (`#425`), #231 Cycle of Life (`#426`), #241 Vines (`#427`) | Only 1 Vine at a time (`petmax=1`); coexists with Ravens, Totems, and Group 1 |
| `grizzly` | `15` | **`1`** | `1` | #247 Summon Grizzly (`druidbear` #428) | **Mutually exclusive with `spiritwolf` & `fenris`** (`group = 1`) |

> **How `group = 1` Exclusivity Works (`D2GAME_SummonPet_6FD14430` $\to$ `sub_6FC7D7A0`)**: When summoning a pet whose `PetType.txt` record has `group > 0` (`spiritwolf`, `fenris`, or `grizzly`), `sub_6FC7D7A0` iterates all active player pets and unsummons any pet belonging to a *different* `pettype` that shares `group = 1`.

### 2.2 `Skills.txt` & `MonStats.txt` Summon Stats Summary

| ID | Skill Name (`MonStats` ID) | ReqLvl | Base HP (`MinHP`–`MaxHP`) | `calc1` (Bonus Max HP%) | `calc2` (Monster Level `mlvl`) | Sub-Skills Granted (`sumskill1`/`2`) | Passive / Aura Stats |
|---:|---|---:|---:|---|---|---|---|
| **221** | **Raven** (`druidhawk` #419) | 1 | 20–32 | `0` | $\max(1, \text{ulvl} - 2 + L)$ | — | Hits before despawn: $12 + (L-1)$; Blinds target (`Dim Vision`) |
| **222** | **Plague Poppy** (`plaguepoppy` #425) | 1 | 42–58 | $25(L-1)\%$ | $\lfloor 3\cdot\text{ulvl}/4 \rfloor + L$ | `Vine Attack` (#294) | Underground (`STATE_VINE_BEAST` 150) |
| **226** | **Oak Sage** (`oaksage` #424) | 6 | 56–64 | $30(L-1)\%$ | $\text{ulvl}$ | `Oak Sage Aura` (#298) | `poisonresist=100%`, `maxpoisonresist=100%`; `ResFi/Co/Li/Ma=25%`, `ResDm(N)=100%` |
| **227** | **Summon Spirit Wolf** (`spiritwolf` #420) | 6 | 60–82 | `Summon Fenris.ln12`% | $\text{ulvl}$ | *(MonStats)* `Teleport 2` (#292) | Def%: $7L + 50 + 10(L-1)\%$; AR%: `ln12`; EDmg%: `Summon Grizzly.ln12`; AllRes: $\min(5(L-1), 85)\%$ |
| **231** | **Cycle of Life** (`cycleoflife` #426) | 12 | 80–110 | $25(L-1)\%$ | $\lfloor 3\cdot\text{ulvl}/4 \rfloor + L$ | `Vine Attack` (#294), `CorpseCycler` (#307) | Heals owner `dm12` (`3..12%`) Max HP per corpse |
| **236** | **Heart of Wolverine** (`heartofwolverine` #423) | 18 | 128–144 | $25(L-1)\%$ | $\text{ulvl}$ | `Wolverine Aura` (#297) | `poisonresist=100%`, `maxpoisonresist=100%`; `ResFi/Co/Li/Ma=25%`, `ResDm(N)=100%` |
| **237** | **Summon Fenris** (`fenris` #421) | 18 | 98–130 | `ln12` ($50 + 25(L-1)\%$) | $\text{ulvl}$ | *(MonStats)* `fenris rage` (#314), `Teleport 2` (#292) | Def%: $4L + \text{Spirit Wolf.ln56}\%$; AR%: `Spirit Wolf.ln12`; EDmg%: `Grizzly.ln12`; AllRes: $\min(5(L-1), 85)\%$ |
| **241** | **Vines** (`vinecreature` #427) | 24 | 138–192 | $20(L-1)\%$ | $\lfloor 3\cdot\text{ulvl}/4 \rfloor + L$ | `Vine Attack` (#294), `VineCycler` (#325) | Restores owner `dm12` (`1..8%`) Max Mana per corpse |
| **246** | **Spirit of Barbs** (`spiritofbarbs` #422) | 30 | 200–226 | $25(L-1)\%$ | $\text{ulvl}$ | `Barbs Aura` (#296) | `poisonresist=100%`, `maxpoisonresist=100%`; `ResFi/Co/Li/Ma=25%`, `ResDm(N)=100%` |
| **247** | **Summon Grizzly** (`druidbear` #428) | 30 | 550–750 | `Summon Fenris.ln12`% | $\text{ulvl}$ | *(MonStats)* `BearSmite` (#326) | EDmg%: $25 + 10(L-1)\%$; AR%: `Spirit Wolf.ln12`; Def%: `Spirit Wolf.ln56`; AllRes: $\min(5(L-1), 85)\%$ |

---

## 3. Detailed Reverse-Engineering Analysis by Subsystem

---

### 3.1 Skill #221 — Raven (`druidhawk` #419)

#### Server Summon: `SKILLS_SrvDo114_Raven` (`SkillSrvDoFunc[114]` @ `0x6FC668A0`)
1. Resolves monster ID `summon = druidhawk` (#419), `summode = MONMODE_SKILL1` (`8`), `pettype = raven` (`10`), and evaluates `nMaxPets = petmax = min(L, 5)`.
2. Evaluates `nMonsterLevel = max(1, calc2) = max(1, ulvl - 2 + L)` (`Param1 = -2`) and calls `D2GAME_SummonPet_6FD14430`.
3. Calls `D2GAME_SKILLS_SetSummonBaseStats_6FD0CB10` to set Raven physical damage (`MinDam = 2 + (L-1)`, `MaxDam = 4 + (L-1)`) and Attack Rating (`ToHit = 100 + 15(L-1)`).
4. **Attack Counter Initialization**: Evaluates `ln56` (`Param5 = 12`, `Param6 = 1` $\implies 12 + (L-1)$ hits) and stores it in **`STAT_SKILL_FRENZY`** (`id = 100`) on the Raven monster unit!

#### Raven AI & Hit-to-Blind Mechanics (`AITHINK_Fn107_Raven` in `AiThink.cpp`)
- **Orbiting & Aggro**: When idle (`pAiControl->nAiState == 0`), Raven circles its owner at radius `aip2 = 6` subtiles (`sub_6FCD0E80`). When enemies are within `aip4 = 75` subtiles, it attacks (`MONMODE_ATTACK1`).
- **Hit Count Depletion**: Every time Raven attacks an enemy, `AITHINK_Fn107_Raven` decrements its `STAT_SKILL_FRENZY` stat by 1. When `STAT_SKILL_FRENZY <= 0`, the Raven unsummons/dies (`SUNITDMG_KillMonster`)!
- **Hit-to-Blind (Dim Vision Proc)**:
  - On hit against a normal monster (not boss/champ/superunique, not immune to curses), Raven computes its effective `mlvl = ulvl - 2 + L` vs defender `dlvl` and rolls chance to blind (`STATE_DIMVISION = 23`):
    $$\text{ChanceToBlind} = \text{clamp}\left(50 + 5 \times (\text{ulvl} - 2 + L - \text{dlvl}),\; 5\%,\; 100\%\right)$$
  - If successful, applies `STATE_DIMVISION` (Curse #81 Dim Vision duration/radius) to the target monster!

---

### 3.2 Vines Subsystem — Skills #222 (Poison Creeper / `Plague Poppy`), #231 (Carrion Vine / `Cycle of Life`), & #241 (Solar Creeper / `Vines`)

#### Server Summon: `SKILLS_SrvDo115_Vines` (`SkillSrvDoFunc[115]` @ `0x6FC66720`)
1. Summons `plaguepoppy` (#425), `cycleoflife` (#426), or `vinecreature` (#427) in `summode = MONMODE_SKILL1` (`8`) under `pettype = vine` (`14`, `petmax = 1`).
2. Sets `mlvl = calc2 = (ulvl * 3) / 4 + L` and scales HP by `+calc1`% (`25*(L-1)%` for #222/#231, `20*(L-1)%` for #241).
3. Sets `aurastate = vine_beast` (`STATE_VINE_BEAST = 150`) on the summoned vine monster (`STATES_ToggleState(pPet, 150, 1)`), which makes the monster unit itself invisible underground (`States.txt` `setfunc = 11`) while driving all surface/underground visuals through `cltactivefunc = 89`!
4. Grants sub-skills (`D2Common_10927_UNITS_AddSkill`):
   - **#222 Plague Poppy**: `sumskill1 = Vine Attack` (#294) at level `L`.
   - **#231 Cycle of Life**: `sumskill1 = Vine Attack` (#294) + `sumskill2 = CorpseCycler` (#307) at level `L`.
   - **#241 Vines**: `sumskill1 = Vine Attack` (#294) + `sumskill2 = VineCycler` (#325) at level `L`.

#### Client Underground Pod Renderer: `SkillCltDoFunc[89]` (`0x6FB750F0` via `States.txt` `cltactivefunc=89`)
- Runs every frame on the client for any monster with `STATE_VINE_BEAST` (`id = 150`).
- Attaches or retrieves internal client skill `294` (`0x126`, `Vine Attack`) on the vine monster (`D2Common#10630` / `#10302`).
- Tracks elapsed frames since the last pod visual (`D2Common#10980`) and distance moved (`D2Common#10080`) against `cltcalc2 = 35` frames / subtiles.
- Depending on the vine's current `MONMODE`:
  - `MONMODE_NEUTRAL (1)`: Periodically spawns `cltmissiled = vine beast neutral` (#468, `ExplosionMissile = vine beast neutral fade` #539).
  - `MONMODE_WALK (2)`: Alternates randomly (`0x6FAB1330` roll `0..1`) between `cltmissilec = vine beast walk 1` (#466, `ExplosionMissile = vine beast walk 1 fade` #537) and `vine beast walk 2` (#467, `ExplosionMissile = vine beast walk 2 fade` #538) as the vine tunnels through the dirt!

#### Poison Creeper Sub-Skill: `Vine Attack` (#294) (`AITHINK_Fn110_Vines` & `SKILLS_SrvDo130_VineAttack` @ `0x6FC2D7B0`)
- **AI (`AITHINK_Fn110_Vines`)**: When an enemy is within melee range, the vine casts `Vine Attack` (#294) (`MONMODE_SKILL1`).
- **Server (`SkillSrvDoFunc[130]` @ `0x6FC2D7B0`)**:
  - Evaluates `nCount = calc1 = min(24, ln12) = min(24, 3 + (L-1))` (`Param1 = 3`, `Param2 = 1`).
  - Spawns `srvmissilea = plague vines` (#474, `Vel = 7`, `Range = 20`) at `(TargetX, TargetY)` with `MissileSrvDoFunc[26]` (`0x6FC60420`), which emits `plague vines trail` (#475) every `Param1 = 9` frames (`nRemainingFrames % 9 == 0`).
  - **`plague vines trail` (#475) Poison Mat Explosion (`MISSMODE_SrvHit50_PlagueVinesTrail` @ `0x6FC591A0`)**:
    - Each `plague vines trail` (#475, `Range = 100 + 25*(L-1)` frames, `Skill = Plague Poppy`) deals Poison Creeper's poison damage (`HitShift = 8` on the skill, `ELen = 100` frames = 4.0s).
    - When a trail segment expires (`SrvHit50`), it spawns a radial ring of additional `plague vines trail` segments (`sHitPar1 = 15`), creating Poison Creeper's dense overlapping poison mat!
- **Client (`SkillCltStFunc[49]` @ `0x6FB75C70`)**: Spawns `cltmissilea = vine beast attack` (#469) at the vine's position and launches `cltcalc1 = min(12, 3 + L - 1)` `cltmissileb = vines` (#471) trails (`0x6FB75730`).

#### Carrion Vine (`CorpseCycler` #307) & Solar Creeper (`VineCycler` #325)
1. **AI (`AITHINK_Fn111_CycleOfLife`)**:
   - Checks the owner's HP (for `cycleoflife` #426) or Mana (for `vinecreature` #427): if owner HP/Mana is below 100% (or on a random `aip4 = 10%` roll even at full HP/Mana), searches within `aip2 = 20` subtiles (`sub_6FCF2E50` with flag `0x808`) for a valid consumable monster corpse (`STATES_CheckState(pCorpse, STATE_CORPSE_NOSELECT) == 0`).
   - Walks to the corpse and casts `CorpseCycler` (#307) or `VineCycler` (#325) on it.
2. **Server Start (`SKILLS_SrvSt63_Corpse_VineCycler` @ `0x6FC2D170`)**:
   - Verifies corpse validity, marks the corpse unselectable (`STATES_ToggleState(pCorpse, STATE_CORPSE_NOSELECT, 1)`), and spawns `srvmissilea = recycler delay` (#498, for Carrion Vine) or `vine recycler delay` (#540, for Solar Creeper) at the corpse's `(X, Y)` (`Range = 47` frames), storing `pCorpse->dwUnitId` in `TargetX`.
   - Broadcasts `cltprgfunc1 = 93` (`SkillCltDoFunc[93]` @ `0x6FB75670`) to clients, which hides/consumes the client corpse (`0x6FAFC500(..., 3)`) and spawns the client `recycler delay` missile (#498).
3. **Server Delayed Heal (`MISSMODE_SrvDo29_RecyclerDelay` @ `0x6FC5FED0` & `MISSMODE_SrvDo33_VineRecyclerDelay` @ `0x6FC5FD30`)**:
   - Both missiles wait until `nRemainingFrames == Param1` (`45` frames remaining out of `47`, i.e., 2 frames after cast; then at `0` frames remaining the corpse unit is deleted via `SUNIT_RemoveUnit`):
   - **Carrion Vine (`SrvDo29` @ `0x6FC5FED0`)**:
     - Evaluates `nHealPct = calc1 = dm12` of Skill #231 (`Param5 = 3`, `Param6 = 12` $\implies 3\%..12\%$ Max HP).
     - Adds $\lfloor \text{OwnerMaxHP} \times \text{nHealPct} / 100 \rfloor$ to owner's `STAT_HITPOINTS` (clamped to `STAT_MAXHP`) and applies `ProgOverlay = steallife` on the Druid!
   - **Solar Creeper (`SrvDo33` @ `0x6FC5FD30`)**:
     - Evaluates `nManaPct = calc1 = dm12` of Skill #241 (`Param5 = 1`, `Param6 = 8` $\implies 1\%..8\%$ Max Mana).
     - Adds $\lfloor \text{OwnerMaxMana} \times \text{nManaPct} / 100 \rfloor$ to owner's `STAT_MANA` (clamped to `STAT_MAXMANA`) and applies `ProgOverlay = stealmana` on the Druid!
4. **Client Corpse Visuals (`MissileCltDoFunc[51]` @ `0x6FB673E0`)**:
   - At `nRemainingFrames == CltParam1` (`10` for Carrion, `20` for Solar), spawns `CltSubMissile1 = recycler vine` (#499) + `CltParam3 = 3` extra random vines around the corpse.
   - At `nRemainingFrames == CltParam2` (`23` for Carrion, `45` for Solar), sets corpse client flag `0x40000` (`[pCorpse+0xC8] |= 0x40000`) and spawns `CltSubMissile2 = recycler explosion` (#501, `CorpseExplodeGuts` + `necromancer_corpseexp_1`).

---

### 3.3 Spirit Totems & Wolves/Grizzly — `SKILLS_SrvDo119_DruidSummon` (`SkillSrvDoFunc[119]` @ `0x6FC66560`)

All 6 remaining Druid summons — **Oak Sage (#226)**, **Summon Spirit Wolf (#227)**, **Heart of Wolverine (#236)**, **Summon Dire Wolf (`Summon Fenris` #237)**, **Spirit of Barbs (#246)**, and **Summon Grizzly (#247)** — share `SKILLS_SrvDo119_DruidSummon` (`0x6FC66560`):

1. **Monster Spawn & Pet Cap**:
   - Evaluates `nMaxPets = petmax` (`min(L, 5)` for Spirit Wolf, `min(L, 3)` for Dire Wolf, `1` for Totems and Grizzly).
   - Evaluates `mlvl = calc2 = ulvl` (matches the Druid's character level).
   - Calls `D2GAME_SummonPet_6FD14430` to spawn the monster in `summode` (`NU` for Totems, `S1` for Wolves/Grizzly) and enforce `PetType.txt` caps and `group = 1` mutual exclusivity.
2. **Base HP, Base Damage & Cross-Synergies (`D2GAME_SKILLS_SetSummonBaseStats_6FD0CB10`)**:
   - Evaluates `nHPBonusPct = calc1` and scales the monster's base HP (`MonStats.txt` `MinHP`..`MaxHP` at `mlvl = ulvl`) by $(100 + \text{calc1})\%$.
   - Evaluates `Skills.txt` `MinDam`..`MaxDam` and `ToHit` at the cast skill level `L` and writes them to the summon's `STAT_MINDAMAGE`, `STAT_MAXDAMAGE`, and `STAT_TOHIT`.
3. **Passive & Aura Stats (`D2GAME_SetSummonPassiveStats_6FD0C530` & `sub_6FCFE0E0`)**:
   - Applies `passivestat1..3` (`passivecalc1..3`) and `aurastat1..4` (`aurastatcalc1..4`) directly onto the summoned pet's stat list!
4. **Sub-Skill Assignment**:
   - Assigns `sumskill1..5` at level `sumsk1calc..5` (`lvl`) to the pet (`D2Common_10927_UNITS_AddSkill`).

---

### 3.4 Spirit Totems Subsystem — Skills #226 (Oak Sage), #236 (Heart of Wolverine), & #246 (Spirit of Barbs)

#### Shared Totem Immunities & Resistances (`MonStats.txt` + `Skills.txt`)
- All three Spirit Totems have `flying = 1` in `MonStats.txt` and receive `passivestat1 = poisonresist` (`100%`) and `passivestat2 = maxpoisonresist` (`100%`) from `Skills.txt`, making them **Poison Immune (`100%` Poison Resist)** in all difficulties!
- In `MonStats.txt`, all three have `ResFi = 25`, `ResCo = 25`, `ResLi = 25`, `ResMa = 25` across Normal/Nightmare/Hell, `ResDm(N) = 100` (**Physical Immune in Nightmare only!** `ResDm` is 0 in Normal and Hell), and `ResPo = 70` (Normal) / `100` (NM/Hell).

#### Totem AI & Aura Sub-Skills (`AITHINK_Fn109_Totem` & `SKILLS_SrvDo065_BasicAura` @ `0x6FCBA8D0`)
- **`AITHINK_Fn109_Totem`**:
  - On first AI tick (`pAiControl->nAiState == 0`), sets `nAiState = 1` and activates `sumskill1` via `D2GAME_Events_Set` / `MONMODE_ATTACK1` (`SKILLS_SrvDo065_BasicAura` @ `0x6FCBA8D0`).
  - Thereafter, wanders near the Druid (`aip1 = 20%` step chance, `aip2 = 30` subtile tether radius) and flees if enemies close within `aip4 = 20` subtiles.
- **Aura Sub-Skills (`aurafilter = 65795 = 0x10103`, party + minions)**:
  1. **Oak Sage (#226) $\to$ `Oak Sage Aura` (#298)**:
     - Radius: `aurarangecalc = ln12 = 30 + 2(L-1)` subtiles ($20 + 1.33(L-1)$ yards).
     - Stat (`STATE_OAKSAGE` #149): `item_maxhp_percent = ln34 = 30 + 5(L-1)`% Max HP.
  2. **Heart of Wolverine (#236) $\to$ `Wolverine Aura` (#297)**:
     - Radius: `aurarangecalc = ln12 = 30 + 2(L-1)` subtiles.
     - Stats (`STATE_WOLVERINE` #148): `item_tohit_percent = ln34 = 25 + 7(L-1)`% Attack Rating, `damagepercent = ln56 = 20 + 7(L-1)`% Enhanced Physical Damage.
  3. **Spirit of Barbs (#246) $\to$ `Barbs Aura` (#296)**:
     - Radius: `aurarangecalc = ln12 = 30 + 2(L-1)` subtiles.
     - Stat (`STATE_BARBS` #147): `thorns_percent = ln34 = 50 + 10(L-1)`% Damage Returned.
     > *(Note: `Skills.txt` for Spirit of Barbs #246 has `Param3=50, Param4=20` for tooltip display, whereas the actual aura sub-skill `Barbs Aura` #296 has `Param3=50, Param4=10`! In 1.13c, the server evaluates `Barbs Aura` #296 `ln34 = 50 + 10(L-1)`%, while the skill description displays `50 + 20(L-1)`%.)*

---

### 3.5 Wolves & Grizzly Subsystem — Skills #227 (Spirit Wolf), #237 (Dire Wolf / `Fenris`), & #247 (Grizzly)

#### Hidden Effective-Level (`+Skills`) Cross-Synergy Matrix
Unlike standard 1.10+ synergies (which use `.blvl` so only hard skill points count), the Druid's Wolf and Grizzly passive cross-bonuses in `Skills.txt` use `skill('...'.ln12)` and `skill('...'.ln56)`. When `D2GAME_SKILLS_SetSummonBaseStats_6FD0CB10` and `D2GAME_SetSummonPassiveStats_6FD0C530` evaluate these formulas on the caster (`pOwner`), **`SKILLS_EvaluateSkillFormula` uses the Druid's effective skill level (`lvl`, including `+skills` from items and Battle Command)**!

| Stat Applied To Pet | **#227 Spirit Wolf** (`spiritwolf`) | **#237 Dire Wolf** (`fenris`) | **#247 Grizzly** (`druidbear`) |
|---|---|---|---|
| **Bonus Max HP% (`calc1`)** | `Summon Fenris.ln12` ($50 + 25(L_{\text{Dire}}-1)\%$, or $0\%$ if $L_{\text{Dire}}=0$) | `ln12` ($50 + 25(L_{\text{Dire}}-1)\%$) | `Summon Fenris.ln12` ($50 + 25(L_{\text{Dire}}-1)\%$, or $0\%$ if $L_{\text{Dire}}=0$) |
| **Attack Rating% (`tohit`)** | `ln12` ($50 + 25(L_{\text{Spirit}}-1)\%$) | `Summon Spirit Wolf.ln12` ($50 + 25(L_{\text{Spirit}}-1)\%$) | `Summon Spirit Wolf.ln12` ($50 + 25(L_{\text{Spirit}}-1)\%$) |
| **Defense% (`item_armor_percent`)** | $7 L_{\text{Spirit}} + 50 + 10(L_{\text{Spirit}}-1)\%$ | $4 L_{\text{Dire}} + \text{Spirit Wolf.ln56}$ ($50 + 10(L_{\text{Spirit}}-1)\%$) | `Summon Spirit Wolf.ln56` ($50 + 10(L_{\text{Spirit}}-1)\%$) |
| **Enhanced Damage% (`damagepercent`)** | `Summon Grizzly.ln12` ($25 + 10(L_{\text{Griz}}-1)\%$, or $0\%$ if $L_{\text{Griz}}=0$) | `Summon Grizzly.ln12` ($25 + 10(L_{\text{Griz}}-1)\%$, or $0\%$ if $L_{\text{Griz}}=0$) | `ln12` ($25 + 10(L_{\text{Griz}}-1)\%$) |
| **All Resistances (`aurastat1..4`)** | $\min(5(L_{\text{Spirit}}-1), 85)\%$ | $\min(5(L_{\text{Dire}}-1), 85)\%$ | $\min(5(L_{\text{Griz}}-1), 85)\%$ |

#### Spirit Wolf & Dire Wolf AI (`AITHINK_Fn108_DruidWolf`) & Sub-Skills
- **`Teleport 2` (#292, `SKILLS_SrvDo098_MonTeleport` @ `0x6FCD46B0`)**:
  - Both `spiritwolf` (#420) and `fenris` (#421) have `Teleport 2` (#292) in `MonStats.txt`.
  - In `AITHINK_Fn108_DruidWolf`, if the wolf's target is unreachable or the wolf rolls `< aip3` (`14%` for Spirit Wolf, `25%` for Dire Wolf) when closing distance, it casts `Teleport 2` (`MONMODE_SKILL1`) to blink directly onto its target (`SkillCltStFunc[48]` @ `0x6FB74550`, `SkillCltDoFunc[73]` @ `0x6FB744D0`).
- **Dire Wolf Corpse-Eating Enrage: `fenris rage` (#314)**:
  - **AI Trigger (`AITHINK_Fn108_DruidWolf`)**: When a Dire Wolf (`fenris` #421) is **not** currently in `STATE_FENRIS_RAGE` (`id = 138`) and rolls `< aip4` (`24%`), it searches within `20` subtiles (`sub_6FCF2E50`) for a consumable corpse and casts `Skill1 = fenris rage` (#314) (`MONMODE_ATTACK1`).
  - **Server (`SKILLS_SrvDo137_FenrisRage` @ `0x6FC2DD50`)**:
    - Consumes and deletes the target corpse (`STATES_ToggleState(pCorpse, STATE_CORPSE_NOSELECT, 1)` + `SUNIT_RemoveUnit`).
    - Enables `STATE_FENRIS_RAGE` (`id = 138`, overlay `direwolfcharged`) on the Dire Wolf for `auralencalc = Param1 = 500` frames (20.0 seconds).
    - Attaches `aurastat1 = damagepercent` (`aurastatcalc1 = Param2 = +100%` Enhanced Damage) for those 20 seconds!
  - **Client (`SkillCltStFunc[51]` @ `0x6FB74990` & `SkillCltDoFunc[79]` @ `0x6FB742B0`)**: Resolves the target corpse coordinates (`0x6FB74990`) and spawns `cltmissilea = corpseexplosion` with `dosound = necromancer_corpseexp_1` (`0x6FB742B0`).

#### Grizzly AI (`AITHINK_Fn112_DruidBear`) & `BearSmite` (#326)
- **AI (`AITHINK_Fn112_DruidBear`)**:
  - Approaches enemies within `aip2 = 40` subtiles.
  - In melee range, rolls `0..99` against `aip3 = 50` (`50%` chance):
    - `50%` of attacks use `MONMODE_ATTACK1` / `MONMODE_ATTACK2` (standard claw swipe).
    - `50%` of attacks cast `Skill1 = BearSmite` (#326) via `Sk1mode = seq_bearsmite`!
- **`BearSmite` (#326) (`SKILLS_SrvSt32` @ `0x6FC473C0` & `SKILLS_SrvDo002` @ `0x6FCC3220`)**:
  - Applies `ResultFlags = 8` (**Knockback**), `SrcDam = 128`, `+calc1`% (`ln34 = 15 + 15(L-1)`%) extra enhanced damage, and `calc2 = max(250, ln12)` frames of **Stun** (capped at 250 frames = 10s by `SUNITDMG`)!
