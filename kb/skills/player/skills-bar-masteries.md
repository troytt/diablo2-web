# Diablo II v1.13c Barbarian Combat Masteries (`Skills.txt` #127, #128, #129, #134, #135, #136, #141, #145, #148, #153)

## 1. Passive Skill Architecture (`D2Common.dll` & `D2Game.dll`)

All 10 skills in the Barbarian Combat Masteries tree have `passive = 1` in `Skills.txt` and **no** active dispatch functions (`srvstfunc = 0`, `srvdofunc = 0`, `cltstfunc = 0`, `cltdofunc = 0` — i.e., `NULL` entries in `D2Game.dll` `gpSkillSrvStartFnTable @ 0x6FD27338` / `gpSkillSrvDoFnTable @ 0x6FD274A8` (`ImageBase = 0x6FC20000`) and `D2Client.dll` `g_apfnSkillCltStFunc @ 0x6FB8E928` / `g_apfnSkillCltDoFunc @ 0x6FB8EA48` (`ImageBase = 0x6FAB0000`)). Instead, they operate through the engine's passive skill refresh pipeline:

1. **`SKILLS_RefreshPassiveSkills` (`D2Common/src/D2Skills.cpp:179`)**:
   - Invoked whenever a unit's skill levels or equipment change (skill point allocation, `+skills` gear equip/unequip, Battle Command, shrine buffs, etc.).
   - Iterates across all skills for the unit's class (`DATATBLS_GetClassSkillCount`), checking `pSkillsTxtRecord->dwFlags[0] & SKILLFLAG_PASSIVE`.
   - Calls `SKILLS_RefreshSkill(pUnit, nSkillId)` for every passive skill.
2. **`SKILLS_RefreshSkill` (`D2Common/src/D2Skills.cpp:122`)**:
   - Looks up the skill's `nPassiveState` (`States.txt` row ID) and current effective skill level `nSkillLevel = SKILLS_GetSkillLevel(pUnit, pSkill, 1)`.
   - If `nSkillLevel <= 0`, removes any existing `STATLIST_PASSIVE` stat list for `nPassiveState` (`STATLIST_GetStatListFromUnitAndState` -> `D2Common_10474` + `STATES_ToggleState(..., 0)`).
   - If `nSkillLevel > 0`, allocates or clears the unit's `STATLIST_PASSIVE` (`0x200`) stat list for `nPassiveState`, toggles the state bit on (`STATES_ToggleState(pUnit, nPassiveState, 1)`), and calls `D2Common_11020` (`SKILLS_SetPassiveStats`).
