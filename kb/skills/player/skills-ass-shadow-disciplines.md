# Assassin Shadow Disciplines Skill Tree (`Skills.txt` #252–#279) — 1.13c Ground Truth Reverse Engineering

## Overview

The Assassin **Shadow Disciplines** skill tree in *Diablo II: Lord of Destruction* v1.13c consists of 10 skills (`Skills.txt` IDs `#252`, `#253`, `#258`, `#263`, `#264`, `#267`, `#268`, `#273`, `#278`, `#279`) spanning four mechanical categories:

1. **Claw Passives (2 skills)**: **Claw Mastery** (`#252`), **Weapon Block** (`#263`).
2. **Self-Buffs (3 skills)**: **Burst of Speed / Quickness** (`#258`), **Fade** (`#267`), **Venom** (`#278`).
3. **Psychic & Crowd-Control Spells (3 skills)**: **Psychic Hammer** (`#253`), **Cloak of Shadows** (`#264`), **Mind Blast** (`#273`).
4. **Shadow Summons (2 skills)**: **Shadow Warrior** (`#268`), **Shadow Master** (`#279`).

All binary addresses below correspond strictly to **Diablo II v1.13c** (`D2Client.dll` base `0x6FAB0000`, `D2Game.dll` base `0x6FC20000`).

---

## Dispatch Tables

### 1. `D2Game.dll` (`ImageBase = 0x6FC20000`)

| Table Symbol | 1.13c Table VA | Index | 1.13c Entry VA | Symbolic Name | Used By |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvStFnTable` | `0x6FD27338` | `22` | `0x6FCB2060` | `SKILLS_SrvSt22_PsychicHammer` | Psychic Hammer (`#253`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `18` | `0x6FC628F0` | `SKILLS_SrvDo018_DefensiveBuff` | Burst of Speed (`#258`), Fade (`#267`), Venom (`#278`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `33` | `0x6FCB2770` | `SKILLS_SrvDo033_PsychicHammer` | Psychic Hammer (`#253`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `47` | `0x6FCB4B10` | `SKILLS_SrvDo047_CloakOfShadows` | Cloak of Shadows (`#264`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `49` | `0x6FCB5980` | `SKILLS_SrvDo049_ShadowWarrior_Master` | Shadow Warrior (`#268`), Shadow Master (`#279`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `51` | `0x6FCB57F0` | `SKILLS_SrvDo051_MindBlast` | Mind Blast (`#273`) |
| `gpMissileSrvDoFnTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | `mindblast center` (`#576`), `mindblast hit` (`#551`) |

### 2. `D2Client.dll` (`ImageBase = 0x6FAB0000`)

