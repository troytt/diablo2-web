# Druid Shape Shifting Skills (`Skills.txt` #223, #224, #228, #232, #233, #238, #239, #242, #243, #248) — Complete Server & Client Reverse-Engineering Reference (1.13c)

> **Ground Truth Binary / MPQ Data Sources**:
> - `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`)
> - `D2Client.dll` v1.13c (`ImageBase = 0x6FAB0000`)
> - `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`)
> - `Skills.txt`, `Missiles.txt`, `States.txt`, `Overlay.txt` (1.13c `patch_d2.mpq`)

---

## 1. Dispatch Tables (1.13c Virtual Addresses)

### 1.1 `D2Game.dll` Skill & Missile Server Dispatch (`ImageBase = 0x6FC20000`)
- **`SkillSrvStFunc` base**: `0x6FD27338`
- **`SkillSrvDoFunc` base**: `0x6FD274A8`
- **`MissileSrvDoFunc` base**: `0x6FD2D970`
- **`MissileSrvHitFunc` base**: `0x6FD2DA48`
- **`MissileSrvDmgFunc` base**: `0x6FD2DB68`

| Table | Index | 1.13c VA | Symbol / Role | Used By |
|---|---:|---|---|---|
| `SkillSrvStFunc` | `37` | `0x6FC6C4F0` | `SKILLS_SrvSt37_Zeal_Fury_BloodLordFrenzy` | Fury (#248) |
| `SkillSrvStFunc` | `56` | `0x6FC64D70` | `SKILLS_SrvSt56_FeralRage_Maul` | Feral Rage (#232), Maul (#233) |
| `SkillSrvStFunc` | `57` | `0x6FC64C20` | `SKILLS_SrvSt57_Rabies` | Rabies (#238) |
| `SkillSrvStFunc` | `58` | `0x6FC64ED0` | `SKILLS_SrvSt58_FireClaws` | Fire Claws (#239) |
| `SkillSrvDoFunc` | `2` | `0x6FCC3220` | `SKILLS_SrvDo002_Kick_..._FireClaws` | Fire Claws (#239) |
| `SkillSrvDoFunc` | `8` | `0x6FC6D420` | `SKILLS_SrvDo008_MultipleShot_Teeth_ShockWave` | Shock Wave (#243) |
| `SkillSrvDoFunc` | `13` | `0x6FC6DAC0` | `SKILLS_SrvDo013_Fend_Zeal_Fury` | Fury (#248) |
| `SkillSrvDoFunc` | `116` | `0x6FC66210` | `SKILLS_SrvDo116_Wearwolf_Wearbear` | Werewolf (#223), Werebear (#228) |
| `SkillSrvDoFunc` | `120` | `0x6FC66000` | `SKILLS_SrvDo120_FeralRage_Maul` | Feral Rage (#232), Maul (#233) |
| `SkillSrvDoFunc` | `121` | `0x6FC66A20` | `SKILLS_SrvDo121_Rabies` | Rabies (#238) |
| `SkillSrvDoFunc` | `122` | `0x6FC65000` | `SKILLS_SrvDo122_Hunger` | Hunger (#242) |
| `MissileSrvDoFunc` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `shockwave` (#511), `rabiescontagion` (#516) |
| `MissileSrvDoFunc` | `30` | `0x6FC5FB40` | `MISSMODE_SrvDo30_RabiesPlague` | `rabiesplague` (#515) |
| `MissileSrvHitFunc` | `53` | `0x6FC5F7D0` | `MISSMODE_SrvHit53_RabiesContagion` | `rabiescontagion` (#516) |
| `MissileSrvDmgFunc` | `7` | `0x6FC59600` | `MISSMODE_SrvDmg07_Warcry_ShockWave` | `shockwave` (#511) |
| `MissileSrvDmgFunc` | `11` | `0x6FC59BD0` | `MISSMODE_SrvDmg11_RabiesContagion` | `rabiescontagion` (#516) |

### 1.2 `D2Client.dll` Skill & Missile Client Dispatch (`ImageBase = 0x6FAB0000`)
- **`SkillCltStFunc` base**: `0x6FB8E928`
- **`SkillCltDoFunc` base**: `0x6FB8EA48`
- **`MissileCltDoFunc` base**: `0x6FB8D8A0`

| Table | Index | 1.13c VA | Role | Used By |
|---|---:|---|---|---|
| `SkillCltStFunc` | `45` | `0x6FB79420` | Morph into / undo client overlay selector (`cltoverlaya` vs `cltoverlayb`) | Werewolf (#223), Werebear (#228) |
| `SkillCltStFunc` | `53` | `0x6FAC51B0` | Multi-swing melee target lock & swing counter init (`calc1`) | Fury (#248) |
| `SkillCltDoFunc` | `17` | `0x6FAC5DA0` | Perpendicular fan missile spawner (`calc1 = 5` `shockwave` missiles) | Shock Wave (#243) |
| `SkillCltDoFunc` | `21` | `0x6FAC4FD0` | Multi-swing per-hit target selection, facing, and weapon sound | Fury (#248) |
| `MissileCltDoFunc` | `1` | `0x6FB617C0` | Standard client missile step | `shockwave` (#511), `rabiesplague` (#515), `rabiescontagion` (#516) |

---

## 2. `Skills.txt` & `States.txt` Reference Tables

### 2.1 `Skills.txt` Core Attributes (Druid Shape Shifting #223–#248)

| ID | Skill Name | ReqLvl | `restrict` | Required State (`State1`/`State2`) | `anim` / `seqnum` | `SrcDam` | Key Calcs / Synergies / Stats |
|---:|---|---:|---:|---|---|---:|---|
| **223** | **Wearwolf** (Werewolf) | 1 | `1` | *(Any)* | `SC` (`seqnum=22`) | 128 | `auralencalc = 1000 + skill('Shape Shifting'.ln12)`; `+25%` Stamina, `+dm34` (`20..80%`) IAS, `+50 + 15(L-1)%` AR, `+25 + Shape Shifting.ln34`% Max HP; `delay = 25` |
| **224** | **Shape Shifting** (Lycanthropy) | 1 | *(Passive)* | *(Passive)* | `SC` | — | `passive = 1`; `Param1=1000, Param2=500` (`ln12` duration frames); `Param3=20, Param4=5` (`ln34` Max HP %) |
| **228** | **Wearbear** (Werebear) | 6 | `1` | *(Any)* | `SC` (`seqnum=22`) | 128 | `auralencalc = 1000 + skill('Shape Shifting'.ln12)`; `+55 + 8(L-1)%` EDmg, `+25 + 6(L-1)%` Defense, `+75 + Shape Shifting.ln34`% Max HP; `delay = 25` |
| **232** | **Feral Rage** | 12 | `2` | `wolf` | `A1` | 128 | `calc1 = 50 + 5(L-1)%` EDmg; Max charges `calc2 = L/2 + 3`; Per charge (`aurastat1..3`, 500f): `dm34(charge)` (`10..70%`) FRW, `4 * charge`% Life Steal |
| **233** | **Maul** | 12 | `2` | `bear` | `A1` | 128 | `calc1 = 0`; Max charges `calc2 = L/2 + 3`; Per charge (`aurastat1..2`, 500f): `20 * charge`% EDmg, `dm56(charge)` (`10..100` frames) Stun |
| **238** | **Rabies** | 18 | `2` | `wolf` | `S3` | 0 | `EType = pois`, `HitShift = 3` ($8/256$), `ELen = 100 + 10(L-1)` frames; Syn: `Plague Poppy.blvl * 18%`; Spawns `rabiesplague` (#515) $\to$ `rabiescontagion` (#516) |
| **239** | **Fire Claws** | 18 | `2` | `wolf` or `bear` | `A1` | 128 | `EType = fire`, `HitShift = 8`, `+50 + 15(L-1)%` AR; Syn: `(Firestorm.blvl + Molten Boulder.blvl + Volcano.blvl + Eruption.blvl) * 22%` |
| **242** | **Hunger** | 24 | `2` | `wolf` or `bear` | `S3` | 128 | `calc1 = -75%` Phys Dmg; `calc2 = dm12` (`50..200%` Life Steal); `calc3 = dm34` (`50..200%` Mana Steal) |
| **243** | **Shock Wave** | 24 | `2` | `bear` | `SC` | — | `calc1 = 5` `shockwave` (#511) missiles; Phys dmg + `Maul.blvl * 5%` syn; Stun: $\min(40 + 15(L-1), 250)$ frames |
| **248** | **Fury** | 30 | `2` | `wolf` | `A1` | 128 | `calc1 = min(1 + L, 5)` hits; `calc2 = 100 + 17(L-1)%` EDmg; `+50 + 7(L-1)%` AR |

### 2.2 `States.txt` Group 3 Mutual Exclusivity & Morph Properties

| State ID | State Name | `group` | `transform` / `gfxclass` | `restrict` | `meleeonly` | `setfunc` / `remfunc` | Overlays |
|---:|---|---:|---|---:|---:|---|---|
| **112** | `rabies` | — | — | — | — | — | `rabiesplague` |
| **117** | `maul` | **`3`** | — | — | — | `16` / `11` | `maul1`, `maul5`, `maul1back`, `maul5back` |
| **120** | `feralrage` | **`3`** | — | — | — | `16` / `11` | `feralrage1`, `feralrage5`, `feralrage1back`, `feralrage5back` |
| **139** | `wolf` | **`3`** | `transform=1`, `gfxtype=1`, `gfxclass=430` | `1` | `1` | `14` / — | *(Handled by `CltStFunc[45]`)* |
| **140** | `bear` | **`3`** | `transform=1`, `gfxtype=1`, `gfxclass=431` | `1` | `1` | `14` / — | *(Handled by `CltStFunc[45]`)* |

> **Why `group = 3` Matters**: Because `wolf` (#139), `bear` (#140), `feralrage` (#120), and `maul` (#117) all share `group = 3`, calling `sub_6FD11C90(pUnit, 3, 0)` during any morph or un-morph immediately strips **all** other Group 3 states — preventing Werewolf from retaining Maul charges or Werebear from retaining Feral Rage charges.

---

## 3. Skill-by-Skill Mechanics & Disassembly Analysis

---

### 3.1 Skills #223 (Werewolf), #228 (Werebear), & #224 (Lycanthropy / `Shape Shifting`)

#### Passive Synergy vs Effective Level: `Shape Shifting` (#224)
- Skill #224 (`Shape Shifting`, displayed as **Lycanthropy**) has `passive = 1` and **no** `passivestat1` columns in `Skills.txt`. It does nothing on its own in human form.
- Instead, Werewolf (#223) and Werebear (#228) reference `skill('Shape Shifting'.ln12)` and `skill('Shape Shifting'.ln34)` in their `auralencalc` and `aurastatcalc` formulas:
  - Because they reference `.ln12` and `.ln34` (rather than `.blvl`), **soft skill points (`+skills`) in Lycanthropy DO increase both morph duration and Max HP%**!
  - However, if the Druid has **0 total points** in `Shape Shifting` (`lvl == 0`), `ln12` and `ln34` evaluate to `0`:
    - Duration: $1000\text{ frames} = 40\text{s}$ (at $L_{\text{Lycan}} \ge 1$: $1000 + (1000 + 500(L_{\text{Lycan}} - 1)) = 2000 + 500(L_{\text{Lycan}} - 1)$ frames $= 80\text{s} + 20\text{s}$ per level!).
    - Max HP%: Werewolf `+25%` base (`+25 + 20 + 5(L-1)%` with Lycanthropy); Werebear `+75%` base (`+75 + 20 + 5(L-1)%` with Lycanthropy).

#### Server Transform & Toggle: `SKILLS_SrvDo116_Wearwolf_Wearbear` (`SkillSrvDoFunc[116]` @ `0x6FC66210`)
1. **Toggle-Off Check (`STATES_CheckState(pUnit, nAuraState)`)**:
   - If the Druid is **already** in the target morph state (`STATE_WOLF` 139 or `STATE_BEAR` 140):
     - Calls `sub_6FCFE030(pUnit, nAuraState, pStatList)` to strip the morph state and its stat list.
     - Because `nocostinstate = 1` in `Skills.txt`, un-morphing back to human form costs **0 mana**.
     - Sets `pUnit` mode to `PLRMODE_CAST` (`10`) and returns `1`.
2. **Morph-Into Execution**:
   - Calls `sub_6FD11C90(pUnit, 3, 0)` to remove any active `group = 3` states (`wolf`, `bear`, `feralrage`, `maul`) and their stat lists.
   - Enables `nAuraState` (`STATES_ToggleState(pUnit, nAuraState, 1)`).
   - Evaluates `nDuration = auralencalc` (`1000 + skill('Shape Shifting'.ln12)` frames) and allocates a `D2StatListEx` (`dwFlags = 0x40`) with expiration frame `dwGameFrame + nDuration` and removal callback `sub_6FCFE030`.
   - Calls `sub_6FCFE0E0` to evaluate and apply `aurastat1..4`:
     - **Werewolf (#223)**:
       - `skill_staminapercent`: `25`%
       - `attackrate` (IAS): `dm34` (`10`..`80`% diminishing returns)
       - `item_tohit_percent` (AR%): `toht` (`50 + 15(L-1)`%)
       - `item_maxhp_percent`: `25 + skill('Shape Shifting'.ln34)`%
     - **Werebear (#228)**:
       - `damagepercent`: `ln12` (`55 + 8(L-1)`%)
       - `skill_armor_percent`: `ln34` (`25 + 6(L-1)`%)
       - `item_maxhp_percent`: `75 + skill('Shape Shifting'.ln34)`%
   - Calls `D2Common_10376_UNITS_UpdateAnimRateAndVelocity` to recalculate movement/animation speeds for the new `gfxclass` (`430` = Werewolf token, `431` = Werebear token via `States.txt` `setfunc = 14`).
   - Sets `pSkill->nSkillMode = PLRMODE_SEQUENCE` (`seqnum = 22`).
3. **Expiration / Removal Callback (`sub_6FCFE030`)**:
   - When the morph timer expires (or on life-saving 1-HP unshift / manual toggle), `sub_6FCFE030` clears all `group = 3` states (`sub_6FD11C90(pUnit, 3, 0)`), clears `nAuraState`, updates anim rates, and — if the Druid is alive and not in `PLRMODE_KNOCKBACK` — cancels pending action events (`D2GAME_EVENTS_Delete_6FC34840`) and forces `UNITS_ChangeAnimMode(pUnit, PLRMODE_CAST)` so the revert animation plays.

#### Client Transform Overlay: `SkillCltStFunc[45]` (`0x6FB79420`)
- Reads `aurastate` (`[pSkillsTxt + 0x80]`), `cltoverlaya` (`[pSkillsTxt + 0x110]`: `wolf_into` / `bear_into`), and `cltoverlayb` (`[pSkillsTxt + 0x112]`: `wolf_undo` / `bear_undo`).
- Calls `D2Common#10494` (`STATES_CheckState(pUnit, aurastate)`):
  - If `0` (currently human/other form): selects `cltoverlaya` (`wolf_into` / `bear_into`).
  - If non-zero (already in that form, toggling off): selects `cltoverlayb` (`wolf_undo` / `bear_undo`).
- Applies the chosen overlay via `0x6FB1B300`.

---

### 3.2 Skills #232 (Feral Rage) & #233 (Maul)

#### Server Attack Start: `SKILLS_SrvSt56_FeralRage_Maul` (`SkillSrvStFunc[56]` @ `0x6FC64D70`)
1. Evaluates `nEDmg = calc1`:
   - **Feral Rage (#232)**: `ln56 = 50 + 5(L-1)`% enhanced physical damage on the swing.
   - **Maul (#233)**: `0` (Maul's damage bonus lives in `aurastat1 = damagepercent` on its state stat list).
2. Allocates melee combat packet (`SUNITDMG_AllocCombat`) with `SrcDam = 128`, `nEDmg`, `ToHit = 20 + 10(L-1)`%.
3. Looks up any existing `D2StatList` for `aurastate` (`STATE_FERALRAGE` 120 or `STATE_MAUL` 117). If present and `STAT_SKILL_FRENZY > 0`, adds another `+nEDmg` (`+calc1`%) to `pDamage->nHitPercent` (`sub_6FC64B90`).

#### Server Hit & Progressive Charge Scaling: `SKILLS_SrvDo120_FeralRage_Maul` (`SkillSrvDoFunc[120]` @ `0x6FC66000`)
1. Calls `SUNITDMG_CheckFlag` (`pSkill->dwFlags & 2`) to check if the melee swing connected.
2. **On Hit (`dwFlags & 2` is true)**:
   - Evaluates `nDuration = auralencalc = 500` frames (20.0 seconds) and `nMaxCharges = calc2 = L / 2 + 3` (`Param7 = 2`, `Param8 = 3`).
   - Fetches or creates the `D2StatListEx` (`dwFlags = 0x40`, expire callback `sub_6FD10E50`) for `aurastate` (`120` or `117`), refreshing its expiration to `dwGameFrame + 500`.
   - Increments charge counter stored in `STAT_SKILL_FRENZY` (`id = 100`):
     ```c
     nCharge = D2Common_10466_STATLIST_GetStatValue(pStatList, STAT_SKILL_FRENZY, 0) + 1;
     if (nCharge > nMaxCharges) nCharge = nMaxCharges;
     D2Common_10463_STATLIST_SetStatIfListIsValid(pStatList, STAT_SKILL_FRENZY, nCharge, 0);
     ```
   - **Crucial Charge Formula Trick**: Calls `sub_6FCFE0E0(pUnit, pStatList, pSkillsTxtRecord, nSkillId, nCharge)`, passing **`nCharge` in place of `nSkillLevel`**!
     - Every `aurastatcalc` in `Skills.txt` for Feral Rage and Maul is therefore evaluated with `lvl = nCharge` ($1 \le \text{nCharge} \le \lfloor L/2 \rfloor + 3$):
       - **Feral Rage (`STATE_FERALRAGE` 120)**:
         - `velocitypercent`: `dm34(nCharge)` (`Param3 = 10`, `Param4 = 70` diminishing returns across charges)
         - `lifedrainmindam` & `lifedrainmaxdam`: `4 * nCharge`% Life Stolen per hit (`Param2 = 4`)
       - **Maul (`STATE_MAUL` 117)**:
         - `damagepercent`: `20 * nCharge`% Enhanced Damage (`Param3 = 20`)
         - `stunlength`: `dm56(nCharge)` (`Param5 = 10`, `Param6 = 100` frames diminishing returns across charges, $0.4\text{s}$ to $4.0\text{s}$ stun!)
   - Broadcasts `D2GAME_STATES_SendState_6FCDF840(pUnit, nAuraState, 0)` so clients invoke `States.txt` `setfunc = 16` (`remfunc = 11`), scaling the size/stage of the orbiting red/green charge ball overlay (`feralrage1`..`feralrage5`, `maul1`..`maul5`) based on `nCharge` vs `nMaxCharges`.
3. Executes melee damage & weapon durability drain (`SUNITDMG_DrainItemDurability`).

---

### 3.3 Skill #238 — Rabies

#### Server Bite: `SKILLS_SrvSt57_Rabies` (`0x6FC64C20`) & `SKILLS_SrvDo121_Rabies` (`0x6FC66A20`)
1. **`SrvStFunc[57]` (`0x6FC64C20`)**:
   - Checks melee range (`UNITS_IsInMeleeRange`).
   - Calls `SUNITDMG_AllocCombat` with `SrcDam = 0` (Rabies deals **no weapon physical damage** on the bite itself, only poison damage!), `ToHit = 50 + 7(L-1)`%, `EType = pois`, `HitShift = 3` ($8/256$ per frame), `ELen = 100 + 10(L-1)` frames ($4.0\text{s} + 0.4\text{s}$ per level), and synergy `EDmgSymPerCalc = skill('Plague Poppy'.blvl) * 18%`.
2. **`SrvDoFunc[121]` (`0x6FC66A20`)**:
   - Executes melee hit events (`ResultFlags = 1`, `HitFlags = 2`).
   - If the bite hit (`pSkill->dwFlags & 2`):
     - Applies `auratargetstate = rabies` (`STATE_RABIES = 112`, overlay `rabiesplague`) to `pTarget`.
     - Reads the poison stat list on `pTarget` (`D2Common_10480` / `STATLIST_GetExpireFrame`) to obtain `dwExpireFrame` (when the poison expires).
     - Spawns invisible carrier missile `srvmissilea = rabiesplague` (#515) on `pTarget` with `nRange = dwExpireFrame - pGame->dwGameFrame` and stores `dwExpireFrame` in `MISSILE_SetTargetX(pPlagueMissile, dwExpireFrame)` and `pTarget->dwUnitId` in `TargetY`.

#### Contagion Epidemic Loop: `rabiesplague` (#515) $\to$ `rabiescontagion` (#516)
1. **Carrier Tick (`MISSMODE_SrvDo30_RabiesPlague` @ `0x6FC5FB40`)**:
   - Looks up the infected host monster/player (`TargetY`). If the host is dead or no longer has `STATE_RABIES` (112), deletes `rabiesplague` immediately.
   - Moves `rabiesplague` to the host's current `(X, Y)` subtile (`D2Common_10229`).
   - Every `Param1 = 4` frames (`nRemainingFrames % 4 == 0`), rolls a random target coordinate in `[-7, +7]` subtiles (`Param2 = 7`) around the host and spawns `SubMissile1 = rabiescontagion` (#516, `Vel = 5`, `Range = 20`, `Size = 1`, `Activate = 2`), copying `dwExpireFrame` (`TargetX`) into the contagion missile's `TargetX`.
2. **Contagion Damage (`MISSMODE_SrvDmg11_RabiesContagion` @ `0x6FC59BD0`)**:
   - When `rabiescontagion` (#516) collides with a nearby enemy:
   - Computes remaining epidemic duration:
     ```c
     nRemFrames = MISSILE_GetTargetX(pMissile) - pGame->dwGameFrame;
     ```
   - If `nRemFrames > 0`, evaluates Rabies poison damage per frame (`HitShift = 3`) and sets `pDamage->dwPoisLen = nRemFrames`, applying the exact remaining poison duration to the newly infected target!
3. **Contagion Spread (`MISSMODE_SrvHit53_RabiesContagion` @ `0x6FC5F7D0`)**:
   - Checks if `pTarget` already has `STATE_RABIES` (112).
   - If **not** already infected (and `nRemFrames > 0`), sets `STATE_RABIES` on `pTarget` and spawns a new `rabiesplague` (#515) carrier attached to `pTarget` with `dwExpireFrame`, allowing Rabies to chain across an entire monster pack!

---

### 3.4 Skill #239 — Fire Claws

#### Server Melee Attack: `SKILLS_SrvSt58_FireClaws` (`0x6FC64ED0`) & `SKILLS_SrvDo002` (`0x6FCC3220`)
- **State Requirement**: `restrict = 2` with `State1 = wolf` and `State2 = bear` — usable in **either** Werewolf or Werebear form.
- **`SrvStFunc[58]` (`0x6FC64ED0`)**:
  - Verifies melee range (`UNITS_IsInMeleeRange`).
  - Calls `SUNITDMG_AllocCombat` with `SrcDam = 128` (100% weapon physical damage), `ToHit = 50 + 15(L-1)`% AR bonus, and adds elemental fire damage (`EType = fire`, `HitShift = 8`):
    $$\text{EMin} = 15 + 8(L_{2..8}) + 12(L_{9..16}) + 20(L_{17..22}) + 24(L_{23..28}) + 30(L_{29+})$$
    $$\text{EMax} = 20 + 8(L_{2..8}) + 12(L_{9..16}) + 22(L_{17..22}) + 26(L_{23..28}) + 34(L_{29+})$$
  - **4-Skill Synergy**: `EDmgSymPerCalc = (Firestorm.blvl + Molten Boulder.blvl + Volcano.blvl + Eruption.blvl) * 22%` (up to `+1760%` fire damage with 80 synergy points).
- **`SrvDoFunc[2]` (`0x6FCC3220`)**:
  - Standard melee strike handler (`SKILLS_SrvDo002_..._FireClaws`). On hit (`pSkill->dwFlags & 2`), applies `srvoverlay = fire_hit` on `pTarget` and drains weapon durability.

---

### 3.5 Skill #242 — Hunger

#### Server Bite & Temporary Leech Stat Injection: `SKILLS_SrvDo122_Hunger` (`SkillSrvDoFunc[122]` @ `0x6FC65000`)
- **State Requirement**: `restrict = 2`, `State1 = wolf`, `State2 = bear` (usable in either form; uses `anim = S3` / `monanim = S3` bite animation).
- **Execution (`0x6FC65000`)**:
  1. Verifies target is in melee range.
  2. Evaluates `nPhysPenalty = calc1 = Param5 = -75`% (`-75%` physical damage modifier on `SrcDam = 128`, so Hunger deals $25\%$ of normal weapon damage, though off-weapon elemental damage is unaffected).
  3. Calls `SUNITDMG_AllocCombat(pGame, pUnit, pTarget, 128, -75, ...)`.
  4. Evaluates `nLifeSteal = calc2 = dm12` (`Param1 = 50`, `Param2 = 200` $\implies 50\%..200\%$ Life Stolen per hit) and `nManaSteal = calc3 = dm34` (`Param3 = 50`, `Param4 = 200` $\implies 50\%..200\%$ Mana Stolen per hit).
  5. Allocates a **temporary `D2StatList`** (`D2Common_10470_STATLIST_AllocStatList`), injects `STAT_LIFEDRAINMINDAM = nLifeSteal` and `STAT_MANADRAINMINDAM = nManaSteal` onto `pUnit`, executes `SUNITDMG_ExecuteEvents` and `SUNITDMG_ExecuteMissileDamage`, and **immediately deletes** the temporary stat list (`D2Common_10474`) before returning!

---

### 3.6 Skill #243 — Shock Wave

#### Server & Client Fan Spread (`SKILLS_SrvDo008` @ `0x6FC6D420` & `SkillCltDoFunc[17]` @ `0x6FAC5DA0`)
- **State Requirement**: `restrict = 2`, `State1 = bear` (Werebear only; uses `anim = SC` cast animation, so cast speed scales with **Faster Cast Rate (FCR)**, not IAS!).
- **Missile Spread**:
  - Evaluates `nCount = calc1 = 5` missiles (`shockwave` #511, `Vel = 20`, `Range = 14` frames, `Size = 1`, `CollideType = 3`, `NextHit = 1`, `NextDelay = 4` frames).
  - Both server (`0x6FC6D420`) and client (`0x6FAC5DA0`) compute a perpendicular normal vector `(nx, ny)` to the cast line `(TargetX - UnitX, TargetY - UnitY)` (`0x6FB50800` / `0x6FB507C0`) and offset the 5 missile target points evenly across the fan (`Target - (5 * step)/2` to `Target + (5 * step)/2`), launching 5 diverging `shockwave` (#511) projectiles with `dwFlags = 0x820`.

#### Stun & Damage (`MISSMODE_SrvDmg07_Warcry_ShockWave` @ `0x6FC59600`)
- **Physical Damage**: `MinDam = 10..`, `MaxDam = 20..`, `HitShift = 8`, `DmgSymPerCalc = skill('Maul'.blvl) * 5%`.
- **Stun (`MissileSrvDmgFunc[7]` @ `0x6FC59600`)**:
  - Reads `nStunLen = SKILLS_EvaluateSkillFormula(pOwner, ln12, 243, nSkillLevel)` (`Param1 = 40`, `Param2 = 15` $\implies 40 + 15(L-1)$ frames = $1.6\text{s} + 0.6\text{s}$ per level).
  - Caps stun duration at `250` frames ($10.0$ seconds):
    ```c
    if (nStunLen > 250) nStunLen = 250;
    pDamage->dwStunLen += nStunLen;
    ```

---

### 3.7 Skill #248 — Fury

#### Server Multi-Hit Sequence (`SKILLS_SrvSt37_Zeal_Fury_BloodLordFrenzy` @ `0x6FC6C4F0` & `SKILLS_SrvDo013_Fend_Zeal_Fury` @ `0x6FC6DAC0`)
- **State Requirement**: `restrict = 2`, `State1 = wolf` (Werewolf only).
- **`SrvStFunc[37]` (`0x6FC6C4F0`)**:
  - Verifies target is in melee range.
  - Evaluates total swing count:
    $$\text{nHits} = \text{calc1} = \min(\text{Param5} + L - 1,\; \text{Param6}) = \min(1 + L,\; 5)$$
    ($2$ hits at $L=1$, $3$ hits at $L=2$, $4$ hits at $L=3$, and $5$ hits at $L \ge 4$).
  - Sets `pUnit->nSeqCurrentFramePrecise = (nHits - 1) << 8`, stores `nHits - 1` in `pSkill->nParam2`, and transitions the Druid into `PLRMODE_SEQUENCE`.
- **`SrvDoFunc[13]` (`0x6FC6DAC0`)**:
  - Invoked on each action frame of the sequence (`anim = A1`, `monanim = A1`).
  - Decrements `pSkill->nParam2`. While `nParam2 >= 0`, searches for a valid adjacent enemy (`sub_6FC6B8E0`) — alternating across nearby targets in melee range or continuing on the primary target.
  - Evaluates `nEDmg = calc2 = ln34 = 100 + 17(L-1)`% enhanced damage (`ToHit = 50 + 7(L-1)`% AR bonus, `SrcDam = 128`) and executes a full melee combat roll + durability drain (`SUNITDMG_DrainItemDurability`) on each swing.

#### Client Multi-Hit Sequence (`SkillCltStFunc[53]` @ `0x6FAC51B0` & `SkillCltDoFunc[21]` @ `0x6FAC4FD0`)
- **`SkillCltStFunc[53]` (`0x6FAC51B0`)**:
  - Evaluates `calc1` (`min(1 + L, 5)`) via `D2Common#10786` (`0x6FDA1BF0`) and stores the swing count on the client `D2SkillStrc` (`D2Common#10243`).
  - Resolves the primary melee target (or searches within melee range `+ 4` via `0x6FB51860` with filter `0x2A283`), faces the target (`D2Common#10739`), and stores the target `UnitType` and `UnitGUID` on the skill (`D2Common#10554` / `#10748`).
- **`SkillCltDoFunc[21]` (`0x6FAC4FD0`)**:
  - On each swing trigger frame, reads and decrements the remaining swing count (`D2Common#10980` / `#10243`).
  - Selects the next adjacent melee target (`0x6FB51860`), updates the Druid's facing direction (`D2Common#10739`), triggers weapon swing sound (`0x6FAD2280` $\to$ `0x6FB38A70`), and updates client weapon animation state.