3. **`D2Common_11020` / `SKILLS_SetPassiveStats` (`D2Common/src/D2Skills.cpp:58`)**:
   - Evaluates up to 5 `passivestat1..5` / `passivecalc1..5` pairs on the `Skills.txt` record (`SKILLS_EvaluateSkillFormula(pUnit, pSkillsTxtRecord->dwPassiveCalc[i], nSkillId, nSkillLevel)`).
   - **Critical Layer Encoding for Weapon Masteries**:
     - Reads `nLayer = pSkillsTxtRecord->wPassiveIType` (`passiveitype` in `Skills.txt`, e.g., `swor`, `axe`, `blun`, `pole`, `thro`, `spea`).
     - Calls `STATLIST_SetStatIfListIsValid(pStatList, nStatId, nValue, nLayer)`, storing the `ItemTypes.txt` ID directly in the stat's **`wLayer` (parameter)** field!
     - Because `wLayer` distinguishes each weapon type, a Barbarian can simultaneously hold active `STAT_PASSIVE_MASTERY_MELEE_TH` (#330), `STAT_PASSIVE_MASTERY_MELEE_DMG` (#331), and `STAT_PASSIVE_MASTERY_MELEE_CRIT` (#332) stats for Sword, Axe, Mace, Pole Arm, and Spear without overwriting one another!

---

## 2. `Skills.txt` & `States.txt` Master Table (Barbarian Combat Masteries)

| ID | Skill | `reqlevel` | `passivestate` (`States.txt` ID) | `passiveitype` (`ItemTypes.txt`) | `passivestat1` (`calc1`) | `passivestat2` (`calc2`) | `passivestat3` (`calc3`) | `passivestat4` (`calc4`) | `Param1..6` |
|---:|---|---:|---|---|---|---|---|---|---|
| 127 | `Sword Mastery` | 1 | `swordmastery` (`#66`) | `swor` (Sword) | `passive_mastery_melee_th` (`ln12`) | `passive_mastery_melee_dmg` (`ln34`) | `passive_mastery_melee_crit` (`dm56`) | — | `28, 8, 28, 5, 0, 35` |
| 128 | `Axe Mastery` | 1 | `axemastery` (`#67`) | `axe` (Axe) | `passive_mastery_melee_th` (`ln12`) | `passive_mastery_melee_dmg` (`ln34`) | `passive_mastery_melee_crit` (`dm56`) | — | `28, 8, 28, 5, 0, 35` |
| 129 | `Mace Mastery` | 1 | `macemastery` (`#68`) | `blun` (Blunt) | `passive_mastery_melee_th` (`ln12`) | `passive_mastery_melee_dmg` (`ln34`) | `passive_mastery_melee_crit` (`dm56`) | — | `28, 8, 28, 5, 0, 35` |
| 134 | `Pole Arm Mastery` | 6 | `polearmmastery` (`#69`) | `pole` (Polearm) | `passive_mastery_melee_th` (`ln12`) | `passive_mastery_melee_dmg` (`ln34`) | `passive_mastery_melee_crit` (`dm56`) | — | `30, 8, 28, 5, 0, 35` |
| 135 | `Throwing Mastery` | 6 | `throwingmastery` (`#70`) | `thro` (Throwing) | `passive_mastery_throw_th` (`ln12`) | `passive_mastery_throw_dmg` (`ln34`) | `passive_mastery_throw_crit` (`dm56`) | — | `30, 8, 25, 5, 0, 35` |
| 136 | `Spear Mastery` | 6 | `spearmastery` (`#71`) | `spea` (Spear) | `passive_mastery_melee_th` (`ln12`) | `passive_mastery_melee_dmg` (`ln34`) | `passive_mastery_melee_crit` (`dm56`) | — | `30, 8, 28, 5, 0, 35` |
| 141 | `Increased Stamina` | 12 | `increasedstamina` (`#73`) | — (`0`) | `staminapercent` (`ln12`) | — | — | — | `30, 15` |
| 145 | `Iron Skin` | 18 | `ironskin` (`#75`) | — (`0`) | `skill_armor_percent` (`ln12`) | — | — | — | `30, 10` |
| 148 | `Increased Speed` | 24 | `increasedspeed` (`#76`) | — (`0`) | `velocitypercent` (`dm12`) | — | — | — | `7, 50` |
| 153 | `Natural Resistance` | 30 | `naturalresistance` (`#79`) | — (`0`) | `fireresist` (`dm12`) | `lightresist` (`dm12`) | `coldresist` (`dm12`) | `poisonresist` (`dm12`) | `0, 80` |

---

## 3. Core Formula Functions (`lnXY` & `dmXY`)

### 3.1 Linear Scaling (`lnXY`)
$$\text{ln}(X, Y) = \text{Param}_X + (\text{slvl} - 1) \cdot \text{Param}_Y$$

### 3.2 Diminishing Returns Scaling (`dmXY`, `D2Common.#11033` / `SKILLS_CalculateDiminishingReturns` @ `D2Common/src/D2Skills.cpp:1767`)
```cpp
int __stdcall D2Common_11033(int nSkillLevel, int nParamX, int nParamY)
{
    return nParamX + (nParamY - nParamX) * (110 * nSkillLevel / (nSkillLevel + 6)) / 100;
}
```
$$\text{dm}(X, Y) = \text{Param}_X + \left\lfloor \frac{(\text{Param}_Y - \text{Param}_X) \cdot \left\lfloor \frac{110 \cdot \text{slvl}}{\text{slvl} + 6} \right\rfloor}{100} \right\rfloor$$

---

## 4. Weapon Masteries (`#127`, `#128`, `#129`, `#134`, `#135`, `#136`)

### 4.1 Runtime Weapon Matching (`SKILLS_GetWeaponMasteryBonus` & `D2Common_11024`)
When the Barbarian attacks in melee or throws a weapon, the engine does **not** hardcode skill IDs. Instead, it calls `SKILLS_GetWeaponMasteryBonus(pUnit, pWeapon, nStatId, bThrow)` (`D2Common/src/D2Skills.cpp:1735`) -> `D2Common_11024` (`D2Common/src/D2Skills.cpp:1671`):
1. If `bThrow == 1` (ranged throw via `Throw`, `Left Hand Throw`, or `Double Throw`, where `ITEMS_CheckIfThrowable(pWeapon)` is true), it translates:
   - `STAT_PASSIVE_MASTERY_MELEE_TH` (#330) $\to$ `STAT_PASSIVE_MASTERY_THROW_TH` (#333)
   - `STAT_PASSIVE_MASTERY_MELEE_DMG` (#331) $\to$ `STAT_PASSIVE_MASTERY_THROW_DMG` (#334)
   - `STAT_PASSIVE_MASTERY_MELEE_CRIT` (#332) $\to$ `STAT_PASSIVE_MASTERY_THROW_CRIT` (#335)
   *(Note: Using a throwing axe or javelin in **melee** passes `bThrow = 0`, matching `Axe Mastery` or `Spear Mastery` instead of `Throwing Mastery`!)*
2. `D2Common_11024` iterates over all entries of `nStatId` in the unit's merged stat array (`STATLIST_GetStatArray`), checking:
   ```cpp
   if (ITEMS_CheckItemTypeId(pWeapon, pStat[i].nLayer))
   ```
   and returns the highest matching bonus (`nMaxValue`).
3. **`Mace Mastery` (`passiveitype = blun`) Inheritance**:
   - Because `Mace Mastery` (#129) sets `passiveitype = blun` (`ITEMTYPE_BLUNT`) rather than `mace`, `ITEMS_CheckItemTypeId(pWeapon, ITEMTYPE_BLUNT)` walks the `ItemTypes.txt` `Equiv1`/`Equiv2` hierarchy and matches **every blunt subtype**: Clubs (`club`), Maces (`mace`), Hammers (`hamm`), Scepters (`scep`), Staves (`staf`), and Wands (`wand`)!

### 4.2 Exact Scaling Formulas & Breakpoints

#### **Sword Mastery (#127), Axe Mastery (#128), Mace Mastery (#129)**
- **Attack Rating (`ln12`)**: $+28\% + (\text{slvl} - 1) \times 8\%$ (`+28%` at slvl 1, `+180%` at slvl 20).
- **Enhanced Damage (`ln34`)**: $+28\% + (\text{slvl} - 1) \times 5\%$ (`+28%` at slvl 1, `+123%` at slvl 20).
- **Critical Strike (`dm56`, `0..35%`)**: $\left\lfloor \frac{35 \cdot \lfloor 110 \cdot \text{slvl} / (\text{slvl} + 6) \rfloor}{100} \right\rfloor\%$ (`5%` at slvl 1, `19%` at slvl 10, `22%` at slvl 20, `25%` at slvl 30).

#### **Pole Arm Mastery (#134) & Spear Mastery (#136)**
- **Attack Rating (`ln12`)**: $+30\% + (\text{slvl} - 1) \times 8\%$ (`+30%` at slvl 1, `+182%` at slvl 20).
- **Enhanced Damage (`ln34`)**: $+28\% + (\text{slvl} - 1) \times 5\%$ (`+28%` at slvl 1, `+123%` at slvl 20).
- **Critical Strike (`dm56`, `0..35%`)**: Same `dm(0, 35)` curve as Sword/Axe/Mace (`5%` at slvl 1, `22%` at slvl 20).

#### **Throwing Mastery (#135)**
- **Attack Rating (`ln12`)**: $+30\% + (\text{slvl} - 1) \times 8\%$ (`+30%` at slvl 1, `+182%` at slvl 20).
- **Enhanced Damage (`ln34`)**: $+25\% + (\text{slvl} - 1) \times 5\%$ (`+25%` at slvl 1, `+120%` at slvl 20).
- **Critical Strike (`dm56`, `0..35%`)**: Same `dm(0, 35)` curve (`5%` at slvl 1, `22%` at slvl 20).

### 4.3 Combat Damage & Critical Strike Integration (`D2Game/src/UNIT/SUnitDmg.cpp`)
1. **Additive Off-Weapon `%ED` (`SUNITDMG_ApplyDamageBonuses` @ `SUnitDmg.cpp:200`)**:
   - `nDamagePercent += SKILLS_GetWeaponMasteryBonus(pUnit, pWeapon, STAT_PASSIVE_MASTERY_MELEE_DMG, bThrow)`
   - Added into the same off-weapon `%ED` bucket as Strength/Dexterity bonus, skill `%ED`, and non-weapon gear/aura `%ED`.
2. **Mutually Exclusive Critical Strike Roll (`SUNITDMG_FillDamageValues` @ `SUnitDmg.cpp:324–356`)**:
   - The three sources of $2\times$ physical damage are evaluated in a strict `if / else if / else` chain:
     1. **Weapon Mastery Critical Strike** (`SKILLS_GetWeaponMasteryBonus(..., STAT_PASSIVE_MASTERY_MELEE_CRIT, bThrow)`) rolls `0..99 < nCrit`. If successful, doubles `dwPhysDamage` (`dwPhysDamage *= 2`, `wResultFlags |= RESULTFLAG_CRITICALSTRIKE`).
     2. **`else if` Amazon Critical Strike** (`STAT_PASSIVE_CRITICAL_STRIKE`) rolls `0..99 < nAmazonCrit`.
     3. **`else` Item Deadly Strike** (`STAT_ITEM_DEADLYSTRIKE`) rolls `0..99 < nDeadlyStrike`.
   - Because they are mutually exclusive, total probability of $2\times$ physical damage for a Barbarian with Weapon Mastery Crit $C_M$ and Deadly Strike $D$ is:
     $$P(2\times) = 1 - \left(1 - \frac{C_M}{100}\right)\left(1 - \frac{D}{100}\right)$$
   - They can **never** trigger together for $4\times$ damage.

---

## 5. Utility & Defensive Passives (`#141`, `#145`, `#148`, `#153`)

### 5.1 Increased Stamina (Skill #141)
- **State**: `increasedstamina` (State #73, `States.txt`).
- **Stat**: `passivestat1 = staminapercent` (`STAT_STAMINAPERCENT`, ID #28).
- **Formula (`ln12`, `Param1 = 30`, `Param2 = 15`)**:
  $$\text{Stamina Bonus} = 30\% + (\text{slvl} - 1) \times 15\%$$
  - `slvl = 1`: `+30%` Max Stamina (`STAT_MAXSTAMINA` multiplier).
  - `slvl = 20`: `+315%` Max Stamina.
  - Also acts as a synergy for **Battle Orders**? No — Battle Orders boosts Stamina directly; Increased Stamina has no outgoing synergies in 1.13c, only serves as prerequisite (`reqskill1`) for **Increased Speed** (#148).

### 5.2 Iron Skin (Skill #145)
- **State**: `ironskin` (State #75, `States.txt`: `acblue = 1`).
- **Stat**: `passivestat1 = skill_armor_percent` (`STAT_SKILL_ARMOR_PERCENT`, ID #171).
- **Formula (`ln12`, `Param1 = 30`, `Param2 = 10`)**:
  $$\text{Defense Bonus} = 30\% + (\text{slvl} - 1) \times 10\%$$
  - `slvl = 1`: `+30%` Defense; `slvl = 20`: `+220%` Defense.
  - In `UNITS_GetDefenseRate` (`D2Common/src/Units/Units.cpp:2362`), `STAT_SKILL_ARMOR_PERCENT` stacks **additively** with `Shout`, `Concentrate`, and `Defiance` before multiplying total base armor + shield defense.
  - Also grants `+10%` synergy per base level (`blvl`) to **Shout** (#138)? Wait: in 1.13c, `Shout` has no `%EDef` synergy; `Shout` grants `+10%/blvl` magic damage synergy to `Berserk` and `+5s/blvl` duration to `Battle Orders`/`Battle Command`. `Iron Skin` is the prerequisite (`reqskill1`) for **Natural Resistance** (#153).

### 5.3 Increased Speed (Skill #148)
- **State**: `increasedspeed` (State #76, `States.txt`: `velblue = 1`).
- **Stat**: `passivestat1 = velocitypercent` (`STAT_VELOCITYPERCENT`, ID #67 — skill-based Faster Run/Walk).
- **Formula (`dm12`, `Param1 = 7`, `Param2 = 50`)**:
  $$\text{Velocity Bonus} = 7 + \left\lfloor \frac{43 \cdot \left\lfloor \frac{110 \cdot \text{slvl}}{\text{slvl} + 6} \right\rfloor}{100} \right\rfloor\%$$
  - `slvl = 1`: $+7 + \lfloor 43 \times 15 / 100 \rfloor = +13\%$ effective Run/Walk speed (`EFRW`).
  - `slvl = 5`: $+28\%$ `EFRW`.
  - `slvl = 10`: $+36\%$ `EFRW`.
  - `slvl = 20`: $+43\%$ `EFRW`.
  - **Crucial Engine Distinction (`STAT_VELOCITYPERCENT` vs `STAT_ITEM_FASTERMOVEVELOCITY`)**: Unlike item FRW (`STAT_ITEM_FASTERMOVEVELOCITY`, which undergoes a diminishing-returns conversion `(150 * itemFRW) / (150 + itemFRW)`), `STAT_VELOCITYPERCENT` from `Increased Speed` and `Frenzy` is **direct Effective FRW (`EFRW`)** added straight to movement velocity without secondary diminishing returns!

### 5.4 Natural Resistance (Skill #153)
- **State**: `naturalresistance` (State #79, `States.txt`: `rcblue=1`, `rlblue=1`, `rfblue=1`, `rpblue=1`).
- **Stats**:
  - `passivestat1 = fireresist` (`STAT_FIRERESIST`, ID #39)
  - `passivestat2 = lightresist` (`STAT_LIGHTRESIST`, ID #41)
  - `passivestat3 = coldresist` (`STAT_COLDRESIST`, ID #43)
  - `passivestat4 = poisonresist` (`STAT_POISONRESIST`, ID #45)
- **Formula (`dm12`, `Param1 = 0`, `Param2 = 80`)**:
  $$\text{All Resistances} = \left\lfloor \frac{80 \cdot \left\lfloor \frac{110 \cdot \text{slvl}}{\text{slvl} + 6} \right\rfloor}{100} \right\rfloor\%$$
  - `slvl = 1`: `+12%` to Fire, Lightning, Cold, and Poison Resistances.
  - `slvl = 5`: `+40%` All Resistances.
  - `slvl = 10`: `+54%` All Resistances.
  - `slvl = 15`: `+62%` All Resistances.
  - `slvl = 20`: `+67%` All Resistances.
  - `slvl = 30`: `+72%` All Resistances.
