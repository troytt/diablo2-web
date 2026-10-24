# Diablo II v1.13c Necromancer Curses Tree Mechanics (`Skills #66, #71, #72, #76, #77, #81, #82, #86, #87, #91`)

## 1. Dispatch Tables (`D2Client.dll` `0x6FAB0000` & `D2Game.dll` `0x6FC20000`)

### Client Dispatch Tables (`D2Client.dll`, ImageBase `0x6FAB0000`)
- **`SkillCltStFunc`**: VA `0x6FB8E928`
  - `SkillCltStFunc[18]` = `0x6FB785C0` (`SKILLS_CltSt18_Curse` — spawns `cltmissilec = cursecast` at caster)
- **`SkillCltDoFunc`**: VA `0x6FB8EA48`
  - `SkillCltDoFunc[30]` = `0x6FB78B40` (`SKILLS_CltDo30_Curse` — spawns invisible `cursecenter` #191 at target with red light and stores curse missile/radius)
- **`MissileCltDoFunc` (`g_apfnCltDoFunc`)**: VA `0x6FB8D8A0`
  - `MissileCltDoFunc[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard` — `cursecast` and `curse*` ring particles)
  - `MissileCltDoFunc[17]` = `0x6FB6BB40` (`MISSMODE_CltDo17_CurseCenter` — ticks `0, 3, 6` spawn expanding concentric rings of `cltmissilea` via `0x6FB6B210`)
- **`MissileCltHitFunc` (`g_apfnCltHitFunc`)**: VA `0x6FB8DA10`
  - *(No curse missile uses a custom client hit function; all use `CltHitFunc = 0`)*

### Server Dispatch Tables (`D2Game.dll`, ImageBase `0x6FC20000`)
- **`SkillSrvStFunc`**: VA `0x6FD27338`
  - `SkillSrvStFunc[18]` = `0x6FC6DFD0` (`SKILLS_SrvSt18_Attract` — returns `1` to validate target unit on cast start)
- **`SkillSrvDoFunc`**: VA `0x6FD274A8`
  - `SkillSrvDoFunc[30]` = `0x6FC705D0` (`SKILLS_SrvDo030_Curse` — Amplify Damage, Dim Vision, Weaken, Iron Maiden, Terror, Life Tap, Decrepify, Lower Resist)
  - `SkillSrvDoFunc[59]` = `0x6FC71C60` (`SKILLS_SrvDo059_Attract` — Attract single-target AI curse)
  - `SkillSrvDoFunc[61]` = `0x6FC71A90` (`SKILLS_SrvDo061_Confuse` — Confuse AoE AI curse)
- **`MissileSrvDoFunc`**: VA `0x6FD2D970`
  - `MissileSrvDoFunc[1]` = `0x6FC5F540` (`MISSMODE_SrvDo01_BasicMissile` — all curse missiles are client-only visuals; server curses apply directly via spatial callback `sub_6FD10360`)

---

## 2. `Skills.txt` Data for Necromancer Curses