| Table Symbol | 1.13c Table VA | Index | 1.13c Entry VA | Function Role | Used By |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `5` | `0x6FAF09B0` | Target non-town / LOS validation | Psychic Hammer (`#253`) |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `7` | `0x6FAF01A0` | `!STATES_CheckState(STATE_CLOAK_OF_SHADOWS)` | Cloak of Shadows (`#264`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `3` | `0x6FAF0A40` | Target LOS re-check + `dwFlags |= 0x40` | Psychic Hammer (`#253`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `8` | `0x6FAF1290` | Spawns `mindblast center` (`#576`) + sets radius | Mind Blast (`#273`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | Standard client missile step | `mindblast hit` (`#551`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `17` | `0x6FB6BB40` | Radial `mindblast hit` (`#551`) ring spawner | `mindblast center` (`#576`) |

---

## Data Tables (`Skills.txt`, `Missiles.txt`, `States.txt`, `MonStats.txt`)

### 1. `Skills.txt` — Shadow Disciplines Skills (`#252`–`#279`)

| ID | Skill Name | Req Lvl | Anim | Mana (`min`, `shift`, `base`, `+lvl`) | `Delay` | `SrvSt` / `SrvDo` | `CltSt` / `CltDo` | `AuraState` / `PassiveState` | Duration (`AuraLenCalc`) | Key Stats, Parameters & Formulas |
| :-: | :--- | :-: | :-: | :--- | :-: | :-: | :-: | :--- | :--- | :--- |
| `252` | **Claw Mastery** | 1 | `SC` | Passive (`0`) | — | `0` / `0` | `0` / `0` | `clawmastery` (`#152`, `itype = h2h`) | Permanent | `passive_mastery_melee_th = ln12` (`30 + 10*(slvl-1)%` AR); `passive_mastery_melee_dmg = ln34` (`35 + 4*(slvl-1)%` ED); `passive_mastery_melee_crit = dm56` (`0..25%` Crit) |
| `253` | **Psychic Hammer** | 1 | `SC` | `1`, `6`, `16`, `1` (`4 + 0.25/lvl`) | — | `22` / `33` | `5` / `3` | — | Instant | HitShift `7` (`/2`): Phys `2..6` (`+2..6`/`+3..7` per lvl) + Magic `2..6` (`+2..6`/`+3..7` per lvl); Knockback: Normal `100%`, Unique `dm34` (`50..100%`), Boss/Plr `dm56` (`25..99%`) |
| `258` | **Quickness** *(Burst of Speed)* | 6 | `SC` | `1`, `8`, `10`, `0` (`10` mana) | — | `0` / `18` | `0` / `0` | `quickness` (`#157`, `group = 2`) | `ln56` (`3000 + 300*(slvl-1)`f = `120 + 12*(slvl-1)`s) | `velocitypercent = dm12` (`15..70%` FRW); `attackrate = dm34` (`15..60%` EIAS) |
| `263` | **Weapon Block** | 12 | `SC` | Passive (`0`) | — | `0` / `0` | `0` / `0` | `weaponblock` (`#155`, `itype = h2h`) | Permanent | `passive_weaponblock = dm12` (`20..65%` block when dual-wielding two `h2h` claws while standing/attacking/casting) |
| `264` | **Cloak of Shadows** | 12 | `SC` | `1`, `8`, `13`, `0` (`13` mana) | — | `0` / `47` | `7` / `0` | Caster: `cloak_of_shadows` (`#153`)<br>Enemy: `cloaked` (`#156`) | `ln34` (`200 + 25*(slvl-1)`f = `8 + 1*(slvl-1)`s) | Radius `dm12` (`30` sub-tiles = `20` yards); Caster `+ED%` Defense `ln78` (`10 + 3*(slvl-1)%`); Enemy `-ED%` Defense `-min(15 + 3*(slvl-1), 95)%` + Blind (`AISPECIALSTATE_DIMVISION`) |
| `267` | **Fade** | 18 | `SC` | `1`, `8`, `10`, `0` (`10` mana) | — | `0` / `18` | `0` / `0` | `fade` (`#159`, `group = 2`) | `ln56` (`3000 + 300*(slvl-1)`f = `120 + 12*(slvl-1)`s) | `fireresist/coldresist/lightresist/poisonresist = dm12` (`10..75%`); `curse_resistance = dm34` (`40..90%`); **`damageresist = ln78` (`1 + 1*(slvl-1) = slvl%` Physical DR!)** |
| `268` | **Shadow Warrior** | 18 | `SC` | `1`, `7`, `54`, `1` (`27 + 0.5/lvl`) | `150`f (`6s`) | `0` / `49` | `0` / `0` | `shadowwarrior` (`#160`) | Until death | `PetType = 16` (`petmax = 1`); HP `+15%/lvl`; `tohit = +40*slvl`; `skill_armor_percent = +12*slvl%`; AllRes `min(4*slvl, 75)%`; copies owner's Left/Right active skills |
| `273` | **Mind Blast** | 24 | `SC` | `1`, `8`, `15`, `0` (`15` mana) | — | `0` / `51` | `0` / `8` | Target: `stunned` / `conversion` | Stun: `min(250, 50 + 5*(slvl-1))`f | Radius `Param7 = 4` sub-tiles (`2.67` yd); Phys `10..20` (`+2,+5,+8`/lvl); Knockback; Convert chance `dm56` (`15..40%`) for `150 + rnd(100)`f (`6..10`s) |
| `278` | **Venom** | 30 | `SC` | `1`, `8`, `12`, `0` (`12` mana) | — | `0` / `18` | `0` / `0` | `venomclaws` (`#31`, `group = 0`) | `ln12` (`3000 + 100*(slvl-1)`f = `120 + 4*(slvl-1)`s) | `HitShift = 6`, `ELen = 10`f (`0.4s`); `EMin..EMax = 24..32` (`+6,+8,+10,+12,+14`/lvl); sets `skill_poison_override_length = 10` frames |
| `279` | **Shadow Master** | 30 | `SC` | `1`, `7`, `70`, `1` (`35 + 0.5/lvl`) | `150`f (`6s`) | `0` / `49` | `0` / `0` | `shadowwarrior` (`#160`) | Until death | `PetType = 16` (`petmax = 1`); HP `+15%/lvl`; `tohit = +40*slvl`; AllRes `dm34` (`5..90%`); knows **all 30 Assassin skills** + equips Magic/Rare gear |

### 2. `States.txt` — Shadow Disciplines State Exclusivity & Flags

| State ID | State Name | `group` | `remhit` | `overlay1` | `castoverlay` | Exclusivity & Mechanics |
| :-: | :--- | :-: | :-: | :--- | :--- | :--- |
| `31` | `venomclaws` | `0` (`""`) | `0` | — | `venom_cast` | Independent (`group = 0`): stacks simultaneously with **either** Burst of Speed or Fade! |
| `152` | `clawmastery` | `0` | `0` | — | — | Passive state active whenever wielding `h2h` weapon (`WeaponClass` `1ht` / `ht1` / `ht2`). |
| `153` | `cloak_of_shadows` | `0` | `0` | — | `cloak_of_shadows` | Active on caster for `ln34` frames; blocks recasting Cloak of Shadows while active! |
| `155` | `weaponblock` | `0` | `0` | — | — | Passive state active when dual-wielding two `h2h` claws (`WEAPONCLASS_HT2 = 13`). |
| `156` | `cloaked` | `0` | **`1`** | `dimvision` | — | Applied to enemies by Cloak of Shadows; **`remhit = 1`** strips the blind state when the monster is hit? *(Wait: `remhit` removes state on hit only if checked; see `SrvDo047` below!)* |
| `157` | `quickness` | **`2`** | `0` | — | `quickness` | Mutually exclusive with `fade` (`group = 2`) via `sub_6FD11C90`. |
| `159` | `fade` | **`2`** | `0` | — | `fade_cast` | Mutually exclusive with `quickness` (`group = 2`) + renders translucent ethereal shimmer on Assassin. |
| `160` | `shadowwarrior` | `0` | `0` | — | — | Applied to Shadow Warrior / Shadow Master pet unit. |

### 3. `Missiles.txt` — Shadow Disciplines Missiles

| ID | Missile Name | `Range` | `SrvDo` | `CltDo` | `cPar1` | `wCltSubMissile1` | Role |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- | :--- |
| `551` | `mindblast hit` | 10 | `1` | `1` | — | — | Visual psychic impact ring spawned over Mind Blast area |
| `576` | `mindblast center` | 10 | `1` | `17` | `10` | `mindblast hit` (`#551`) | Client-only controller spawned by `SkillCltDoFunc[8]` (`0x6FAF1290`) |

---

## Core Shadow Disciplines Architecture

### 1. Buff Exclusivity: Burst of Speed (`#258`) vs. Fade (`#267`) vs. Venom (`#278`)

All three Assassin self-buffs use `SKILLS_SrvDo018_DefensiveBuff` (`0x6FC628F0` in 1.13c):

1. `SKILLS_SrvDo018_DefensiveBuff` reads `wAuraState` from `Skills.txt` (`quickness` `#157`, `fade` `#159`, or `venomclaws` `#31`) and immediately calls `sub_6FD11C90(pUnit, nAuraState, 0)` (`Skills.cpp`).
2. `sub_6FD11C90` inspects `pStatesTxtRecord->wGroup`:
   - If `wGroup != 0`, it iterates over all states in `States.txt` and removes any active state on `pUnit` whose `wGroup` matches (`STATES_ToggleState(pUnit, i, 0)` + `D2Common_10474(pUnit, pStatList)`).
   - Because `quickness` (`#157`) and `fade` (`#159`) both have **`wGroup = 2`**, casting **Burst of Speed** immediately removes **Fade**, and casting **Fade** immediately removes **Burst of Speed**.
   - Because `venomclaws` (`#31`) has **`wGroup = 0`**, **Venom is never removed by Burst of Speed or Fade** (and vice versa)—allowing Venom to remain active alongside either Burst of Speed or Fade!

### 2. Fade's Hidden Physical Damage Reduction (`STAT_DAMAGERESIST`)

In `Skills.txt`, **Fade (`#267`)** populates six `aurastat` slots when `SKILLS_SrvDo018_DefensiveBuff` (`0x6FC628F0`) calls `sub_6FD146D0`:

- `aurastat1`–`aurastat4`: `fireresist`, `coldresist`, `lightresist`, `poisonresist` = `dm12` ($\lfloor \frac{65 \times (110 \times \text{slvl})}{\text{slvl} + 6} / 100 \rfloor + 10$, scaling from `19%` at slvl 1 to `64%` at slvl 20, asymptotic cap `75%`).
- `aurastat5`: `curse_resistance` (`STAT_CURSE_RESISTANCE` `#109`) = `dm34` (`40%`–`90%` reduction in incoming curse and chill durations, capped at `79%` at slvl 20).
- **`aurastat6`: `damageresist` (`STAT_DAMAGERESIST` `#36`) = `ln78` (`Param7 + (slvl - 1) * Param8 = 1 + 1 * (slvl - 1) = slvl`)**:
  - Grants **+1% Physical Damage Reduction per effective skill level** of Fade (including soft `+skills` from items/Battle Command!), up to the global player `STAT_DAMAGERESIST` cap of `50%` enforced in `SUNITDMG_ApplyResistancesAndAbsorb`.
  - This bonus is completely unlisted on the client skill tooltip (`SkillDesc.txt`)!

### 3. Venom's 10-Frame (`0.4s`) Poison Length Override (`SUNITDMG_FillDamageValues`)

When **Venom (`#278`)** is cast (`SKILLS_SrvDo018_DefensiveBuff` @ `0x6FC628F0`):

1. `Skills.txt` specifies `EType = pois`, `HitShift = 6` (`2^6 = 64`, so `EMin` and `EMax` are scaled by $64/256 = 1/4$ in `Skills.txt` per-frame rate calculations), and `ELen = 10` frames (`0.4` seconds).
2. `SKILLS_SrvDo018_DefensiveBuff` sets three stats on the `venomclaws` (`#31`) statlist:
   - `aurastat1 = poisonmindam` (`enms`: per-frame minimum poison damage in 256ths)
   - `aurastat2 = poisonmaxdam` (`exms`: per-frame maximum poison damage in 256ths)
   - `aurastat3 = skill_poison_override_length` (`STAT_SKILL_POISON_OVERRIDE_LENGTH` `#362`) = `edma` (`10` frames)
3. **Weapon/Item Poison Compression (`SUNITDMG_FillDamageValues` in `SUnitDmg.cpp`)**:
   When the Assassin attacks with a melee or ranged weapon (or Blade Sentinel / Blade Fury / Blade Shield):
   ```cpp
   const int32_t nPoisonOverrideLength = STATLIST_UnitGetStatValue(pAttacker, STAT_SKILL_POISON_OVERRIDE_LENGTH, 0);
   if (nPoisonOverrideLength <= 0)
   {
       pDamage->dwPoisLen += STATLIST_UnitGetItemStatOrSkillStatValue(pAttacker, STAT_POISONLENGTH, 0);
       // ...
   }
   else
   {
       pDamage->dwPoisLen += nPoisonOverrideLength; // Always 10 frames (0.4s)!
   }
   ```
   - `STAT_POISONMINDAM` and `STAT_POISONMAXDAM` (which store **damage per frame** in 256ths of a hit point) from **all equipped items and charms are still summed into `pDamage->dwPoisDamage`**, but their durations (`STAT_POISONLENGTH`) are **discarded and overridden to 10 frames (`0.4s`)**!
   - Thus, any long-duration poison charm (e.g., a 10-second poison small charm) has its per-frame poison damage rate preserved, compressed into a `0.4s` window alongside Venom!

---

## Skill-by-Skill Mechanics & Assembly Reverse Engineering

### 1. Claw Mastery (`#252`)
- **Passive Application (`SKILLS_RefreshPassiveSkills` in `D2Common.dll`)**:
  - `Skills.txt` defines `passivestate = clawmastery` (`#152`) and `passiveitype = h2h` (`ItemTypes.txt` `#67`, Hand-to-Hand).
  - Applies three passive weapon mastery stats (`STAT_PASSIVE_MASTERY_MELEE_TH` = `30 + 10*(slvl-1)%` AR, `STAT_PASSIVE_MASTERY_MELEE_DMG` = `35 + 4*(slvl-1)%` ED, `STAT_PASSIVE_MASTERY_MELEE_CRIT` = `dm56` `0..25%` Critical Strike) to `pUnit`'s passive statlist.
  - Checked in `SUNITDMG_ApplyDamageBonuses` (`SUnitDmg.cpp`) whenever the attacking weapon's item type inherits from `ITEMTYPE_HAND_TO_HAND` (`h2h` / `h2h2`).
  - **Critical Strike Roll**: Rolls `STAT_PASSIVE_MASTERY_MELEE_CRIT` (`0..25%` diminishing returns: `15%` at slvl 1, `21%` at slvl 20) to double physical weapon damage; stacks multiplicatively with item Deadly Strike ($P(\text{2x}) = 1 - (1 - \text{CS})(1 - \text{DS})$).

### 2. Psychic Hammer (`#253`)
- **Server Start (`SKILLS_SrvSt22_PsychicHammer` @ `0x6FCB2060`)**:
  - Validates that a target exists (`SUNIT_GetTargetUnit != nullptr`) and has unobstructed line-of-sight (`COLLISION_CheckMaskWithPattern` with `COLLIDE_MISSILE_BARRIER`).
- **Server Do (`SKILLS_SrvDo033_PsychicHammer` @ `0x6FCB2770`)**:
  - Instant hitscan attack (no missile spawned). Re-validates LOS (`COLLISION_CheckMaskWithPattern`).
  - Rolls **both** Physical damage (`D2GAME_RollPhysicalDamage`: `MinDam..MaxDam` with `HitShift = 7` -> `/2` scaling) and Magic damage (`D2GAME_RollElementalDamage`: `EType = mag`, `EMin..EMax` with `HitShift = 7` -> `/2` scaling).
  - Evaluates Knockback probability by target category:
    - Normal Monster: `Calc1 = Param1 = 100%`
    - Unique Monster: `Calc2 = dm34` (`50%`–`100%`)
    - Boss / Player / Hireling: `Calc3/Calc4 = dm56` (`25%`–`99%`)
  - If the random roll `< nChance`, sets `DAMAGERESULTFLAG_KNOCKBACK` (`0x08`) and applies hit damage via `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`.
- **Client Start (`SkillCltStFunc[5]` @ `0x6FAF09B0`) & Do (`SkillCltDoFunc[3]` @ `0x6FAF0A40`)**:
  - `SkillCltStFunc[5]` verifies caster/target are outside town (`D2Common#10057`), target is a player or monster (`0 <= dwUnitType <= 1`), and LOS is clear (`call 0x6FB562A0` @ `0x6FAF0A1B`).
  - `SkillCltDoFunc[3]` calls `0x6FAF09B0` (`SkillCltStFunc[5]`) and sets `[esi+0xC4] |= 0x40`.

### 3. Weapon Block (`#263`)
- **Passive State (`weaponblock` `#155`, `STAT_PASSIVE_WEAPONBLOCK` `#337`)**:
  - Diminishing returns formula `dm12` (`Param1 = 20`, `Param2 = 65`): `26%` at slvl 1, `50%` at slvl 10, `57%` at slvl 20, `60%` at slvl 26.
  - Unlike Shield Block, Weapon Block is **not** affected by Dexterity and is **not** reduced to 1/3 when moving—instead, it is **completely disabled (0%) when walking or running**!
- **Exact Server Implementation (`SUNITDMG_ApplyDodge` & `SUNITDMG_GetWeaponBlock` in `SUnitDmg.cpp`)**:
  1. In `SUNITDMG_ApplyBlockOrDodge`, after shield block is checked (`if (bBlock) ...`), it checks `if (bAvoid)` and calls `SUNITDMG_ApplyDodge(pDefender, pAttacker, bBlock, bAvoid)`.
  2. Inside `SUNITDMG_ApplyDodge`:
     ```cpp
     if (pUnit->dwAnimMode == PLRMODE_RUN || pUnit->dwAnimMode == PLRMODE_WALK)
     {
         return BLOCKFLAG_NONE; // 0% Weapon Block while walking or running!
     }
     const int32_t nWeaponBlock = SUNITDMG_GetWeaponBlock(pUnit);
     ```
  3. Inside `SUNITDMG_GetWeaponBlock`:
     - Calls `COMPOSIT_GetWeaponClassId(pUnit, pInventory, &nWeaponClassId, -1, 1)`.
     - Requires **`nWeaponClassId == 13` (`WEAPONCLASS_HT2`, two Hand-to-Hand claws equipped simultaneously)** and `STATES_CheckState(pUnit, STATE_WEAPONBLOCK)`.
  4. **Missile & Elemental Spell Blocking**:
     - Because incoming elemental/magical projectiles (e.g., Fireball, Lightning, Bone Spirit, Blizzard shards, Diablo's Red Lightning Hose) call `SUNITDMG_ApplyBlockOrDodge` with `bBlock = 0` and **`bAvoid = 1`**, `SUNITDMG_ApplyDodge` still executes its `SUNITDMG_GetWeaponBlock` roll!
     - Therefore, **Weapon Block blocks almost all incoming elemental spells and missiles** (as well as melee and physical ranged attacks) whenever the Assassin is standing still, attacking (`A1`/`A2`/`KK`/`SQ`), or casting (`SC`/`S2`)! Only pure ground/radial DoTs with `bAvoid = 0` (such as Firewall or Meteor ground fire) bypass Weapon Block.

### 4. Cloak of Shadows (`#264`)
- **Recast Lockout**:
  - **Server (`SKILLS_SrvDo047_CloakOfShadows` @ `0x6FCB4B10`)**: Checks `if (STATES_CheckState(pUnit, STATE_CLOAK_OF_SHADOWS)) return 0;`—Cloak of Shadows **cannot be recast until its active duration (`ln34 = 200 + 25*(slvl-1)` frames) expires on the caster**!
  - **Client (`SkillCltStFunc[7]` @ `0x6FAF01A0`)**: Reads `wAuraState` (`WORD PTR [edx+0x80]` = `153`) and calls `D2Common#10494` (`STATES_CheckState` @ `0x6FAF01E1`), returning `0` (`neg eax; sbb eax, eax; inc eax`) if `STATE_CLOAK_OF_SHADOWS` is already set, preventing the client from even starting the `SC` cast animation.
- **Caster Defense Bonus & Environment Darkening (`SKILLS_SrvDo047` @ `0x6FCB4B10`)**:
  - Allocates a statlist for `STATE_CLOAK_OF_SHADOWS` (`#153`) on the caster with duration `AuraLenCalc = 200 + 25*(slvl-1)` frames (`8 + 1*(slvl-1)` seconds).
  - Evaluates `passivecalc1 = ln78` (`10 + 3*(slvl-1)%`) and sets `passivestat1` (`STAT_ITEM_ARMOR_PERCENT` `#16`) on the caster, granting **+10% to +67% Defense** (at slvl 1–20).
  - Broadcasts darkness environment effect to nearby clients (`sub_6FC3F710`).
- **Enemy Blind & Defense Penalty (`sub_6FCF8910` callback)**:
  - Searches all enemy units within `AuraRangeCalc = dm12` (`30` sub-tiles = **20 yards**) via `sub_6FD14BD0`.
  - On each valid target:
    - Applies `STATE_CLOAKED` (`#156`) for `200 + 25*(slvl-1)` frames.
    - Sets `aurastat1` (`STAT_SKILL_ARMOR_PERCENT` `#158`) to `-min(15 + 3*(slvl-1), 95)%` (`-15%` at slvl 1, `-72%` at slvl 20, capped at `-95%` at slvl 28+).
    - For normal monsters (`!MONSTERS_IsBoss` and `!MONSTERUNIQUE_CheckMonTypeFlag(CHAMPION | UNIQUE | SUPERUNIQUE)`), sets AI state to **`AISPECIALSTATE_DIMVISION` (`#23`)**, blinding them so they cannot use ranged/special attacks or acquire targets beyond melee range! (Unique/Champion/Boss monsters still suffer the `-Defense%` penalty even though they are immune to the `AISPECIALSTATE_DIMVISION` AI override.)

### 5. Mind Blast (`#273`)
- **Server Do (`SKILLS_SrvDo051_MindBlast` @ `0x6FCB57F0`)**:
  - Evaluates blast radius `AuraRangeCalc = Param7 = 4` sub-tiles (`2.67` yards) around the target coordinates (`D2GAME_GetXAndYFromTargetUnit_6FD14020`) and invokes `sub_6FCF9300` on every enemy in range (`sub_6FD14BD0`):
    1. **Physical Damage + Knockback**: Rolls physical damage (`MinDam..MaxDam = 10..20` + `+2/+5/+8` per level, `HitShift = 8`) and sets `DAMAGERESULTFLAG_KNOCKBACK` (`0x08`).
    2. **Stun**: Applies `STATE_STUNNED` (`#59`) for `ELen = min(250, 50 + 5*(slvl-1))` frames (`2.0s` at slvl 1 up to `10.0s` cap at slvl 41; vs Unique/Boss monsters, stun only takes effect on a random roll, and Players suffer hit recovery swirl).
    3. **Conversion (`sub_6FCF9120`, `STATE_CONVERSION` `#53`)**:
       - Evaluates conversion chance `dm56` (`Param5 = 15`, `Param6 = 40`: `17%` at slvl 1, `34%` at slvl 20, asymptotic cap `40%`).
       - Only normal monsters (`!MONSTERS_IsBoss`, `!MONSTERUNIQUE_CheckMonTypeFlag`, `MonStats2.txt` `isatt = 1`, and `caster_clvl >= monster_mlvl` or scaled chance) can be converted.
       - Conversion duration:
         $$\text{Duration} = \text{Param3} + \text{rnd}(\text{Param4}) = 150 + \text{rnd}(100) \text{ frames } (6.0\text{–}9.96\text{ seconds})$$
- **Client Do (`SkillCltDoFunc[8]` @ `0x6FAF1290`) & `MissileCltDoFunc[17]` (`0x6FB6BB40`)**:
  - `SkillCltDoFunc[8]` evaluates `dwAuraRangeCalc` (`4` sub-tiles) via `D2Common#10786` (`0x6FAF1317`), spawns `wCltMissileA` (`mindblast center` `#576`) at the target coordinates (`0x6FB630F0` @ `0x6FAF1364`), and stores `wCltMissileB` (`mindblast hit` `#551`) into `MissileParam1` (`D2Common#10440` @ `0x6FAF1378`) and the radius (`4`) into `MissileParam2` (`D2Common#10074` @ `0x6FAF1386`).
  - `MissileCltDoFunc[17]` (`0x6FB6BB40`) runs on `mindblast center` (`#576`): every 3 frames (`idiv 3` -> `test edx, edx` @ `0x6FB6BBC5`) while `frame < cPar1` (`10`), calls `0x6FB6B210` (`0x6FB6BBF4`) to spawn visual `mindblast hit` (`#551`) psychic shockwaves across the blast radius!

### 6. Shadow Warrior (`#268`) vs. Shadow Master (`#279`)
Both Shadow summons use **`SKILLS_SrvDo049_ShadowWarrior_Master` (`0x6FCB5980` in 1.13c)** and share **`PetType = 16` (`shadowwarrior`, `petmax = 1`)** with a **`150`-frame (`6.0s`) casting delay**:

1. **Shared Pet Slot**: Because both use `PetType = 16` (`petmax = 1`), summoning a Shadow Warrior despawns an active Shadow Master, and vice versa (`PlayerPets.cpp` `sub_6FC7DA40`).
2. **Base Stats (`SKILLS_SrvDo049` @ `0x6FCB5980` & `D2GAME_SetSummonPassiveStats_6FD0C530`)**:
   - **Monster Level (`mlvl`)**:
     $$\text{Shadow\_mlvl} = \min\!\left(\text{Caster\_clvl},\; \text{slvl} + \left\lfloor \frac{3 \times \text{Caster\_clvl}}{4} \right\rfloor\right)$$
   - **Hit Points**: Base `376` HP (`MonStats.txt` `MinHP = MaxHP = 376` in all difficulties), scaled by `+15% * slvl` (`Param1 = 15`).
   - **Aura/Passive Stats**:
     - Both gain `STAT_TOHIT = +40 * slvl`, `STAT_STRENGTH = +10 * slvl`, `STAT_DEXTERITY = +10 * slvl`.
     - **Shadow Warrior (`#268`)**: `STAT_SKILL_ARMOR_PERCENT = +12 * slvl%`; Elemental Resistances (`Fire/Cold/Light`) = $\min(4 \times \text{slvl}, 75)\%$.
     - **Shadow Master (`#279`)**: Elemental Resistances (`Fire/Cold/Light`) = `dm34` (`Param3 = 5`, `Param4 = 90`: `13%` at slvl 1, `71%` at slvl 20, asymptotic cap `90%`).
3. **Dynamic Magic/Rare Equipment Generation (`sub_6FCF9580` in `SkillAss.cpp`)**:
   Called during `D2GAME_SetSummonPassiveStats_6FD0C530` (`EquipLvl = 1` for Shadow Warrior, `EquipLvl = 2` for Shadow Master):
   - Computes item level:
     $$\text{ilvl} = \min(99,\; \text{Param5} + \text{Param6} \times \text{slvl}) = \begin{cases} \min(99, 18 + 2 \times \text{slvl}) & \text{Shadow Warrior} \\ \min(99, 24 + 3 \times \text{slvl}) & \text{Shadow Master} \end{cases}$$
   - **Shadow Warrior (`EquipLvl = 1`)**: Generates **Magic (`ITEMQUAL_MAGIC = 4`)** items in 4 slots: `Head`, `Torso`, `Rarm` (`h2h` claw), and `Larm` (`h2h` claw).
   - **Shadow Master (`EquipLvl = 2`)**: Generates items across up to **8 slots**, upgrading from **Magic (`ITEMQUAL_MAGIC = 4`)** to **Rare (`ITEMQUAL_RARE = 6`)** at higher skill levels (`slvl >= 11` for Rare weapons/armor, `slvl >= 13` for Rare helm/gloves, and `slvl >= 16–17` for Magic/Rare **Rings and Amulet** in `RingL`, `RingR`, `Neck`!).
4. **AI Skill Selection (`AiThink.cpp`)**:
   - **Shadow Warrior (`AITHINK_Fn105_ShadowWarrior` @ `0x6FCEA6D0` in 1.10f)**:
     - Every AI tick, reads the Assassin owner's **currently equipped Left and Right active skills** (`UNITS_GetLeftSkill`, `UNITS_GetRightSkill`).
     - Assigns those two skills to the Shadow Warrior at level:
       $$\text{WarriorSkillLvl} = \max\!\left(1,\; \left\lfloor \frac{\text{OwnerCurrentSkillLvl}}{2} \right\rfloor + \left\lfloor \frac{\text{ShadowWarriorSummonLvl}}{3} \right\rfloor\right)$$
     - Thus, the player can directly control which skills the Shadow Warrior uses (including laying traps or building charges) by swapping their own active Left/Right mouse buttons!
   - **Shadow Master (`D2GAME_AI_Unk106_6FCEAFE0` + `AITHINK_Fn106_143_ShadowMaster`)**:
     - On spawn (`D2GAME_AI_Unk106_6FCEAFE0`), iterates through **all 30 Assassin class skills** (`SKILLS_GetPlayerSkillCount(PLAYERCLASS_ASSASSIN)`), granting the Shadow Master every Assassin skill (except Shadow Warrior and Shadow Master) at level:
       $$\text{MasterSkillLvl} = \text{clamp}\!\left(\left\lfloor \frac{\text{ShadowMasterSummonLvl}}{2} \right\rfloor + \left\lfloor \frac{\text{OwnerCurrentSkillLvl}}{2} \right\rfloor,\; 1,\; 24\right)$$
     - In `AITHINK_Fn106_143_ShadowMaster`, evaluates distance, target immunities/resistances, progressive charge state, and self-buff status to autonomously cast Burst of Speed/Fade/Venom, Cloak of Shadows, Mind Blast, Martial Arts charge-ups + finishers, or Traps!
     - *(Note: Any trap laid by a Shadow Warrior or Shadow Master resolves `pOwner = AIGENERAL_GetMinionOwner(pUnit)` in `sub_6FCF8610`, so Shadow traps share the Assassin player's 5-trap `assassintrap` limit!)*

---

## Summary Verification Checklist (Web Port Parity)

- [ ] **Burst of Speed vs. Fade Exclusivity**: `quickness` (`#157`) and `fade` (`#159`) share `States.txt` `group = 2` (`sub_6FD11C90`), making them strictly mutually exclusive. `venomclaws` (`#31`) has `group = 0` and stacks with either.
- [ ] **Fade Hidden Physical DR**: Fade (`#267`) grants `+1%` `STAT_DAMAGERESIST` per effective skill level (`aurastat6 = damageresist`, `ln78`), capped at `50%` total player physical DR.
- [ ] **Venom 10-Frame Override**: Venom (`#278`) sets `STAT_SKILL_POISON_OVERRIDE_LENGTH = 10` (`0.4s`), forcing all item/charm poison durations to 10 frames while summing their per-frame poison damage rates (`SUNITDMG_FillDamageValues`).
- [ ] **Weapon Block Restrictions & Spell Blocking**: Weapon Block (`#263`) requires dual-wielding two `h2h` claws (`WEAPONCLASS_HT2 = 13`), drops to **0% while walking or running** (`PLRMODE_WALK` / `PLRMODE_RUN`), and blocks incoming elemental/magical projectiles (`bAvoid == 1` in `SUNITDMG_ApplyDodge`).
- [ ] **Cloak of Shadows Recast Lockout**: Both server (`SKILLS_SrvDo047` @ `0x6FCB4B10`) and client (`SkillCltStFunc[7]` @ `0x6FAF01A0`) block recasting Cloak of Shadows while `STATE_CLOAK_OF_SHADOWS` (`#153`) is active on the caster.
- [ ] **Shadow Warrior vs. Shadow Master Skill Formulas**: Shadow Warrior copies owner's active Left/Right skills at $\lfloor \text{OwnerLvl}/2 \rfloor + \lfloor \text{SummonLvl}/3 \rfloor$; Shadow Master knows all 28 non-Shadow Assassin skills at $\text{clamp}(\lfloor \text{SummonLvl}/2 \rfloor + \lfloor \text{OwnerLvl}/2 \rfloor, 1, 24)$ and spawns with Rare gear + rings/amulet at higher levels.
