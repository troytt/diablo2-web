# Diablo II v1.13c Sorceress Lightning Spells — Server & Client Reverse-Engineering Reference

> **Ground Truth**: `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`), `D2Client.dll` v1.13c (`ImageBase = 0x6FAB0000`), `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`), and official v1.13c MPQ data tables (`Skills.txt`, `Missiles.txt`, `States.txt`, `Overlay.txt`, `DifficultyLevels.txt`, `Levels.txt`).

---

## 1. Dispatch Tables (`D2Client.dll` & `D2Game.dll` v1.13c)

### 1.1 `D2Game.dll` (`ImageBase = 0x6FC20000`)

| Dispatch Table | Table VA | Index | Function VA | Symbol / Role | Used By (Lightning Tree) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `12` | `0x6FC62360` | `SKILLS_SrvSt12_Telekinesis_DragonFlight` | Telekinesis (#43) |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `13` | `0x6FC62230` | `SKILLS_SrvSt13_ThunderStorm` | Thunder Storm (#57) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | *(default)* | *(inline)* | `D2GAME_SKILLS_Handler` (`wSrvMissile` linear spawn) | Lightning (#49) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `17` | `0x6FC63B60` | `SKILLS_SrvDo017_ChargedBolt_BoltSentry` | Charged Bolt (#38) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `20` | `0x6FC630D0` | `SKILLS_SrvDo020_StaticField` | Static Field (#42) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `21` | `0x6FC631C0` | `SKILLS_SrvDo021_Telekinesis` | Telekinesis (#43) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `22` | `0x6FC63AA0` | `SKILLS_SrvDo022_NovaAttack` | Nova (#48) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `23` | `0x6FC62730` | `SKILLS_SrvDo023_Blaze_EnergyShield_SpiderLay` | Energy Shield (#58) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `26` | `0x6FC63720` | `SKILLS_SrvDo026_ChainLightning` | Chain Lightning (#53) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `27` | `0x6FC63450` | `SKILLS_SrvDo027_Teleport` | Teleport (#54) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `29` | `0x6FC63FA0` | `SKILLS_SrvDo029_ThunderStorm` | Thunder Storm (#57) |
| *(AuraEventCallback)* | *(event 12)* | `24` | *(SkillSor)* | `SKILLS_EventFunc24_EnergyShield` (`UNITEVENT_ABSORBDAMAGE`) | Energy Shield (#58) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `chargedbolt` (#56), `nova` (#90), `chainlightning` (#93), `lightningbolt` (#98), `lightninghit` (#99) |
| `gMissileSrvDoFuncTable` | `0x6FD2D970` | `3` | `0x6FC61AE0` | `MISSMODE_SrvDo03_PoisonCloud_Blizzard_ThunderStorm_...` | `thunderstorm1` (#166) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `12` | `0x6FC5D020` | `MISSMODE_SrvHit12_ChainLightning_LightningStrike` | `chainlightning` (#93) |
| `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | `—` | `—` | *(No custom `pSrvDmgFunc` in Lightning tree)* | — |

### 1.2 `D2Client.dll` (`ImageBase = 0x6FAB0000`)

| Dispatch Table | Table VA | Index | Function VA | Role / Behavior | Used By (Lightning Tree) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `—` | `—` | *(No custom `cltstfunc` in Lightning tree)* | — |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | *(default)* | *(inline)* | Standard `wCltMissile` linear spawn | Lightning (#49) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `23` | `0x6FB24AC0` | Multi-bolt loop (`calc1` bolts) + `PATHTYPE_CHARGEDBOLT` init (`0x6FB23B60`) | Charged Bolt (#38) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `25` | `0x6FB23CB0` | 64-missile radial ring spawner (`0x6FB51020`) | Nova (#48) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `27` | `0x6FB23E80` | Spawns `chainlightning` + stores bounce count (`calc1`) in `TargetX` | Chain Lightning (#53) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `84` | `0x6FB24350` | Periodic strike visual (`cltprgfunc1 = 84`): spawns `thunderstorm1`, sound, ambient flash | Thunder Storm (#57) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `96` | `0x6FB24610` | Item-proc Chain Lightning (`ItemCltEffect = 96`) | Chain Lightning (#53, item proc) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | Standard client frame advance & step | `chargedbolt` (#56), `nova` (#90), `lightninghit` (#99), `thunderstorm1..4` (#166–169) |
| `g_apfnMissileCltDoFunc` | `0x6FB8D8A0` | `8` | `0x6FB691C0` | Spawns trailing `CltSubMissile1` (`lightninghit` #99) on every subtile step | `chainlightning` (#93), `lightningbolt` (#98) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `10` | `0x6FB62570` | Applies `ProgOverlay` (`lightning`) to struck target | `chargedbolt` (#56), `nova` (#90), `lightninghit` (#99) |
| `g_apfnMissileCltHitFunc` | `0x6FB8DA10` | `16` | `0x6FB667D0` | Applies `ProgOverlay` + spawns next client bounce if `TargetX > 1` | `chainlightning` (#93) |

---

## 2. `Skills.txt` Ground-Truth Summary (Lightning Spells #38, #42, #43, #48, #49, #53, #54, #57, #58, #63)

| ID | Skill | ReqLvl | `srvst` / `srvdo` | `cltst` / `cltdo` | Server Missiles | Client Missiles | Anim (`UseAttackRate`) | Mana (`mana` / `lvl` / `shift` / `min`) | `HitShift` | Base Elemental Damage (`EMin`–`EMax`, Tier 1–5) | Synergy (`EDmgSymPerCalc`) |
| :-: | :--- | :-: | :-: | :-: | :--- | :--- | :-: | :--- | :-: | :--- | :--- |
| `38` | **Charged Bolt** | 1 | `—` / `17` | `—` / `23` | `chargedbolt` (#56) | `chargedbolt` (#56) | `SC` (`0`) | `24` / `+4` / `5` / `1` | `7` ($\times \frac{128}{256}$) | `4–8` (`+1/+1/+2/+3/+4` min & max) | `Lightning.blvl * 6`% |
| `42` | **Static Field** | 6 | `—` / `20` | `—` / `—` | `—` | `—` | `SC` (`0`) | `9` / `+0` / `8` / `1` | `8` ($\times \frac{256}{256}$) | *(Reduces enemy current life by `Param4 = 25`%; capped at `0%/33%/50%` in NM/Hell)* | `—` |
| `43` | **Telekinesis** | 6 | `12` / `21` | `—` / `—` | `—` | `—` | `SC` (`0`) | `7` / `+0` / `8` / `1` | `8` ($\times \frac{256}{256}$) | `1–2` (`+1/+1/+1/+1/+1` min & max); `35%` knockback | `—` |
| `48` | **Nova** | 12 | `—` / `22` | `—` / `25` | `nova` (#90) | `nova` (#90) | `SC` (`0`) | `15` / `+1` / `8` / `1` | `8` ($\times \frac{256}{256}$) | `1–20` (`+6/+7/+8/+9/+10` min, `+8/+9/+10/+11/+12` max) | `—` *(No damage synergies)* |
| `49` | **Lightning** | 12 | `—` / `—` | `—` / `—` | `lightningbolt` (#98) | `lightningbolt` (#98) | `SQ` seq 12 (`1` — IAS/FCR special) | `16` / `+1` / `7` / `1` | `8` ($\times \frac{256}{256}$) | `1–40` (`+0..+0` min, `+8/+12/+20/+28/+36` max) | `(Charged Bolt.blvl + Chain Lightning.blvl + Nova.blvl) * 8`% |
| `53` | **Chain Lightning** | 18 | `—` / `26` | `—` / `27` | `chainlightning` (#93) | `chainlightning` (#93) | `SQ` seq 12 (`1` — IAS/FCR special) | `9` / `+1` / `8` / `1` | `8` ($\times \frac{256}{256}$) | `1–40` (`+0..+0` min, `+11/+13/+15/+15/+15` max) | `(Charged Bolt.blvl + Lightning.blvl + Nova.blvl) * 4`% |
| `54` | **Teleport** | 18 | `—` / `27` | `—` / `—` | `—` | `—` | `SC` (`0`) | `24` / `-1` / `8` / `1` | `8` | *(Utility relocation + `warp=1` pet/merc warp)* | `—` |
| `57` | **Thunder Storm** | 24 | `13` / `29` | `—` / *(prg 84)* | `thunderstorm1` (#166) | `thunderstorm1` (#166) | `SC` (`0`) | `19` / `+0` / `8` / `1` | `8` ($\times \frac{256}{256}$) | `1–100` (`+10/+10/+11/+11/+11` min & max) | `—` *(No damage synergies)* |
| `58` | **Energy Shield** | 24 | `—` / `23` | `—` / `—` | `—` | `—` | `SC` (`0`) | `5` / `+0` / `8` / `1` | `8` | *(Buff: absorbs `min(edmn, 95)`% damage into mana at `(32 - Telekinesis.blvl)/16` mana/dmg)* | `Telekinesis.blvl` ($-6.25\%$ mana/dmg per blvl) |
| `63` | **Lightning Mastery** | 30 | *(passive)* | *(passive)* | `—` | `—` | `—` | `0` | `8` | *(Passive: `passive_ltng_mastery = 50 + 12*(slvl-1)`%)* | `—` |

> **Cast Speed (`SQ` Sequence #12) Note for Lightning (#49) & Chain Lightning (#53)**:
> Both **Lightning** (#49) and **Chain Lightning** (#53) use `anim = "SQ"`, `seqtrans = "SC"`, `seqnum = 12`, and `UseAttackRate = 1` instead of standard `anim = "SC"`. In `D2Common`, sequence #12 (`SQ`) for a Sorceress has a longer base animation length (19 frames vs 13 frames for `SC`), producing the well-known 1.13c Lightning/Chain Lightning Faster Cast Rate (FCR) breakpoints (`0, 7, 15, 23, 35, 52, 78, 117, 194`% FCR) rather than the standard Sorceress `SC` FCR breakpoints (`0, 9, 20, 37, 63, 105, 200`% FCR).

---

## 3. `Missiles.txt` Ground-Truth Summary (Lightning Tree Missiles & Sub-Missiles)

| ID | Missile Name | `pSrvDo` | `pSrvHit` | `pCltDo` | `pCltHit` | `Vel` / `MaxVel` (`Accel`) | `Range` | `Size` | `CollideType` | `CollideKill` | `NextHit` / `NextDelay` | `CltSubMissile1` | Key Parameters & Flags |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- | :--- |
| `56` | `chargedbolt` | `1` | `—` | `1` | `10` | `12` / `12` | `98` *(capped at `77`)* | `1` | `3` | `1` | `0` / `0` | `—` | `Skill=Charged Bolt`, `InitSteps=1`, `SubLoop=1` (`2..8`), `LastCollide=1`, `ClientCol=1`, `ProgOverlay=lightning` |
| `90` | `nova` | `1` | `—` | `1` | `10` | `24` / `24` (`-1000`) | `13` | `1` | `3` | `0` | `1` / `4` | `—` | `Skill=Nova`, `LastCollide=1`, `NumDirections=16`, `ProgOverlay=lightning` |
| `93` | `chainlightning` | `1` | `12` | `8` | `16` | `30` / `30` | `25` | `2` | `3` | `1` | `1` / `4` | `lightninghit` (#99) | `Skill=Chain Lightning`, `CltParam1=3`, `LastCollide=1`, `ClientCol=1`, `NumDirections=32`, `ProgOverlay=lightning` |
| `98` | `lightningbolt` | `1` | `—` | `8` | `—` | `30` / `30` | `25` | `2` | `3` | `0` *(pierces)* | `0` / `0` | `lightninghit` (#99) | `Skill=Lightning`, `CelFile=null`, `CltParam1=3`, `LastCollide=1`, `ClientCol=1` |
| `99` | `lightninghit` | `1` | `—` | `1` | `10` | `0` | `12` | `1` | `0` | `0` | `0` / `0` | `—` | Visual ribbon segment (`CelFile=LightningStrike`, `NumDirections=32`, `SubLoop 0..7`, `CltParam2=16`, `ProgOverlay=lightning`) |
| `166` | `thunderstorm1` | `3` | `—` | `1` | `—` | `2` / `2` | `9` | `3` | `3` | `0` | `0` / `0` | `—` | `Skill=Thunder Storm`, `AlwaysExplode=1`, `ClientCol=1`, `CelFile=LightningboltBig` |
| `167–169` | `thunderstorm2..4` | `1` | `—` | `1` | `—` | `2` / `2` (`0` on #169) | `9` (`8` on #169) | `3` | `3` | `0` | `0` / `0` | `—` | Unused/decorative vertical lightning variants (`LightningboltBig` / `LightningStrike`) |

---

## 4. Per-Skill Server & Client Mechanics

### 4.1 Charged Bolt (Skill #38)

Charged Bolt fires a fan of erratically wobbling ground-hugging lightning bolts (`chargedbolt` #56) using the specialized `PATHTYPE_CHARGEDBOLT` pathfinder.

#### Server Do (`SKILLS_SrvDo017_ChargedBolt_BoltSentry @ 0x6FC63B60`)
1. Evaluates bolt count from `calc1 = "min(24, ln12)"` (`Param1 = 3`, `Param2 = 1`):
   $$\text{BoltCount} = \min\!\left(24,\; 3 + (\text{slvl} - 1)\right) = \min(24,\; \text{slvl} + 2)$$
2. Loops `i = 0 .. BoltCount - 1` and spawns `wSrvMissileA = "chargedbolt"` (#56) with `dwFlags = 0x21`, `pInitFunc = SKILLS_MissileInit_ChargedBolt`, and `pInitArgs = i`.
3. **`SKILLS_MissileInit_ChargedBolt`**:
   - Reads `MISSILE_GetTotalFrames(pMissile)` (`Range = 98` in `Missiles.txt`) and **hard-caps it at `77` frames**:
     ```cpp
     if (nFrames >= 78) nFrames = 77;
     ```
   - Seeds the missile RNG (`SEED_InitLowSeed(&pMissile->pSeed, i + D2Common_10175_PathGetFirstPointX(pDynamicPath))`) so each bolt `i` follows a distinct deterministic pseudo-random zig-zag trajectory.
   - Calls `PATH_SetType(pDynamicPath, PATHTYPE_CHARGEDBOLT)`, `PATH_SetNewDistance(pDynamicPath, nFrames)`, and `D2Common_10142` to generate the jittery Charged Bolt path.
4. **Damage**: Each bolt independently collides (`CollideKill = 1`, `NextHit = 0`, so multiple bolts can strike the same target on the exact same frame—shotgunning!) and rolls Skill #38 lightning damage (`HitShift = 7`, i.e., $\times 0.5$ of 256ths scale, `Lightning.blvl * 6`% synergy, `passive_ltng_mastery`).

#### Client Do & Hit (`SkillCltDoFunc[23] @ 0x6FB24AC0`, `MissileCltHitFunc[10] @ 0x6FB62570`)
- **`SkillCltDoFunc[23] @ 0x6FB24AC0`**:
  - Evaluates `calc1` (`[esi+0x138]` via `D2Common#10786` @ `0x6FB24B3E`).
  - Initializes a `D2MissileStrc` (`dwFlags = 0x21`, `pInitFunc = 0x6FB23B60` which mirrors `SKILLS_MissileInit_ChargedBolt` on the client) and loops `edi = 0 .. BoltCount - 1` (`0x6FB24BBA`–`0x6FB24BCE`), setting `pInitArgs = edi` and spawning each client `chargedbolt` (#56) via `0x6FB630F0`.
- **`MissileCltHitFunc[10] @ 0x6FB62570`**:
  - On client hit against a target unit (`edx != nullptr`), reads `ProgOverlay` (`WORD PTR [eax+0x36]` = `"lightning"`) from `Missiles.txt` and attaches the overlay (`0x6FB1B300`) to the target.

---

### 4.2 Static Field (Skill #42)

Static Field is an instant-hit, missile-less radial life-reduction pulse centered on the caster.

#### Server Do (`SKILLS_SrvDo020_StaticField @ 0x6FC630D0` $\to$ `SKILLS_AuraCallback_StaticField`)
1. Evaluates search radius from `aurarangecalc = "ln12"` (`Param1 = 5`, `Param2 = 1`):
   $$\text{Radius}_{\text{subtiles}} = 5 + (\text{slvl} - 1) = \text{slvl} + 4 \quad \left(\approx \frac{\text{slvl} + 4}{1.5}\text{ yards}\right)$$
2. Calls `sub_6FD0FE80(pGame, pUnit, 0, 0, nAuraRange, dwAuraFilter, SKILLS_AuraCallback_StaticField, &args, 1)` where `dwAuraFilter = 34691` (`0x8783`: hostile monsters & players, line-of-sight check `LineOfSight = 4`).
3. For each target `pTarget` in `SKILLS_AuraCallback_StaticField`:
   - Reads current life `nHitpoints = STATLIST_UnitGetStatValue(pTarget, STAT_HITPOINTS, 0)`. If `nHitpoints < 256` ($\le 1$ displayed life), returns `0`.
   - **Expansion Difficulty Floor (`StaticFieldMin`)**:
     - In Expansion games (`pGame->bExpansion`), looks up `DifficultyLevels.txt` (`D2Common_10655(pGame->nDifficulty)`):
       - **Normal**: `StaticFieldMin = 0`% (no floor; can reduce enemies to 1 HP).
       - **Nightmare**: `StaticFieldMin = 33`% of `STAT_MAXHP`.
       - **Hell**: `StaticFieldMin = 50`% of `STAT_MAXHP`.
     - For monsters (`pTarget->dwUnitType == UNIT_MONSTER`), if `nHitpoints <= MaxHP * StaticFieldMin / 100`, returns `0` (Static Field does nothing).
   - **25% Current Life Reduction**:
     - Reads `calc1 = par4 = 25` (%) and `calc2 = par3 = 0` (min damage):
       $$\text{RawDamage} = \min\!\left(\text{nHitpoints} - 1,\; \left\lfloor\frac{\text{nHitpoints} \times 25}{100}\right\rfloor\right)$$
     -Note: **Lightning Mastery (`passive_ltng_mastery`) does NOT apply to Static Field!**
   - **Negative Lightning Resistance Pre-Compensation**:
     - Queries `STAT_LIGHTRESIST` (`nStatId` from `sub_6FD11E40`) on `pTarget`.
     - If `nValue > 0` (positive Lightning Resist), `SUNITDMG_ExecuteEvents` will reduce the damage normally; if `nValue < 0` (negative Lightning Resist, e.g., under Conviction or Lower Resist), `SKILLS_AuraCallback_StaticField` scales the damage by $\frac{100}{100 - \text{nValue}}$ beforehand so that `SUNITDMG`'s subsequent multiplication by $\frac{100 - \text{nValue}}{100}$ does **not** amplify Static Field past 25% of current life!
   - Populates `D2DamageStrc` (`dwLtngDamage`, `nHitClassActiveSet = 1`, `dwHitClass |= 0xD`, `wResultFlags = 0x4001` = `SUCCESSFULHIT | SOFTHIT`), executes `SUNITDMG_ExecuteEvents` and `SUNITDMG_ExecuteMissileDamage`, and attaches `prgoverlay = "lightning"` (`UNITS_SetOverlay`) to `pTarget`.
- **Client Behavior**:
  - `cltdofunc = ""`. Casting plays `castoverlay = "light_cast_1"` and `stsound = "sorceress_staticfield"` on the Sorceress; struck enemies display the `lightning` overlay synchronized from the server.

---

### 4.3 Telekinesis (Skill #43)

Telekinesis (`TargetItem = 1`, `InTown = 1`) interacts with monsters/players, ground items, and operable objects within a fixed 25-subtile range.

#### Server Start (`SKILLS_SrvSt12_Telekinesis_DragonFlight @ 0x6FC62360`)
1. Requires a valid target unit (`SUNIT_GetTargetUnit(pGame, pUnit)` != `nullptr`).
2. Evaluates max range `nAuraRange = aurarangecalc = Param1 = 25` subtiles ($\approx 16.67$ yards) and verifies squared Euclidean distance:
   $$\Delta X^2 + \Delta Y^2 \le 25^2 = 625$$
3. If `pTarget` is a player or monster, rejects the cast if either unit is in town (`DUNGEON_IsRoomInTown`) or if the units are not hostile (`!sub_6FCBD900`). Items and objects are allowed in town (`InTown = 1`).

#### Server Do (`SKILLS_SrvDo021_Telekinesis @ 0x6FC631C0`)
Branches on `pTarget->dwUnitType`:
1. **`UNIT_PLAYER` / `UNIT_MONSTER` (Combat Strike)**:
   - Rejects if in town or non-hostile.
   - Rolls Skill #43 damage (`EMin = 1 + 1*(slvl-1)`, `EMax = 2 + 1*(slvl-1)`, `HitShift = 8`, boosted by `passive_ltng_mastery`) with `ResultFlags |= 5` (`HIT | GETHIT`), `HitFlags |= 2`, `HitClass = 109` (`0x6D`).
   - Rolls `(ITEMS_RollRandomNumber(&pUnit->pSeed) % 100) < Param2` (`Param2 = 35`% chance): on success, sets `damage.wResultFlags |= 9` (`0x1` hit | `0x8` `DAMAGERESULTFLAG_KNOCKBACK`).
   - Applies damage via `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage` and attaches `castoverlay` (`light_cast_1`) if configured.
2. **`UNIT_ITEM` (Remote Pickup / Flip)**:
   - Checks item type against the hardcoded Telekinesis pickup whitelist:
     - `ITEMTYPE_SCROLL` (`22`)
     - `ITEMTYPE_GOLD` (`4`)
     - `ITEMTYPE_MISSILE_POTION` (`38`, throwing potions)
     - `ITEMTYPE_MISSILE` (`5` / `6`, arrows & bolts)
     - `ITEMTYPE_POTION` (`9` / `76`–`78`, healing/mana/rejuvenation/stamina/antidote/thawing potions)
     - `ITEMTYPE_KEY` (`41`)
   - **Whitelisted item**: Calls `D2GAME_PickupItem_6FC43340(pGame, pUnit, pTarget->dwUnitId, &bPickedUp)`.
   - **All other items** (weapons, armor, runes, gems, charms, etc.): Flips the item on the ground (`ITEMS_SetOverlay`, `D2Common_10862` refresh, `UNITS_ChangeAnimMode(pTarget, IMODE_ONGROUND)`) and sends client sound `0x13` ("impossible" / item bounce).
3. **`UNIT_OBJECT` (Remote Object Operation)**:
   - Calls `OBJECTS_OperateHandler` on `pTarget` (activating waypoints, shrines, chests, barrels, town portals, Diablo seals, Cain stones, etc. from up to 25 subtiles away).

---

### 4.4 Nova (Skill #48)

Nova emits an expanding ring of **64** `nova` (#90) lightning projectiles around the caster.

#### Server Do (`SKILLS_SrvDo022_NovaAttack @ 0x6FC63AA0`)
1. Calls `sub_6FD14170(pGame, pUnit, pUnit, wSrvMissileA /* 90 */, nSkillId, nSkillLevel, 0)`:
   - Spawns **64** `nova` (#90) missiles around `pUnit`'s current position distributed evenly around the 64-point circle table.
2. **Flight & Collision (`nova` #90, `MISSMODE_SrvDo01 @ 0x6FC5F540`)**:
   - `Vel = 24`, `MaxVel = 24`, `Accel = -1000` (decelerates slightly near the outer edge), `Range = 13` frames ($0.52\text{ seconds}$).
   - `CollideType = 3`, `CollideKill = 0` (pierces through enemies), `LastCollide = 1`.
   - **`NextHit = 1`, `NextDelay = 4`**: On striking an enemy, sets `STATE_JUSTHIT` on the enemy for **4 frames** (`0.16s`). Consequently, all other `nova` missiles in the 64-bolt ring that touch the same enemy within those 4 frames pass through harmlessly (`MISSMODE_SrvDmgHitHandler` line 5002: `pMissilesTxtRecord->nNextHit && STATES_CheckState(pUnit, STATE_JUSTHIT)`), guaranteeing **at most 1 hit per cast** per target!

#### Client Do & Hit (`SkillCltDoFunc[25] @ 0x6FB23CB0`, `MissileCltHitFunc[10] @ 0x6FB62570`)
- **`SkillCltDoFunc[25] @ 0x6FB23CB0`**:
  - Computes initial velocity (`D2Common#11169` + `cltcalc1`) and invokes the 64-direction client ring spawner `0x6FB51020` for `cltmissilea = "nova"` (#90).
- **`MissileCltHitFunc[10] @ 0x6FB62570`**:
  - Attaches `ProgOverlay = "lightning"` (`0x6FB1B300`) to each struck client unit.

---

### 4.5 Lightning (Skill #49)

Lightning fires a high-velocity, piercing invisible carrier (`lightningbolt` #98) that leaves a continuous visible ribbon of `lightninghit` (#99) sprites on the client.

#### Server Mechanics (`srvdofunc = ""`, `srvmissile = "lightningbolt"` #98)
1. **Cast**: Uses the default `wSrvMissile` linear projectile spawn (`sub_6FD11420`) of `lightningbolt` (#98).
2. **Flight & Piercing (`lightningbolt` #98, `MISSMODE_SrvDo01 @ 0x6FC5F540`)**:
   - `Vel = 30`, `MaxVel = 30`, `Range = 25` frames, `Size = 2`, `CelFile = "null"` (invisible on server).
   - `CollideType = 3`, **`CollideKill = 0`** (pierces unconditionally through all monsters and players in a straight line until blocked by a wall/barrier or range expiration).
   - **`LastCollide = 1`** (`NextHit = 0`): Records the last unit hit in `MISSILE_SetOwner(pMissile, pUnit)` so the fast-moving Size-2 carrier does not hit the same unit on consecutive subtile steps (`MISSILE_CheckUnitIfOwner`).
   - **Damage**: Rolls `EMin = 1` to `EMax = 40..` (`HitShift = 8`) boosted by `(Charged Bolt.blvl + Chain Lightning.blvl + Nova.blvl) * 8`% synergy and `passive_ltng_mastery`.

#### Client Mechanics (`cltdofunc = ""`, `MissileCltDoFunc[8] @ 0x6FB691C0`)
1. Default client linear spawn creates `lightningbolt` (#98), which runs **`MissileCltDoFunc[8] @ 0x6FB691C0`** every tick:
   - Verifies `D2Common#10985(pMissile)` (elapsed steps) $\ge$ `InitSteps` (`BYTE PTR [ebx+0x135]` = `0`) and `D2Common#10203(pDynamicPath)` != `0` (missile stepped onto a new subtile, `0x6FB69214`).
   - Spawns `CltSubMissile1 = "lightninghit"` (#99, `CelFile = "LightningStrike"`, `NumDirections = 32`, `Range = 12`, `SubLoop` frames `0..7`) at the carrier's current `(X, Y)` with:
     - `dwFlags = 1` (or `9` when `CltParam1 > 0`).
     - `nLoops = max(1, CltParam1)` (`CltParam1 = 3` at `[ebx+0x58]`, `0x6FB69271`).
     - `pInitFunc = 0x6FB60F40` (`0x6FB6925C`), which aligns the 32-direction `LightningStrike` sprite along the carrier's direction vector and sets its Z-offset (`CltParam2 = 16`).
   - Calls `MissileCltDoFunc[1] @ 0x6FB617C0` to advance the invisible carrier.

---

### 4.6 Chain Lightning (Skill #53)

Chain Lightning fires a `chainlightning` (#93) bolt that bounces between targets up to `calc1` times within a 20-subtile search radius, subject to a 4-frame `NextDelay` per unit.

#### Server Do (`SKILLS_SrvDo026_ChainLightning @ 0x6FC63720`)
1. Evaluates total hit/bounce count from `calc1 = "ln34 / 5"` (`Param3 = 26`, `Param4 = 1`, `Param5 = 5`):
   $$\text{TotalHits} = \left\lfloor\frac{26 + (\text{slvl} - 1)}{5}\right\rfloor = 5 + \left\lfloor\frac{\text{slvl}}{5}\right\rfloor$$
2. Spawns `wSrvMissileA = "chainlightning"` (#93) via linear spawner `sub_6FD11420` (`Vel = 30`, `Range = 25`, `Size = 2`, `CollideType = 3`, `CollideKill = 1`, `NextHit = 1`, `NextDelay = 4`).
3. Stores `TotalHits` in `MISSILE_SetTargetX(pMissile, nParam)`.

#### Server Hit & Bounce (`MISSMODE_SrvHit12_ChainLightning_LightningStrike @ 0x6FC5D020`)
When `chainlightning` (#93) strikes a unit `pUnit`:
1. Reads remaining bounces `nParam = MISSILE_GetTargetX(pMissile)`. If `nParam <= 1`, returns `3` (deal damage and destroy missile; no further bounce).
2. Evaluates bounce search radius from `aurarangecalc = "par1"` (`Param1 = 20` subtiles $\approx 13.33$ yards).
3. Searches for the nearest valid hostile target within `20` subtiles of impact `(nX, nY)` via:
   ```cpp
   pTarget = sub_6FD107F0(pGame, pOwner, nX, nY, 20, 0x88583, pUnit->dwUnitId, 0);
   ```
   - Filter `0x88583` (`558467`) selects live hostile monsters/players with line-of-sight, explicitly excluding the just-hit unit (`pUnit->dwUnitId`).
4. If a valid `pTarget` (`pTarget != pUnit`) is found:
   - Spawns a new `chainlightning` (#93) from `(nX, nY)` aimed at `(targetX, targetY)` with `dwFlags = 0x21`.
   - Decrements remaining hits on the child bolt: `MISSILE_SetTargetX(pSubMissile, nParam - 1)`.
5. Returns `3` (apply lightning damage to `pUnit`, set 4-frame `NextDelay` `STATE_JUSTHIT`, and destroy the current bolt segment).
   - **2-Target Bounce & `NextDelay = 4` Interaction**: When bouncing back and forth between two targets $A \to B \to A$, if $A$ and $B$ are closer than $\sim 4\text{ frames} \times \text{Vel}$ ($\approx 3.5$ subtiles), the bolt returning to $A$ arrives while $A$ still has `STATE_JUSTHIT` (`NextDelay = 4` frames) active! When `NextHit = 1` sees `STATE_JUSTHIT`, `MISSMODE_SrvDmgHitHandler` returns `1` (pass through without colliding), causing the bolt to fly right through $A$ without dealing damage or triggering another bounce.

#### Client Do, Trail & Bounce (`SkillCltDoFunc[27] @ 0x6FB23E80`, `MissileCltDoFunc[8] @ 0x6FB691C0`, `MissileCltHitFunc[16] @ 0x6FB667D0`)
- **`SkillCltDoFunc[27] @ 0x6FB23E80`**:
  - Evaluates `calc1` (`[edi+0x138]`), spawns client `chainlightning` (#93) via `0x6FB515C0`, and writes `TotalHits` into `MISSILE_SetTargetX` (`D2Common#10637` @ `0x6FB23EF8`).
- **`MissileCltDoFunc[8] @ 0x6FB691C0`**:
  - Spawns trailing `lightninghit` (#99, `CltParam1 = 3` subloops) on each subtile step, identical to **Lightning** (#49).
- **`MissileCltHitFunc[16] @ 0x6FB667D0`**:
  - Attaches `ProgOverlay = "lightning"` (`0x6FB1B300`) to `pTarget`.
  - Reads remaining bounces via `D2Common#11018` (`MISSILE_GetTargetX` @ `0x6FB6686A`). If $> 1$:
    - Evaluates `aurarangecalc` (`[edi+0x110]` = `20` subtiles).
    - Calls client target search `0x6FB51A50` (`filter = 0x88583`, excluding `pTarget->dwUnitId` at `[esi+0xc]`) to find the next visual bounce target.
    - Spawns a new client `chainlightning` (#93) via `0x6FB630F0` (`dwFlags = 0x21`) and sets its `TargetX = remainingBounces - 1` (`D2Common#10637` @ `0x6FB6696E`).

---

### 4.7 Teleport (Skill #54)

Teleport instantaneously relocates the Sorceress and all of her pets/mercenaries (`warp = 1`) to the target coordinates if the destination tile permits flying player collision.

#### Server Do (`SKILLS_SrvDo027_Teleport @ 0x6FC63450`)
1. Resolves `(nTargetX, nTargetY)` from target unit or target coordinates and fetches the destination `D2ActiveRoomStrc* pRoom` (`D2GAME_GetRoom_6FC52070`).
2. Checks `Levels.txt` `nTeleport` (`D2Common_10390(DUNGEON_GetLevelIdFromRoom(pRoom))`):
   - `nTeleport == 0`: Teleport forbidden (e.g., Town, Arreat Summit for certain skills) $\implies$ returns `0`.
   - `nTeleport == 1`: Teleport allowed without flying collision check.
   - `nTeleport == 2`: Calls `UNITS_TestCollisionByCoordinates(pUnit, nTargetX, nTargetY, COLLIDE_MASK_PLAYER_FLYING)` (`0x1C09` / flying mask); if blocked by solid walls/void (`COLLIDE_WALL` / `COLLIDE_BLANK`), returns `0`.
3. Calls `sub_6FCBDFE0(pGame, pUnit, 0, nTargetX, nTargetY, 0, 0)` to move the Sorceress and warp her active summon/mercenary units (`warp = 1`) onto `(nTargetX, nTargetY)`.
4. Attaches `castoverlay = "teleport"` (`UNITS_SetOverlay`) at the destination.
- **Mana Scaling**: `mana = 24`, `lvlmana = -1`, `manashift = 8`, `minmana = 1`:
  $$\text{ManaCost} = \max(1,\; 24 - (\text{slvl} - 1)) = \max(1,\; 25 - \text{slvl})$$
- **Client Behavior**:
  - `cltdofunc = ""`. Casting plays `castoverlay = "teleport"` and `stsound = "sorceress_teleport"`; the caster's coordinates snap upon receiving the server relocation packet.

---

### 4.8 Thunder Storm (Skill #57)

Thunder Storm buffs the Sorceress with `STATE_THUNDERSTORM` (#38, `periodic = 1`); on every periodic timer tick, the server searches for a nearby enemy and strikes them instantaneously with a vertical bolt (`thunderstorm1` #166).

#### Server Start (`SKILLS_SrvSt13_ThunderStorm @ 0x6FC62230`)
- On a manual cast by the Sorceress, initializes the skill record's internal tracking fields:
  - `SKILLS_SetParam1(pSkill, -1)` (last struck target's `dwUnitId`, initialized to `-1`).
  - `SKILLS_SetParam2(pSkill, 1)` (fresh cast flag = `1`).

#### Server Do (`SKILLS_SrvDo029_ThunderStorm @ 0x6FC63FA0`)
Invoked both on the manual cast (`Skill.Param2 == 1`) and on every periodic aura timer tick (`periodic = 1`, `Skill.Param2 == 0`):
1. **Manual Cast Branch** (`!STATES_CheckState(pUnit, STATE_THUNDERSTORM)` or `SKILLS_GetParam2(pSkill) != 0`):
   - Evaluates buff duration from `auralencalc = "ln12"` (`Param1 = 800`, `Param2 = 200`):
     $$\text{Duration}_{\text{frames}} = 800 + 200 \times (\text{slvl} - 1) \quad (32\text{s} + 8\text{s per level})$$
   - Creates/refreshes the `STATE_THUNDERSTORM` (#38) `D2StatListStrc` via `sub_6FD11DF0`, toggles `STATE_THUNDERSTORM` GfxState on, and clears `SKILLS_SetParam2(pSkill, 0)`.
   - The periodic timer interval is governed by `perdelay = "(100-dm56) * par4/100 + par3"` (`Param3 = 25`, `Param4 = 100`, `Param5 = 0`, `Param6 = 100`):
     $$\text{Period}_{\text{frames}} = 125 - \left\lfloor\frac{110 \times \text{slvl}}{\text{slvl} + 6}\right\rfloor$$
     *(Starts at $110\text{ frames} = 4.4\text{s}$ at slvl 1, dropping to $48\text{ frames} = 1.92\text{s}$ at slvl 20, approaching a 25-frame floor).*
2. **Periodic Strike Branch** (`Skill.Param2 == 0` while `STATE_THUNDERSTORM` is active):
   - Reads `nLastTargetUnitId = SKILLS_GetParam1(pSkill)`.
   - Searches for a valid hostile target within `Param7 = 17` subtiles ($\approx 11.33$ yards) via `sub_6FD107F0(pGame, pUnit, 0, 0, 17, 3, nLastTargetUnitId, 0)`. Passing `nLastTargetUnitId` causes `sub_6FD107F0` to prefer a **different** enemy if multiple enemies are in range, falling back to `nLastTargetUnitId` if it is the sole enemy in range.
   - If `pTarget` is found and neither caster nor target is in town:
     - Updates `SKILLS_SetParam1(pSkill, pTarget->dwUnitId)`.
     - Spawns `wSrvMissileA = "thunderstorm1"` (#166) directly at `(targetX, targetY)`, **immediately calls `MISSMODE_SrvDmgHitHandler(pGame, pMissile, pTarget, 1)`** to deal Skill #57 lightning damage (`EMin = 1 + 10..11/lvl`, `EMax = 100 + 10..11/lvl`, `HitShift = 8`, boosted by `passive_ltng_mastery`), and **immediately removes** the server missile (`SUNIT_RemoveUnit(pGame, pMissile)`).
     - Broadcasts the periodic skill trigger to clients: a unit message built by `D2Game:0x6FC9A190` and serialized by `D2Game:0x6FCABA90` as S2C `0xA3` (24 bytes: `a7` flag @1, skill id @2, skill level @4, caster type/id @6/@7, target type/id @11/@12 = `(pTarget->dwUnitType, pTarget->dwUnitId)`, x/y @16/@20 = 0; see `docs/weather_113c.md` §6). The older `sub_6FCC6300` reference is not an instruction start in the 1.13c D2Game disassembly (likely another build's VA).

#### Client Periodic Strike (`SkillCltDoFunc[84] @ 0x6FB24350`, via `cltprgfunc1 = 84`)
When the client receives the periodic trigger packet for Skill #57:
1. Resolves the struck client target unit (`0x6FB55F70` @ `0x6FB243BB`).
2. Spawns `cltmissilea = "thunderstorm1"` (#166, `LightningboltBig`, `Range = 9`) at the target's `(X, Y)` via `0x6FB630F0` (`dwFlags = 1`).
3. Writes the 3-vector `(0, 0, 0x118) << 11` into the client missile (`0x6FB77E30`, `ecx = 0x118` @ `0x6FB2441D`) and offsets the bolt's vertical render coordinate (`DWORD PTR [eax+0x18] = 0xFFFEC000` @ `0x6FB2443D`). Fn #84 plays **no** sound: the thunder (Sounds.txt row 202) comes from the weather lightning driver `0x6FB305A0` (call @ `0x6FB30687`), and only on an armed second flash (`docs/weather_113c.md` §6).
4. Flashes the screen lightning (`ForceLightning 0x6FB301F0`, call @ `0x6FB24445`; reached even when the missile creation failed, `je 0x6FB24444` @ `0x6FB2441A`) and attaches `prgoverlay = "lightning"` (`0x6FB1B300`, call @ `0x6FB24461`) to the struck target. A NULL target returns before all of this (@ `0x6FB243B7`).

---

### 4.9 Energy Shield (Skill #58)

Energy Shield buffs the Sorceress (`InTown = 1`) with `STATE_ENERGYSHIELD` (#30), intercepting incoming attacks via `UNITEVENT_ABSORBDAMAGE` **before** resistances and integer PDR/MDR are applied, diverting a percentage of incoming damage to Mana.

#### Server Do (`SKILLS_SrvDo023_Blaze_EnergyShield_SpiderLay @ 0x6FC62730`)
1. Evaluates duration from `auralencalc = "ln12"` (`Param1 = 3600`, `Param2 = 1500`):
   $$\text{Duration}_{\text{frames}} = 3600 + 1500 \times (\text{slvl} - 1) \quad (144\text{s} + 60\text{s per level})$$
2. Allocates a `D2StatListStrc` for `aurastate = "energyshield"` (State #30) with `STAT_MODIFIERLIST_SKILL = 58` and `STAT_MODIFIERLIST_LEVEL = slvl`.
3. Registers `auraevent1 = UNITEVENT_ABSORBDAMAGE` (`12`) bound to `auraeventfunc1 = 24` (`SKILLS_EventFunc24_EnergyShield`).

#### Server Damage Absorption (`SKILLS_EventFunc24_EnergyShield`)
Triggered during `SUNITDMG` damage resolution **prior** to resistances, `% Damage Reduced`, integer PDR/MDR, and elemental absorb:
1. **Absorption Percentage (`calc1 = "min(edmn, 95)"`)**:
   - Reads Skill #58's `EMin` curve (`EMin = 20`, `+5/lvl` for slvl 2–8, `+2/lvl` for slvl 9–16, `+1/lvl` for slvl 17+) and caps it at **95%** (reached at slvl 40):
     $$\text{Absorb\%} = \min(95,\; \text{edmn}(\text{slvl}))$$
2. **Mana Conversion Ratio (`calc2 = "par5 - skill('Telekinesis'.blvl)"`)**:
   - `Param5 = 32` (representing $\frac{32}{16} = 2.0\text{ mana}$ drained per $1.0$ point of absorbed damage at `Telekinesis.blvl = 0`).
   - Each **hard point** (`blvl`) in **Telekinesis** (#43) subtracts `1` ($\frac{1}{16} = 0.0625$ mana/damage), clamped at a minimum of `1`:
     $$\text{Divisor}_{16\text{ths}} = \max\!\left(1,\; 32 - \text{Telekinesis.blvl}\right), \qquad \text{ManaPerDamage} = \frac{\text{Divisor}_{16\text{ths}}}{16}$$
     *(At `Telekinesis.blvl = 16`, ratio is $16/16 = 1.00$ mana/dmg; at `Telekinesis.blvl = 20`, ratio is $12/16 = 0.75$ mana/dmg).*
3. **8-Channel Damage Iteration (`gEnergyShieldData_6FD29AD8`)**:
   - Iterates over the 8 `D2DamageStrc` channels registered in `gEnergyShieldData_6FD29AD8`:
     1. `dwPhysDamage` (`+0x08`)
     2. `dwFireDamage` (`+0x10`)
     3. `dwLtngDamage` (`+0x18`)
     4. `dwColdDamage` (`+0x24`)
     5. `dwMagDamage` (`+0x1C`)
     6. `dwLifeLeech` (`+0x34`, monster non-hireling attackers only)
     7. `dwManaLeech` (`+0x38`, monster non-hireling attackers only)
     8. `dwStamLeech` (`+0x3C`, monster non-hireling attackers only)
   - > **Bypassed Channels**: **`dwPoisDamage` (Poison)** and **Open Wounds / Burn (`dwBurnDamage`)** are **absent** from `gEnergyShieldData_6FD29AD8` and completely bypass Energy Shield!
   - For each channel with damage $D > 0$ while current `nMana > 0`:
     $$\text{Absorbed} = \min\!\left(\left\lfloor\frac{D \times \text{Absorb\%}}{100}\right\rfloor,\; \left\lfloor\frac{\text{nMana} \times 16}{\text{Divisor}_{16\text{ths}}}\right\rfloor\right)$$
     $$\text{nMana} \gets \text{nMana} - \left\lfloor\frac{\text{Absorbed} \times \text{Divisor}_{16\text{ths}}}{16}\right\rfloor, \qquad D \gets D - \text{Absorbed}$$
4. **Hit Overlay & Shield Collapse**:
   - Writes updated `STAT_MANA` (`nMana`) back to `pDefender`.
   - If total absorbed damage $> 0$, attaches directional `prgoverlay = "energyshieldhit0" + dirOffset` to the Sorceress.
   - If `nMana <= 0`, removes the `STATE_ENERGYSHIELD` (#30) StatList (`D2Common_10474` + `STATLIST_FreeStatList`) and clears `STATE_ENERGYSHIELD` (`Energy Shield` collapses immediately when mana hits zero).

---

### 4.10 Lightning Mastery (Skill #63)

- **Passive Skill (`passive = 1`)**:
  - Has no active `StFunc` or `DoFunc`.
  - Applies `passivestate = "lightningmastery"` (State #72, `nosend = 1`) and grants `passivestat1 = "passive_ltng_mastery"` evaluated from `passivecalc1 = "ln12"` (`Param1 = 50`, `Param2 = 12`):
    $$\text{LightningMastery\%} = 50 + 12 \times (\text{slvl} - 1)$$
  - Multiplies all outgoing lightning skill damage in `MISSMODE_RollDamageValue` (`STAT_PASSIVE_LTNG_MASTERY`) and melee lightning damage in `SUNITDMG` (multiplicative with skill synergies, additive with item `+% Lightning Skill Damage` such as Griffon's Eye / Eschuta's Temper / Rainbow Facets). Does **not** affect **Static Field** (#42).