All 10 Necromancer curses share `charclass = nec`, `anim = SC`, `seqtrans = SC`, `HitShift = 8`, `manashift = 8` (mana cost $= \text{mana}$), `LineOfSight = 4`, `cltstfunc = 18`, `cltdofunc = 30`, and `cltmissilec = cursecast` (#147).

| ID | Skill | ReqLvl | Prerequisite(s) | `srvstfunc` | `srvdofunc` | `mana` | `aurafilter` | `auratargetstate` | `aurarangecalc` (`ln12`) | `auralencalc` (`ln34`) | `aurastat1..4` & `aurastatcalc` / `auraevent` | `cltmissilea` |
|---:|---|---:|---|---:|---:|---:|---:|---|---|---|---|---|
| 66 | **Amplify Damage** | 1 | — | 0 | 30 | 4 | 3 | `amplifydamage` (#9) | $3 + (\text{slvl}-1) \cdot 1$ | $200 + (\text{slvl}-1) \cdot 75$ | `damageresist = -100` (`-par5`) | `curseamplifydamage` (#181) |
| 71 | **Dim Vision** | 6 | — | 0 | 30 | 9 | 2 | `dimvision` (#23) | $4 + (\text{slvl}-1) \cdot 1$ | $175 + (\text{slvl}-1) \cdot 50$ | AI switch (`AISTATE_DIMVISION`) | `cursedimvision` (#182) |
| 72 | **Weaken** | 6 | Amplify Damage | 0 | 30 | 4 | 3 | `weaken` (#19) | $9 + (\text{slvl}-1) \cdot 1$ | $350 + (\text{slvl}-1) \cdot 60$ | `damagepercent = -33` (`-par5`) | `curseweaken` (#183) |
| 76 | **Iron Maiden** | 12 | Amplify Damage | 0 | 30 | 5 | 3 | `ironmaiden` (#55) | $7$ (`Param1=7, Param2=0`) | $300 + (\text{slvl}-1) \cdot 60$ | `domeleedamage` $\to$ `EventFunc=4`; `calc1=ln56` ($200 + 25(\text{slvl}-1)$%), `calc2=calc3=ln56/4` | `curseironmaiden` (#184) |
| 77 | **Terror** | 12 | Weaken | 0 | 30 | 7 | 2 | `terror` (#56) | $4$ (`Param1=4, Param2=0`) | $200 + (\text{slvl}-1) \cdot 25$ | AI switch (`AISTATE_TERROR`); `Param5=24, Param6=2` (`ln56` walk speed bonus) | `curseterror` (#185) |
| 81 | **Confuse** | 18 | Dim Vision | 0 | 61 | 13 | 2 | `confuse` (#59) | $6 + (\text{slvl}-1) \cdot 1$ | $250 + (\text{slvl}-1) \cdot 50$ | AI switch (`AISPECIALSTATE_CONFUSE`) | `curseconfuse` (#188) |
| 82 | **Life Tap** | 18 | Iron Maiden | 0 | 30 | 9 | 3 | `lifetap` (#58) | $4 + (\text{slvl}-1) \cdot 1$ | $400 + (\text{slvl}-1) \cdot 60$ | `damagedinmelee` / `damagedbymissile` $\to$ `EventFunc=5`; `calc1=ln56=50`% (`Param5=50, Param6=0`) | `cursereversevampire` (#187) |
| 86 | **Attract** | 24 | Confuse | 18 | 59 | 17 | 2 | `attract` (#57) | $9$ (`Param1=9, Param2=0`) | $300 + (\text{slvl}-1) \cdot 90$ | Single-target state + AoE monster aggro redirect (`SearchEnemyNear=1`) | `curseattract` (#186) |
| 87 | **Decrepify** | 24 | Terror | 0 | 30 | 11 | 3 | `decrepify` (#60) | $6$ (`Param1=6, Param2=0`) | $100 + (\text{slvl}-1) \cdot 15$ | `velocitypercent = -50`, `damagepercent = -50`, `damageresist = -50`, `attackrate = -50` (`par5`) | `cursedecrepify` (#189) |
| 91 | **Lower Resist** | 30 | Life Tap, Decrepify | 0 | 30 | 22 | 3 | `lowerresist` (#61) | $7 + (\text{slvl}-1) \cdot 1$ | $500 + (\text{slvl}-1) \cdot 50$ | `fireresist`, `lightresist`, `coldresist`, `poisonresist` $= -\text{dm56}$ (`Param5=25, Param6=70`) | `curselowerresist` (#190) |

### Formula Reference (`D2Common` Skill Calc Engine)
- **`ln12`**: $\text{Param1} + (\text{slvl} - 1) \cdot \text{Param2}$ (sub-tile radius; 1 yard $= 1.5$ sub-tiles).
- **`ln34`**: $\text{Param3} + (\text{slvl} - 1) \cdot \text{Param4}$ (duration in 25 fps game frames; divide by 25 for seconds).
- **`ln56`**: $\text{Param5} + (\text{slvl} - 1) \cdot \text{Param6}$.
- **`dm56`** (Diminishing returns between `Param5=25` and `Param6=70`):
  $$\text{dm56}(\text{slvl}) = \left\lfloor \frac{110 \cdot \text{slvl}}{\text{slvl} + 6} \cdot \frac{70 - 25}{100} \right\rfloor + 25 = \left\lfloor \frac{4950 \cdot \text{slvl}}{100 \cdot (\text{slvl} + 6)} \right\rfloor + 25$$
  At `slvl=1`, `-dm56 = -31%`; at `slvl=10`, `-dm56 = -55%`; at `slvl=20`, `-dm56 = -62%`.

---

## 3. `Missiles.txt`, `States.txt` & `Overlay.txt` Suite for Curses

### `Missiles.txt` Suite
| ID | Missile | `CltDoFunc` | `Range` | `Vel` | `CelFile` | `AnimLen` | `NumDir` | `Trans` | `Light` (`R,G,B`) | Notes |
|---:|---|---:|---:|---:|---|---:|---:|---:|---|---|
| 147 | `cursecast` | 1 | 20 | 3 | `CurseCast` | 25 | 1 | 1 | `1` (`255,0,0`) | Spawned at caster by `SkillCltStFunc[18]` (`InitSteps=6`) |
| 181 | `curseamplifydamage` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 182 | `cursedimvision` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 183 | `curseweaken` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 184 | `curseironmaiden` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 185 | `curseterror` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 186 | `curseattract` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 187 | `cursereversevampire` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` (Life Tap) |
| 188 | `curseconfuse` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 189 | `cursedecrepify` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 190 | `curselowerresist` | 1 | 20 | 0 | `CurseArea` | 20 | 16 | 1 | `0` (`255,0,0`) | Ring particle spawned by `cursecenter` |
| 191 | `cursecenter` | 17 | 20 | 0 | `null` | 2 | 1 | 0 | `0` (`255,0,0`) | Invisible AoE emitter (`CltParam1=7`, `Explosion=1`) |

### `States.txt` & `Overlay.txt` Suite
All 10 curse states have `curse = 1`, `curable = 1`, and `castoverlay = curse_hit` (Overlay #69, `CurseHit`, 10 frames). All overhead curse overlays (`overlay1`) use `Height1..4 = (14, 0, -14, -60)` and `Trans = 3`.

| State ID | State Name | `overlay1` (ID) | `Filename` | Frames | `onsound` | Flags (`damred`/`r*red`/`exp`) |
|---:|---|---|---|---:|---|---|
| 9 | `amplifydamage` | `curseamplifydamage` (#128) | `CurseAmplifyDamageEffect` | 24 | `necromancer_amplifydamage` | `stat=damageresist` |
| 19 | `weaken` | `curseweaken` (#130) | `CurseWeakenEffect` | 24 | `necromancer_weaken` | `damred=1, stat=damagepercent` |
| 23 | `dimvision` | `cursedimvision` (#129) | `CurseDimVisionEffect` | 24 | `necromancer_dimvision` | — |
| 55 | `ironmaiden` | `curseironmaiden` (#131) | `CurseIronMaidenEffect` | 29 | `necromancer_ironmaiden` | — |
| 56 | `terror` | `curseterror` (#132) | `CurseTerrorEffect` | 20 | `necromancer_taint` | — |
| 57 | `attract` | `curseattract` (#133) | `CurseAttractHarmEffect` | 24 | `necromancer_attract` | `exp=1` |
| 58 | `lifetap` | `cursereversevampire` (#134) | `CurseReverseVampireEffect` | 24 | `necromancer_reversevampire` | — |
| 59 | `confuse` | `curseconfuse` (#135) | `CurseConfuseEffect` | 24 | `necromancer_confuse` | `exp=1` |
| 60 | `decrepify` | `cursedecrepify` (#136) | `CurseDecrepifyEffect` | 24 | `necromancer_decrepify` | `damred=1, stat=skill_decrepify` |
| 61 | `lowerresist` | `curselowerresist` (#137) | `CurseLowerResistEffect` | 29 | *(none)* | `rfred=1, rlred=1, rcred=1, rpred=1` |

---

## 4. Client Visual Pipeline (`D2Client.dll` `0x6FAB0000`)

### 1. Cast Start (`SKILLS_CltSt18_Curse` @ `0x6FB785C0`)
- Validates `pUnit` and active skill pointer (`0x6FB785C0..0x6FB785DF`).
- Reads `Skills.txt -> cltmissilec` (`wCltMissileC` at offset `+0x56` of `D2SkillsTxt`, which is `cursecast` ID 147 for all 10 curses).
- Calls `D2CLIENT_CreateCltMissile` (`0x6FB515C0`) at the caster's position with `wCltMissileC`, playing the rising red skull-smoke cast effect (`CurseCast.dcc`, 25 frames).

### 2. Cast Action (`SKILLS_CltDo30_Curse` @ `0x6FB78B40`)
- Resolves the target coordinates `(targetX, targetY)` via `0x6FB75BD0` (either target unit position or ground click coordinates).
- Reads `wCltMissileA` (offset `+0x52`, IDs `181..190`) and verifies `0 < wCltMissileA < sgptDataTables->nMissilesTxtRecordCount`.
- Evaluates `aurarangecalc` (`dwAuraRangeCalc` at offset `+0x74`) via `D2Common_10786(pCaster, nSkillId, nSkillLevel)`, then clamps the visual ring radius:
  $$\text{nVisualRadius} = \max(\text{nAuraRange} - 3,\; 2)$$
- Spawns **1** invisible controller missile `cursecenter` (`0xBF` = ID 191) at `(targetX, targetY)` via `0x6FB518E0`.
- Attaches a red dynamic ground light (`RGB(255, 0, 0)`) to `cursecenter` (`0x6FB78C1C..0x6FB78C4A`).
- Stores `wCltMissileA` and `nVisualRadius` into the `cursecenter` missile data fields via `D2Common_10440(pMissile, wCltMissileA)` and `D2Common_10074(pMissile, nVisualRadius)` (`0x6FB78C5F..0x6FB78C6F`).

### 3. Expanding Ring Emitter (`MISSMODE_CltDo17_CurseCenter` @ `0x6FB6BB40`)
- Executed each client frame for `cursecenter` (ID 191, `Range = 20`, `CltParam1 = 7`).
- Reads `nElapsed = D2Common_10985(pMissile)` (`0x6FB6BBB0`).
- Checks `nElapsed < CltParam1` (`7`) and `nElapsed % 3 == 0` (`0x6FB6BBC1..0x6FB6BBDA`). Thus, ring waves fire on **ticks `0`, `3`, and `6`**.
- On each wave tick, retrieves `nSubMissileId = D2Common_11023(pMissile)` (`wCltMissileA`, fallback `MissilesTxt+0x1e`) and `nMaxRadius = D2Common_10334(pMissile)` (`nVisualRadius`, returns if `<= 0`), then calls `0x6FB6B210(R, wCltMissileA, skill, slvl, nChance, nStep)` with `nChance = R > 4 ? R / 2 : R` and `nStep = R > 4 ? 2 : 1` (`0x6FB6BBCB..0x6FB6BBDF`). **There is no per-wave radius growth** (verified by disassembly, #993): all three waves cover the same disk; the "expanding rings" are only the visual effect of three random fills 3 frames apart.
- `0x6FB6B210` resolves the missile position and forwards to the filled-disk scatter `0x6FB66D40`: for `dy = -R..R step nStep` (outer) and `dx = -R..R step nStep` (inner), if `dx² + dy² <= R²` and (`nChance <= 0` or `RAND(pMissile->seed, nChance) == 0`, LCG `0x6AC690C5`, power-of-two mask else unsigned modulo) it creates `wCltMissileA` at `(x + dx, y + dy)` sub-tiles (`RandStart` → random first frame; `CurseArea` has none). Sub-tile offsets project onto the 2:1 isometric ground ellipse.
- Note that all 10 `curse*` missiles (`181..190`) share the exact same ground ring sprite `CurseArea.dcc`; the curse-specific visual identity comes from the overhead `States.txt -> overlay1` (`Curse*Effect.dcc`) applied when the server sets `auratargetstate` on cursed units.
- Port: `src/client/world/curse-center-113c.ts` (`MISSILE_METAS curse*` → `CURSEALL_META`). The CltDo30 red `cursecenter` light (`0x6FB58C20` / `0x6FB58BE0`, radius = `nVisualRadius`) is not yet modelled.

### 4. Curse Hit Sound (`States.txt -> onsound`, client state set `0x6FB23760`)
- `if (!STATES_CheckState(pUnit, nState))` (`0x6FABC1FC` @ `0x6FB237D6`) and `StatesTxt[nState].wOnSound >= 0` (`word [edi+0x26]`) → `PlaySound(wOnSound, pUnit, 0, 0, 0)` (`0x6FB38A70`), then `STATES_ToggleState(.., 1)`. The on-sound plays once per inactive → active transition (refreshes are silent). `Skills.txt dosound` and the curse missiles' `TravelSound/HitSound` are all empty.
- 1.13c `States.txt lowerresist (#61)` has **no** `onsound` (the `2486` in issue #993 is `barbarian_battlecry_state`). Generated table: `src/common/audio/state-sounds-113c.ts` (`npm run extract:state-sounds`).

---

## 5. Server Curse Architecture (`D2Game.dll` `0x6FC20000`)

### 1. Spatial AoE Iteration (`sub_6FD10360`)
All Necromancer AoE curses invoke `sub_6FD10360(pGame, nFlags, pCaster, nX, nY, nRange, pfnCallback, nSkillId, nCheckLoS)`:
1. Queries all adjacent `D2ActiveRoomStrc` rooms around `(nX, nY)` within `nRange` sub-tiles (`D2Common_10035`).
2. Filters each unit in those rooms using `aurafilter`:
   - `aurafilter = 3` (Players `0x01` | Monsters `0x02`): **Amplify Damage, Weaken, Iron Maiden, Life Tap, Decrepify, Lower Resist**.
   - `aurafilter = 2` (Monsters `0x02` only): **Dim Vision, Terror, Confuse, Attract** (AI curses never affect players).
3. Verifies hostility/alignment (`sub_6FCBD900`), corpse/invulnerability exclusions, circular Euclidean distance (`nRange * nRange >= dx*dx + dy*dy`), and optional missile collision line-of-sight (`COLLIDE_MASK_MISSILE_BARRIER = 0x1C09`).

### 2. Curse Slot Exclusivity & `STATE_ATTRACT` Lock (`sub_6FD10EC0`)
Diablo II enforces **at most one Necromancer curse (`States.txt -> curse == 1`) per unit** using `STATLIST_Flags = 0x20` (`STATLIST_CURSE`) in `sub_6FD10EC0`:
1. **Curse Resistance Check**: Reads `STAT_CURSE_RESISTANCE` (`stat #109`). If `>= 100`, the curse fails completely. Otherwise:
   $$\text{nDuration} = \text{nBaseDuration} - \left\lfloor \frac{\text{nBaseDuration} \cdot \text{STAT\_CURSE\_RESISTANCE}}{100} \right\rfloor$$
2. **Hard `STATE_ATTRACT` Immunity**:
   ```cpp
   if (STATES_CheckState(pTarget, STATE_ATTRACT)) return 0;
   ```
   **No standard curse (`States.txt -> curse == 1`)—not even another cast of Attract—can overwrite an active `STATE_ATTRACT` (#57)** until its timer expires!
   - Conversely, casting **Attract** on a monster that currently has *another* curse (e.g., Amplify Damage or Decrepify) **does overwrite** that curse, because `SKILLS_SrvDo059_Attract` checks `!STATES_CheckState(pTarget, STATE_ATTRACT)` and creates its statlist with `0x20` (`STATLIST_CURSE`), freeing the previous `0x20` curse statlist via `D2Common_10474` + `STATLIST_FreeStatList`.
3. **Same-Curse Level Check**: If the target already has a `0x20` statlist from the *same* skill and state, it is rejected if `newSlvl < oldSlvl`, refreshed if `newSlvl == oldSlvl`, or replaced if `newSlvl > oldSlvl`. Different curses overwrite unconditionally regardless of `slvl` (except against `STATE_ATTRACT` or bosses immune to AI curses).
4. **Boss/Champion AI Curse Immunity (`sub_6FD15190` & `AIUTIL_CanUnitSwitchAi`)**:
   - **Dim Vision, Terror, Confuse, and Attract** call `sub_6FD15190` / `AIUTIL_CanUnitSwitchAi`, which returns `0` for Act Bosses, SuperUniques, Unique/Champion monsters, Hirelings, Oblivion Knights, and stationary constructs (`boss=1`, `primeevil=1`, or `switchai=0` in `MonStats.txt`). Consequently, casting an AI curse near a Unique/Champion pack leaves the boss's existing Amplify Damage/Decrepify/Lower Resist intact while AI-cursing its normal minions!

### 3. Difficulty Duration Penalty for AI Curses (`AiCurseDiv`)
For **Dim Vision** (#71), **Terror** (#77), **Confuse** (#81), and **Attract** (#86), base duration `ln34` is divided by `DifficultyLevels.txt -> AiCurseDiv`:
- **Normal**: $\text{AiCurseDiv} = 1$ (100% duration)
- **Nightmare**: $\text{AiCurseDiv} = 2$ (50% duration)
- **Hell**: $\text{AiCurseDiv} = 4$ (25% duration)

### 4. The 1/5th Immunity-Breaking Penalty (`sub_6FD0B450` / `sub_6FD0C060`)
When `SKILLS_CurseCallback_6FD0B450` applies `aurastat1..6` via `sub_6FD0C060`:
- If `nStatId` is one of `STAT_DAMAGERESIST` (#36), `STAT_MAGICRESIST` (#37), `STAT_FIRERESIST` (#39), `STAT_LIGHTRESIST` (#41), `STAT_COLDRESIST` (#43), or `STAT_POISONRESIST` (#45), **and** `nStatValue < 0`, **and** the target is neither a Player (`UNIT_PLAYER`) nor a Mercenary (`MONSTER_GetHirelingTypeId(pTarget) == 0`), **and** `STATLIST_GetUnitBaseStat(pTarget, nStatId, 0) >= 100`:
  $$\text{nStatValue} = \left\lfloor \frac{\text{nStatValue}}{5} \right\rfloor \quad (20\% \text{ effectiveness})$$
- **Amplify Damage** (`-100%` Physical Resist): Applies `-20%` against Physical Immune monsters (breaks up to `119%` Physical Resist).
- **Decrepify** (`-50%` Physical Resist): Applies `-10%` against Physical Immune monsters (breaks up to `109%` Physical Resist).
- **Lower Resist** (`-31%` to `-62%` Elemental/Poison Resist): Applies `-6%` (slvl 1) to `-12%` (slvl 20) against Fire/Lightning/Cold/Poison Immune monsters.

---

## 6. Per-Skill Server Mechanics

### 1. Amplify Damage (`Skill #66`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0`)
- **AoE Radius**: $\text{ln12} = 3 + (\text{slvl} - 1)$ sub-tiles ($2.0 + 0.66\cdot(\text{slvl}-1)$ yards).
- **Duration**: $\text{ln34} = 200 + 75\cdot(\text{slvl} - 1)$ frames ($8 + 3\cdot(\text{slvl}-1)$ seconds; full length in all difficulties).
- **Effect**: Sets `STATE_AMPLIFYDAMAGE` (#9) and applies `STAT_DAMAGERESIST = -100` (`-par5`), subject to the 1/5th immunity penalty (`-20%`) if monster base physical resist $\ge 100\%$.

### 2. Dim Vision (`Skill #71`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0`)
- **AoE Radius**: $\text{ln12} = 4 + (\text{slvl} - 1)$ sub-tiles.
- **Duration**: $\lfloor (175 + 50\cdot(\text{slvl} - 1)) / \text{AiCurseDiv} \rfloor$ frames ($7 + 2\cdot(\text{slvl}-1)$ seconds in Normal).
- **Effect**: Checks `sub_6FD15190(pTarget, AISTATE_DIMVISION)` (normal monsters only). Sets `STATE_DIMVISION` (#23), transitions AI to `AISTATE_DIMVISION` (sight radius reduced to 1 sub-tile; suppresses ranged/special skills such as Gloam Lightning or Oblivion/Succubus missiles), and calls `AIGENERAL_SetOwnerData` + `AI_SetAiControlParams(..., -666, 0, 0)`. When the statlist expires (`sub_6FD0B3F0`), AI reverts to `MONMODE_NEUTRAL`.

### 3. Weaken (`Skill #72`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0`)
- **AoE Radius**: $\text{ln12} = 9 + (\text{slvl} - 1)$ sub-tiles ($6.0 + 0.66\cdot(\text{slvl}-1)$ yards).
- **Duration**: $\text{ln34} = 350 + 60\cdot(\text{slvl} - 1)$ frames ($14 + 2.4\cdot(\text{slvl}-1)$ seconds).
- **Effect**: Sets `STATE_WEAKEN` (#19) and applies `STAT_DAMAGEPERCENT = -33` (`-par5`), reducing target's physical melee/ranged enhanced damage by an additive $-33\%$.

### 4. Iron Maiden (`Skill #76`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0` + `EventFunc04` @ `SKILLS_AuraEventFunc04_IronMaiden`)
- **AoE Radius**: Fixed $7$ sub-tiles ($4.66$ yards).
- **Duration**: $\text{ln34} = 300 + 60\cdot(\text{slvl} - 1)$ frames ($12 + 2.4\cdot(\text{slvl}-1)$ seconds).
- **Thorns Reflection (`auraevent1 = domeleedamage`, `auraeventfunc1 = 4`)**:
  - Triggered whenever a cursed unit (`pUnit`) deals melee physical damage (`pDamage->dwPhysDamage > 0` and `(pDamage->wResultFlags & DAMAGERESULT_SUCCESSFULHIT)`).
  - Evaluates reflection percentage based on `pUnit` (the cursed attacker):
    - **Normal Monster / Minion**: $\text{nReflectPct} = \text{calc1} = \text{ln56} = 200 + 25\cdot(\text{slvl} - 1)\%$.
    - **Player**: $\text{nReflectPct} = \text{calc2} = \lfloor \text{ln56} / 4 \rfloor\%$ (25% PvP penalty).
    - **Hireling (`MONSTER_GetHirelingTypeId != 0`)**: $\text{nReflectPct} = \text{calc3} = \lfloor \text{ln56} / 4 \rfloor\%$ (25% Mercenary penalty).
  - Constructs a physical reflection `D2DamageStrc` (`dwPhysDamage = pDamage->dwPhysDamage * nReflectPct / 100`, `wResultFlags = 16385`, `dwHitClass = 141`) and inflicts it back onto `pUnit` via `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`.

### 5. Terror (`Skill #77`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0`)
- **AoE Radius**: Fixed $4$ sub-tiles ($2.66$ yards).
- **Duration**: $\lfloor (200 + 25\cdot(\text{slvl} - 1)) / \text{AiCurseDiv} \rfloor$ frames ($8 + 1\cdot(\text{slvl}-1)$ seconds in Normal).
- **Effect**: Checks `sub_6FD15190(pTarget, AISTATE_TERROR)`. Sets `STATE_TERROR` (#56) and calls `AI_SetAiControlParams(pGame, pTarget, pAiControl, AISTATE_TERROR, pCaster, nCasterLevel, nVelocityBonus)` where `nVelocityBonus = ln56 = 24 + 2*(slvl - 1)` causes terrified monsters to flee away from the caster at elevated walk speed.

### 6. Confuse (`Skill #81`, `SKILLS_SrvDo061_Confuse` @ `0x6FC71A90`)
- **AoE Radius**: $\text{ln12} = 6 + (\text{slvl} - 1)$ sub-tiles ($4.0 + 0.66\cdot(\text{slvl}-1)$ yards).
- **Duration**: $\lfloor (250 + 50\cdot(\text{slvl} - 1)) / \text{AiCurseDiv} \rfloor$ frames ($10 + 2\cdot(\text{slvl}-1)$ seconds in Normal).
- **Effect (`sub_6FD0BA90`)**: Checks `sub_6FD15190(pTarget, AISPECIALSTATE_CONFUSE)` and `!STATES_CheckState(pTarget, STATE_ATTRACT)`. Sets `STATE_CONFUSE` (#59) (`exp=1` in `States.txt` so monsters killed by other monsters still award experience!) and calls `sub_6FD15470(pTarget, 2)` to randomize monster alignment/target selection so affected monsters attack random nearby units. Restores alignment on expiry via `sub_6FD0BA50`.

### 7. Life Tap (`Skill #82`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0` + `EventFunc05` @ `SKILLS_AuraEventFunc05_LifeTap`)
- **AoE Radius**: $\text{ln12} = 4 + (\text{slvl} - 1)$ sub-tiles ($2.66 + 0.66\cdot(\text{slvl}-1)$ yards).
- **Duration**: $\text{ln34} = 400 + 60\cdot(\text{slvl} - 1)$ frames ($16 + 2.4\cdot(\text{slvl}-1)$ seconds).
- **On-Struck Heal (`auraevent1 = damagedinmelee`, `auraevent2 = damagedbymissile`, `auraeventfunc = 5`)**:
  - Triggered whenever a cursed target (`pUnit`) is struck in melee or by a physical missile (`pDamage->dwPhysDamage > 0` and `DAMAGERESULT_SUCCESSFULHIT`) by an attacker (`pAttacker`).
  - Evaluates $\text{nHealPct} = \text{calc1} = \text{ln56} = 50\%$ (`Param5=50, Param6=0`).
  - Computes $\text{nHeal} = \lfloor \text{pDamage->dwPhysDamage} \cdot 50 / 100 \rfloor$ and adds it directly to `pAttacker`'s `STAT_HITPOINTS` (clamped to `STAT_MAXHP`).
  - **Crucial Ground-Truth Detail**: Unlike item Life Steal (`STAT_LIFEDRAINMINDAM`), Life Tap **completely bypasses** both difficulty drain penalties (Nightmare 1/2, Hell 1/3) and monster `MonStats.txt -> Drain` effectiveness (works at full 50% against Skeletons, Mephisto, and Uber bosses!).
  - Applies `prgoverlay = steallife` (Overlay #151, `CurseRevVampireHit`, 13 frames) onto `pAttacker`.

### 8. Attract (`Skill #86`, `SKILLS_SrvSt18_Attract` @ `0x6FC6DFD0` & `SKILLS_SrvDo059_Attract` @ `0x6FC71C60`)
- **Single-Target Cast Requirement (`SKILLS_SrvSt18_Attract`)**: Requires a valid hovered monster target (`SUNIT_GetTargetUnit(pGame, pUnit) != NULL`).
- **Duration**: $\lfloor (300 + 90\cdot(\text{slvl} - 1)) / \text{AiCurseDiv} \rfloor$ frames ($12 + 3.6\cdot(\text{slvl}-1)$ seconds in Normal).
- **Dual-Phase Execution (`SKILLS_SrvDo059_Attract`)**:
  1. **Primary Target (`pTarget`)**: Validates `pTarget->dwUnitType == UNIT_MONSTER`, `!STATES_CheckState(pTarget, STATE_ATTRACT)`, and `sub_6FD15190(pTarget, AISPECIALSTATE_MOUNTED)`. Replaces any existing `0x20` curse on `pTarget` with `STATE_ATTRACT` (#57) (`STATLIST_CURSE = 0x20`) and calls `sub_6FD15470(pTarget, 0)` (shifts target's alignment to hostile-to-monsters so neighbors see it as an enemy).
  2. **Surrounding Aggro Pulse (`sub_6FD0BC60`)**: Iterates all monsters within `aurarangecalc = 9` sub-tiles ($6$ yards) of `pTarget` via `sub_6FD10360` and calls `AITACTICS_ChangeTarget(pGame, pNeighbor, pTarget)` + `AI_SetAiControlParams(..., 21, pTarget, 25, 0)` so surrounding monsters immediately switch aggro onto `pTarget` without changing their own curse state!

### 9. Decrepify (`Skill #87`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0`)
- **AoE Radius**: Fixed $6$ sub-tiles ($4$ yards).
- **Duration**: $\text{ln34} = 100 + 15\cdot(\text{slvl} - 1)$ frames ($4 + 0.6\cdot(\text{slvl}-1)$ seconds).
- **Quadruple Debuff (`Param5 = -50`)**: Sets `STATE_DECREPIFY` (#60) and applies four stats simultaneously:
  1. `STAT_VELOCITYPERCENT = -50` ($-50\%$ walk/run velocity)
  2. `STAT_ATTACKRATE = -50` ($-50\%$ attack speed)
  3. `STAT_DAMAGEPERCENT = -50` ($-50\%$ physical enhanced damage)
  4. `STAT_DAMAGERESIST = -50` ($-50\%$ physical resistance, reduced to $-10\%$ against Physical Immune monsters via `sub_6FD0C060`).

### 10. Lower Resist (`Skill #91`, `SKILLS_SrvDo030_Curse` @ `0x6FC705D0`)
- **AoE Radius**: $\text{ln12} = 7 + (\text{slvl} - 1)$ sub-tiles ($4.66 + 0.66\cdot(\text{slvl}-1)$ yards).
- **Duration**: $\text{ln34} = 500 + 50\cdot(\text{slvl} - 1)$ frames ($20 + 2\cdot(\text{slvl}-1)$ seconds).
- **Effect**: Sets `STATE_LOWERRESIST` (#61) and applies `-dm56` (`Param5=25, Param6=70`) to all four elemental/poison resistances:
  - `STAT_FIRERESIST = -dm56`
  - `STAT_LIGHTRESIST = -dm56`
  - `STAT_COLDRESIST = -dm56`
  - `STAT_POISONRESIST = -dm56`
  - *(Note: `STAT_MAGICRESIST` is NOT affected in v1.13c).* Each resistance is independently checked against `>= 100` in `sub_6FD0C060` for the 1/5th immunity-breaking penalty.
