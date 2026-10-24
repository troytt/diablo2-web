# Diablo II v1.13c Barbarian Combat Skills (`Skills.txt` #126, #132, #133, #139, #140, #143, #144, #147, #151, #152)

## 1. Dispatch Tables (`D2Client.dll` `0x6FAB0000`, `D2Game.dll` `0x6FC20000`)

### Client Skill Dispatch (`D2Client.dll`)
- `g_apfnSkillCltStFunc` (VA `0x6FB8E928`):
  - `[11]` = `0x6FAC4F30` (`SKILLS_CltSt11_Throw_LeftHandThrow_DoubleThrow`)
  - `[27]` = `0x6FB76290` (`SKILLS_CltSt27_DoubleSwing`)
  - `[29]` = `0x6FB776C0` (`SKILLS_CltSt29_Leap`)
  - `[30]` = `0x6FB77550` (`SKILLS_CltSt30_LeapAttack`)
  - `[31]` = `0x6FB77370` (`SKILLS_CltSt31_Whirlwind`)
- `g_apfnSkillCltDoFunc` (VA `0x6FB8EA48`):
  - `[1]` = `0x6FB24B90` (`SKILLS_CltDo01_Attack`)
  - `[39]` = `0x6FB76940` (`SKILLS_CltDo39_DoubleSwing_Frenzy`)
  - `[42]` = `0x6FB771D0` (`SKILLS_CltDo42_DoubleThrow`)
  - `[43]` = `0x6FB76ED0` (`SKILLS_CltDo43_Leap`)
  - `[44]` = `0x6FB76D00` (`SKILLS_CltDo44_LeapAttack`)
  - `[45]` = `0x6FB764B0` (`SKILLS_CltDo45_Whirlwind`)

### Server Skill Dispatch (`D2Game.dll`)
- `gpSkillSrvStartFnTable` (VA `0x6FD27338`):
  - `[1]` = `0x6FCC2C00` (`SKILLS_SrvSt01_Attack_LeftHandSwing`)
  - `[32]` = `0x6FC473C0` (`SKILLS_SrvSt32_Conversion_Bash_Stun_Concentrate_BearSmite`)
  - `[38]` = `0x6FC48290` (`SKILLS_SrvSt38_Whirlwind`)
  - `[39]` = `0x6FC489A0` (`SKILLS_SrvSt39_Berserk`)
  - `[40]` = `0x6FC47F30` (`SKILLS_SrvSt40_Leap`)
  - `[41]` = `0x6FC48600` (`SKILLS_SrvSt41_LeapAttack`)
- `gpSkillSrvDoFnTable` (VA `0x6FD274A8`):
  - `[2]` = `0x6FCC3220` (`SKILLS_SrvDo002_Kick_PowerStrike_MonIceSpear_Impale_Bash_Stun_Concentrate_BearSmite_Vengeance_Berserk_FireClaws`)
  - `[9]` = `0x6FC49600` (`SKILLS_SrvDo009_Frenzy`)
  - `[70]` = `0x6FC47B90` (`SKILLS_SrvDo070_DoubleSwing`)
  - `[74]` = `0x6FC47E30` (`SKILLS_SrvDo074_DoubleThrow`)
  - `[76]` = `0x6FC48BE0` (`SKILLS_SrvDo076_Whirlwind`)
  - `[77]` = `0x6FC494A0` (`SKILLS_SrvDo077_Leap`)
  - `[78]` = `0x6FC493B0` (`SKILLS_SrvDo078_LeapAttack`)

---

## 2. `Skills.txt` Master Overview (Barbarian Combat Tree)

| ID | Skill | `reqlevel` | `srvstfunc` | `srvdofunc` | `cltstfunc` | `cltdofunc` | `anim` / `seqnum` | `weapsel` | `itypea1` | `range` | `mana` (`lvlmana`) | `ToHit` (`LevToHit`) | `SrcDam` |
|---:|---|---:|---:|---:|---:|---:|---|---:|---|---|---|---:|---:|
| 126 | `Bash` | 1 | 32 | 2 | — | 1 | `A1` | 0 | `mele` | `h2h` | `2` (`0`) | `20` (`+5`) | 128 |
| 132 | `Leap` | 6 | 40 | 77 | 29 | 43 | `SQ` (`13`) | 0 | — | `lng` | `2` (`0`) | — | — |
| 133 | `Double Swing` | 6 | — | 70 | 27 | 39 | `SQ` (`11`) | 3 | `mele` | `h2h` | `9` (`-1`, shift `5`) | `15` (`+5`) | 128 |
| 139 | `Stun` | 12 | 32 | 2 | — | 1 | `A1` | 0 | `mele` | `h2h` | `2` (`0`) | `15` (`+5`) | 128 |
| 140 | `Double Throw` | 12 | — | 74 | 11 | 42 | `SQ` (`15`) | 3 | `thro` | `rng` | `2` (`0`) | `20` (`+10`) | 128 |
| 143 | `Leap Attack` | 18 | 41 | 78 | 30 | 44 | `SQ` (`14`) | 0 | `mele` | `lng` | `9` (`0`) | `50` (`+15`) | 128 |
| 144 | `Concentrate` | 18 | 32 | 2 | — | 1 | `A1` | 0 | `mele` | `h2h` | `2` (`0`) | `60` (`+10`) | 128 |
| 147 | `Frenzy` | 24 | 1 | 9 | — | 39 | `SQ` (`11`) | 3 | `mele` | `h2h` | `3` (`0`) | `100` (`+7`) | 128 |
| 151 | `Whirlwind` | 30 | 38 | 76 | 31 | 45 | `SQ` (`10`) | 2 | `mele` | `h2h` | `50` (`+1`, shift `7`) | `0` (`+5`) | 128 |
| 152 | `Berserk` | 30 | 39 | 2 | — | 1 | `A1` | 0 | `mele` | `h2h` | `4` (`0`) | `100` (`+15`) | 128 |

> [!NOTE]
> **`Double Swing` Mana Scaling (`manashift = 5`)**: `mana = 9`, `lvlmana = -1`, `minmana = 0`, `manashift = 5` ($\frac{1}{8}$ mana units). At `slvl = 1`, cost is $9 \times 2^{5-8} = 1.125$ mana (`2.0` displayed), decreasing by $0.125$ mana per level down to `0` at `slvl >= 9`.
> **`Whirlwind` Mana Scaling (`manashift = 7`)**: `mana = 50`, `lvlmana = 1`, `manashift = 7` ($\frac{1}{2}$ mana units). At `slvl = 1`, cost is $50 \times 0.5 = 25.0$ mana, increasing by $+0.5$ mana per level.

---

## 3. Single-Target Melee Strikes (`Bash`, `Stun`, `Concentrate`, `Berserk`)

### 3.1 Shared Start & Strike Pipeline (`SrvSt32` @ `0x6FC473C0` & `SrvDo002` @ `0x6FCC3220`)
`Bash` (#126), `Stun` (#139), and `Concentrate` (#144) share `SKILLS_SrvSt32_Conversion_Bash_Stun_Concentrate_BearSmite` (`0x6FC473C0`) and `SKILLS_SrvDo002` (`0x6FCC3220`):
1. **Melee Range Check & IAS Bonus (`SrvSt32`)**:
   - Verifies `UNITS_IsInMeleeRange(pUnit, pTarget, 0)`. If out of range, fails immediately (`return 0`).
   - Evaluates `calc3` (`Skills_EvaluateSkillFormula(pUnit, pSkillsTxtRecord->dwCalc[2], nSkillId, nSkillLevel)`). If `calc3 > 0`, applies a temporary `STAT_ATTACKRATE` stat list (`sub_6FD15470`) to accelerate the swing animation.
   - Pre-rolls hit determination (`SUNITDMG_RollDamage(..., 0, 128)`) and stores the result in `SkillParam1`.
2. **Temporary Self-Aura State (`SrvSt32` — `Concentrate`)**:
   - If `nAuraState` is valid (`Concentrate` has `aurastate = concentrate`, State #15), attaches or updates the `STATLIST_SKILL` state on the Barbarian (`D2Common_10474`), clears any existing stats (`STATLIST_ClearStats`), and calls `SKILLS_SetAuraStats` for `aurastat1..6`.
3. **Damage & Hit Application (`SrvDo002` @ `0x6FCC3220`)**:
   - Retrieves `SkillParam1` (hit success flag). If hit:
     - Computes `nDamagePercent = SKILLS_EvaluateSkillFormula(..., dwCalc[0])` (`calc1`).
     - Computes `nConvPct = SKILLS_EvaluateSkillFormula(..., dwCalc[3])` (`calc4`), using `nConvType = pSkillsTxtRecord->nEType` if `calc4 > 0`.
     - Calls `SUNITDMG_FillDamageValues` with `nDamagePercent`, `SrcDam = 128` (`100%` weapon damage), `nConvType`, and `nConvPct`.
     - Evaluates `calc2` (`dwCalc[1]`): adds flat physical damage `(calc2 << 8)` (in 1/256th HP fixed-point) directly to `damageData.dwPhysDamage` and `damageData.dwDmgTotal`!
     - Calls `SUNITDMG_AddLeechedLife` (life/mana steal + stun/elemental length from `EType`/`ELen`) and `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`.
   - Applies `srvoverlay` (`bash` #12 on `Bash`, `stun` #13 on `Stun`) to the target if hit.

### 3.2 Skill-Specific Formulas & Mechanics

#### **Bash (Skill #126)**
- **Damage Bonus (`calc1`)**: `ln12 + skill('Stun'.blvl)*par8` = `50 + (slvl - 1)*5 + blvl(Stun)*5` (`%ED`).
- **Flat Physical Damage (`calc2`)**: `ln34` = `1 + (slvl - 1)*1` flat damage added (`calc2 << 8`) after `%ED` in `SrvDo002`.
- **Attack Rating**: `+20% + (slvl - 1)*5%`, plus `+blvl(Concentrate)*5%` (`ToHitCalc = (15 + lvl*5) + skill('Concentrate'.blvl)*par7`).
- **Knockback & HitClass**: `ResultFlags = 8` (`RESULTFLAG_KNOCKBACK`), `HitClass = 112` (`0x70`, blunt/bash hit sound), `srvoverlay = bash` (Overlay #12: `Bash`, 20 frames, `PreDraw=0`, `Trans=1`).

#### **Stun (Skill #139)**
- **Damage Bonus (`calc1`)**: `skill('Bash'.blvl)*par8` = `+blvl(Bash)*8%` `%ED` (0% base ED without Bash points).
- **Attack Rating**: `+15% + (slvl - 1)*5%`, plus `+blvl(Concentrate)*5%`.
- **Stun Duration (`EType = stun`)**:
  - Base `ELen = 30` frames (1.2s), `ELevLen1 = 5` (slvl 2–8), `ELevLen2 = 5` (slvl 9–16), `ELevLen3 = 2` (slvl 17+), capped at `par7 = 250` frames (10.0s).
  - Synergy (`ELenSymPerCalc`): `+blvl(War Cry)*5%` stun duration (`par8 = 5`).
  - `HitClass = 96` (`0x60`), `srvoverlay = stun` (Overlay #13: `Stun`, 15 frames, `PreDraw=0`, `Trans=3`).

#### **Concentrate (Skill #144)**
- **Uninterruptible Flag**: `interrupt = 0` in `Skills.txt` (default melee skills have `interrupt = 1`). Neither hit recovery, block, nor stun interrupts the attack animation once initiated.
- **Damage Bonus (`calc1`)**: `ln12 + skill('Bash'.blvl)*par7 + skill('Battle Orders'.blvl)*par8` = `70 + (slvl - 1)*5 + blvl(Bash)*5 + blvl(Battle Orders)*10` (`%ED`).
- **Magic Damage Conversion Synergy (`calc4`, `EType = mag`)**:
  - `calc4 = skill('Berserk'.blvl)*par6` = `blvl(Berserk) * 1%` physical damage converted to magic damage during `SUNITDMG_FillDamageValues`.
- **Temporary Defense Buff (`aurastate = concentrate`, State #15)**:
  - Applied during `SrvSt32` for the duration of the swing animation (`State #15` has `attblue=1`, `acblue=1`).
  - Grants `aurastat1 = skill_armor_percent` (`ln34` = `100 + (slvl - 1)*10%` Enhanced Defense).

#### **Berserk (Skill #152)**
- **Server Start (`SKILLS_SrvSt39_Berserk` @ `0x6FC489A0`)**:
  - Verifies melee range (`UNITS_IsInMeleeRange`), rolls hit determination into `SkillParam1`, and applies `aurastate = berserk` (State #95) to the **caster**:
    - Duration: `calc2 = 75 - min(((110*lvl)/(lvl+6)*(75-25)/100), 50)` frames. At `slvl = 1`, the vulnerability lasts `68` frames (~2.72s), shrinking down to a floor of `25` frames (`1.0s`) at high skill levels (`par3 = 75`, `par4 = 25`).
    - State #95 (`berserk`) sets `aurastat1 = damagepercent` (`ln12 + blvl(Howl)*10 + blvl(Shout)*10`, blue stat display) and `aurastat2 = armor_override_percent = -100` (`STAT_ARMOR_OVERRIDE_PERCENT`).
    - In `UNITS_GetDefenseRate` (`D2Common/src/Units/Units.cpp:2384`), `STAT_ARMOR_OVERRIDE_PERCENT = -100` computes `nTotalDefense += nTotalDefense * (-100) / 100 = 0`, setting the Barbarian's total Defense to **0** while State #95 is active!
- **100% Post-Multiplier Physical-to-Magic Conversion (`SrvDo002` + `SUnitDmg.cpp:666`)**:
  - `EType = mag`, `calc4 = 100` (`100%` conversion).
  - In `SUNITDMG_FillDamageValues` (`D2Game/src/UNIT/SUnitDmg.cpp`), physical damage (`dwPhysDamage`) is first multiplied by weapon Mastery, Strength, off-weapon `%ED`, and `calc1` (`150 + (slvl - 1)*15 + blvl(Howl)*10 + blvl(Shout)*10`), and Critical/Deadly Strike is rolled on the physical damage.
  - **After** all physical multipliers and Critical/Deadly Strike, `nConvPct = 100` converts `100%` of `dwPhysDamage` into `dwMagDamage` (`dwPhysDamage = 0`). Because physical damage becomes `0`, Life Steal and Mana Steal do not leech on Berserk hits.

---

## 4. Dual-Wield Sequence Skills (`Double Swing`, `Double Throw`, `Frenzy`)

All three dual-wield skills set `weapsel = 3` (requiring two weapons equipped in `COMPOSIT_LEFTHAND` and `COMPOSIT_RIGHTHAND`) and `anim = SQ` (Sequence mode), driving multi-hit animations from `AnimData.d2` / sequence tables (`seqnum = 11` for melee dual swing, `seqnum = 15` for dual throw).

### 4.1 Double Swing (Skill #133)
- **Client Start (`SKILLS_CltSt27_DoubleSwing` @ `0x6FB76290`)**:
  - Evaluates `cltcalc1 = par5 = 50` (`0x6FB762B1`) and calls `0x6FB761F0` to apply a client-side `+50%` `STAT_ATTACKRATE` (EIAS) stat list to accelerate the `seqnum = 11` dual-swing sequence.
- **Client Do (`SKILLS_CltDo39_DoubleSwing_Frenzy` @ `0x6FB76940`)**:
  - Checks `pUnit->dwSeqFrame < 0x600` (frame 6 in 8-bit fixed-point):
    - On the first swing (`< 0x600`), plays the active weapon swing sound (`0x6FB369C0`).
    - On the second swing (`>= 0x600`), updates pathing toward the target (`D2Common_10488`) if out of melee range.
- **Server Do (`SKILLS_SrvDo070_DoubleSwing` @ `0x6FC47B90`)**:
  - Triggered on each sequence hit event frame in `seqnum = 11`.
  - Checks `(pUnit->dwSeqFrame >> 8) % 2`:
    - **First Swing (`even`, frame index 0)**: Attacks the primary target (`SUNIT_GetTargetUnit`), calling `SKILLS_SrvSt32` (which applies `calc3 = par5 = 50` `STAT_ATTACKRATE`) and `SKILLS_SrvDo002` (`calc1 = blvl(Bash)*10%` `%ED`).
    - **Second Swing (`odd`)**: Sets `pUnit->dwFlags |= UNITFLAG_SKSRVDOFUNC`. If the primary target is out of melee range or dead, searches within `UNITS_GetMeleeRange(pUnit) + 4` sub-tiles via `sub_6FD107F0` (`aurafilter = 0x8583`) to automatically acquire a nearby monster for the off-hand swing!

### 4.2 Double Throw (Skill #140)
- **Client Start (`SKILLS_CltSt11` @ `0x6FAC4F30`) & Client Do (`SKILLS_CltDo42` @ `0x6FB771D0`)**:
  - `CltSt11` validates dual throwing weapons (`itypea1 = thro`, `itypea2 = thro`, `weapsel = 3`), checks ammunition quantity (`STAT_QUANTITY`), and orients the unit path toward the target.
  - `CltDo42` (`0x6FB771D0`) fires on sequence events (`seqnum = 15`); when `pUnit->dwSeqFrame >= 0x900` (frame 9+), sets `pUnit->dwFlags |= 0x40` (`[edi + 0xC4] |= 0x40`) to advance the second-hand throw visual.
- **Server Do (`SKILLS_SrvDo074_DoubleThrow` @ `0x6FC47E30`)**:
  - Triggered twice during `seqnum = 15` (once per hand).
  - Calls `D2GAME_EVENTS_Delete_6FC34840(pGame, pUnit, EVENTTYPE_ENDANIM, 0)` and resolves the currently active hand weapon via `sub_6FD14C80(pUnit)` (`ITEMS_GetMissileType(pWeapon)`).
  - Temporarily adds `STAT_TOHIT` (`SKILLS_GetToHitFactor`: `+20% + (slvl - 1)*10%`) and `STAT_DAMAGEPERCENT` (`calc1 = skill('Double Swing'.blvl)*par8` = `+blvl(Double Swing)*8%` `%ED`) to `pUnit`, spawns the weapon missile via `sub_6FC7C7B0`, then subtracts both temporary stats immediately after spawning.

### 4.3 Frenzy (Skill #147)
- **Server Start (`SrvSt01` @ `0x6FCC2C00`) & Server Do (`SKILLS_SrvDo009_Frenzy` @ `0x6FC49600`)**:
  - Uses `seqnum = 11` (`weapsel = 3`, dual melee weapons) and shares `CltDo39` (`0x6FB76940`) with `Double Swing`.
  - On each sequence strike in `SrvDo009`:
    1. **Hit Roll (`SKILLS_RollFrenzyDamage`)**:
       - Evaluates `calc1` (`ln12 + (blvl(Double Swing) + blvl(Taunt))*par8` = `90 + (slvl - 1)*5 + (blvl(Double Swing) + blvl(Taunt))*8` `%ED`).
       - Evaluates `calc4` (`skill('Berserk'.blvl)*par6` = `blvl(Berserk)*1%` physical-to-magic conversion, `EType = mag`).
       - Rolls combat hit via `SUNITDMG_RollDamage`. Stores `1` in `SkillParam1` on hit, or `0` on miss!
    2. **Per-Hit Incremental Ramp (`SKILLS_ApplyFrenzyStats`)**:
       - Reads `SkillParam1`. **Only if the attack hit (`SkillParam1 != 0`)**:
         - Creates or updates `STATLIST_SKILL` for `aurastate = frenzy` (State #94, `overlay1 = frenzy1` #191) with duration `auralencalc = par7 = 150` frames (**6.0 seconds**).
         - Increments `STAT_SKILL_FRENZY` by `+1`, clamped to `nSkillLevel`:
           $$\text{nValue} = \min\left(\text{STAT\_SKILL\_FRENZY} + 1,\ \text{slvl}\right)$$
         - Evaluates `aurastat1 = velocitypercent` (`dm34`, `par3=20`, `par4=200`: `+47%` at stack 1 up to `+200%` asymptotic FRW) and `aurastat2 = attackrate` (`dm56`, `par5=0`, `par6=50`: `+7%` at stack 1 up to `+50%` asymptotic EIAS) **using `nValue` (`1..slvl`) as the effective skill level** (`SKILLS_SetAuraStats(pUnit, pStatList, pSkillsTxtRecord, nValue)`)!
         - Thus, Frenzy's attack speed and movement speed ramp up by 1 effective skill level per successful hit until reaching full `slvl` stacks, and each hit refreshes the 150-frame (6.0s) buff timer.

---

## 5. Parabolic Airborne Skills (`Leap` & `Leap Attack`)

### 5.1 Leap (Skill #132)
- **Trajectory Setup (`SKILLS_SrvSt40_Leap` @ `0x6FC47F30` & `SKILLS_CltSt29_Leap` @ `0x6FB776C0`)**:
  - Evaluates leap range `aurarangecalc = dm12` (`par1 = 4`, `par2 = 30` sub-tiles: `7` sub-tiles at slvl 1, scaling via diminishing returns up to `30` sub-tiles).
  - `SKILLS_FindLeapTargetPosition` clamps distance to `nAuraRange`, tests up to 3 candidate landing cells with `COLLISION_GetFreeCoordinates(..., 0x1C09)`, and verifies line-of-flight with `COLLISION_CheckMaskWithPattern2(..., COLLIDE_MASK_PLAYER_FLYING)`.
  - Stores landing coordinates in `SkillParam1` (`X`) and `SkillParam2` (`Y`), sets `SkillFlags = 0x100` (airborne), removes ground collision (`FootprintCollisionMask = COLLIDE_NONE`, `MoveTestCollisionMask = COLLIDE_NONE`), sets `PATHTYPE_LEAP` (`9`, `PATH_Leap_6FDAB1E0` @ `D2Common.0x6FDB77F0`), and sets horizontal velocity to `CharStatsTxt.nRunSpeed << 8` (`9 << 8 = 2304`).
  - Client (`CltSt29` @ `0x6FB776C0`) additionally initializes the parabolic vertical screen-offset arc via `0x6FB76AA0(pUnit, pPath)` (`seqnum = 13`).
- **Mid-Air Animation Rewind & Landing Knockback (`SKILLS_SrvDo077_Leap` @ `0x6FC494A0` & `SKILLS_CltDo43_Leap` @ `0x6FB76ED0`)**:
  - While `(SkillFlags & 0x100)` is set (`SKILLS_Leap`), each tick checks whether `(curX, curY) == (Param1, Param2)`:
    - If still airborne, calls `D2GAME_SKILLS_RewindSkillEx(pGame, pUnit, 10)` (and `0x6FB75F20(pUnit, 10)` on client) to hold/loop the animation at sequence frame `10` until touchdown!
    - Upon reaching `(Param1, Param2)`, clears `0x100`, sets `0x200` (landed), and restores `COLLIDE_PLAYER` footprint and `COLLIDE_MASK_PLAYER_PATH` move-test mask.
  - On the landing event (`SkillFlags & 0x200`), `SrvDo077` evaluates knockback radius `calc1 = ln34` (`4 + (slvl - 1)*1` sub-tiles) and calls `sub_6FD10200(..., nRadius, 0x8583)` to apply `wResultFlags = 9` (`RESULTFLAG_HIT | RESULTFLAG_KNOCKBACK`) to all valid enemies within `calc1` sub-tiles of the Barbarian!

### 5.2 Leap Attack (Skill #143)
- **Melee-Range Fallback (`SKILLS_SrvSt41_LeapAttack` @ `0x6FC48600` & `SKILLS_CltSt30_LeapAttack` @ `0x6FB77550`)**:
  - If the Barbarian targets a unit that is **already in melee range** (`UNITS_IsInMeleeRange(pUnit, pTarget, 0)`), `SrvSt41` (`SkillBar.cpp:891`) and `CltSt30` (`0x6FB775B8`) bypass the jump entirely and execute a ground melee swing (`sub_6FD150A0` / `0x6FB760A0`), setting `SkillFlags = 0x20` (`srvoverlay = bash`).
- **Landing Offset & Flight (`SKILLS_CheckIfCanLeapTo` @ `D2Common.0x6FDB3A80`)**:
  - If jumping toward a target unit, computes the landing point **2 sub-tiles past the target** along the flight vector (`target + 2 * dir / dist`), checking `COLLISION_RayTrace(..., COLLIDE_DOOR | COLLIDE_MISSILE_BARRIER)` and finding a free landing cell within radius `5`.
  - Sets `PATHTYPE_LEAP` (`9`), `FootprintCollisionMask = COLLIDE_NONE`, `MoveTestCollisionMask = COLLIDE_NONE`, velocity `CharStatsTxt.nRunSpeed << 8`, and `seqnum = 14`.
- **Mid-Air Rewind & Touchdown Strike (`SKILLS_SrvDo078_LeapAttack` @ `0x6FC493B0` & `SKILLS_CltDo44_LeapAttack` @ `0x6FB76D00`)**:
  - While airborne (`SkillFlags & 0x100`), rewinds sequence to frame `10` (`RewindSkillEx(..., 10)`).
  - Upon touchdown (`SkillFlags & 0x200`), searches for the target (or nearest enemy within melee range via `sub_6FD107F0(..., 0x8583)`). If a target is found, sets `SkillFlags |= 0x20` and rewinds/advances to sequence frame `16` (`RewindSkillEx(..., 16)`, `CltDo44` `0x6FB76DF8`) to play the overhead cleave strike!
  - On the strike frame (`SkillFlags & 0x20`), `SrvDo078` rolls damage with:
    - `calc1 = ln34 + skill('Leap'.blvl)*par8` = `100 + (slvl - 1)*30 + blvl(Leap)*10` (`%ED`).
    - `ToHit = 50 + (slvl - 1)*15%` Attack Rating.
    - `wResultFlags |= 8` (`RESULTFLAG_KNOCKBACK`), `dwHitFlags |= 0x20`, and applies `srvoverlay = bash` (Overlay #12) on hit.

---

## 6. Continuous Moving AoE (`Whirlwind`, Skill #151)

### 6.1 Start, Pathing & Collision (`SKILLS_SrvSt38_Whirlwind` @ `0x6FC48290` & `SKILLS_CltSt31_Whirlwind` @ `0x6FB77370`)
1. **Adjacent-Target Melee Fallback**:
   - At `SrvSt38` (`SkillBar.cpp:778`) and `CltSt31` (`0x6FB77411`), if `pTarget` is non-null and `UNITS_IsInMeleeRange(pUnit, pTarget, 0)` is true, Whirlwind falls back to a single ground strike (`sub_6FD150A0` / `0x6FB760A0`) instead of initiating a spin path.
2. **Destination Ray-Trace & Movement Setup (`SrvSt38` / `CltSt31`)**:
   - Clamps target distance (`sub_6FD15210` / `0x6FB76800` with max range `35` sub-tiles) and ray-traces along `PATHTYPE_STRAIGHT` (`7`) with `MoveTestCollisionMask = COLLIDE_MASK_PLAYER_WW` (`0x0C01` = `COLLIDE_WALL | COLLIDE_MISSILE_BARRIER | COLLIDE_BLANK`).
   - Calls `sub_6FD15500` to set movement velocity to `CharStatsTxt.nWalkSpeed << 8` (modified by the unit's current `STAT_VELOCITYPERCENT`, i.e., FRW / Slow / Freeze).
   - Sets `MoveTestCollisionMask = 0x0401` (`COLLIDE_WALL | COLLIDE_MISSILE_BARRIER | COLLIDE_BLANK | COLLIDE_NO_PATH` on server) so the spinning Barbarian passes unimpeded through unit footprints (`COLLIDE_PLAYER` / `COLLIDE_MONSTER`).
   - Applies `STATE_SKILL_MOVE` (State #18) and `aurastate = whirlwind` (State #174) on the Barbarian, sets `SkillParam4 = 0` (next hit-check frame), and uses `seqnum = 10`, `weapsel = 2`.

### 6.2 Hit-Check Frame Breakpoints & Dual-Wield Mechanics (`SKILLS_SrvDo076_Whirlwind` @ `0x6FC48BE0`)
Every server frame while spinning, `SrvDo076` checks if `pGame->dwGameFrame >= SkillParam4`:
1. **Guaranteed Frame-0 & Frame-4 Initial Hit Checks (`SkillBar.cpp:967–1000`)**:
   - On the very first tick of `SrvDo076` (`SkillParam4 == 0`), a hit check executes immediately (`frame 0`) and schedules the second hit check at:
     $$\text{SkillParam4} = \text{dwGameFrame} + 4$$
   - Thus, the first two hit checks **always** occur at **frame 0** and **frame 4**, regardless of weapon speed!
2. **Weapon-Only IAS Breakpoint Ladder (Subsequent Hit Checks)**:
   - After frame 4 (`SkillParam4 != 0`), `SrvDo076` computes weapon attack speed for the active weapon via `ITEMS_GetWeaponAttackSpeed(pUnit, pWeapon)`:
     $$\text{nAttackSpeed} = \text{WSM} - \text{WeaponIAS}$$
     *(Note: Only IAS on the weapon itself is read; off-weapon IAS, Fanaticism, Frenzy, Cold/Decrepify slow do NOT affect `ITEMS_GetWeaponAttackSpeed`, though `nAttackSpeed` is clamped to `[1, 75]` after internal WSM scaling).*
   - In `SkillBar.cpp:976–1000`, `nAttackSpeed` maps to the frame interval `nDuration` until the next hit check:

| `ITEMS_GetWeaponAttackSpeed` (`nAttackSpeed`) | Effective `WeaponIAS - WSM` Breakpoint (1H / 2H Sword) |Effective `WeaponIAS - WSM` Breakpoint (2H Non-Sword) | Frames Per Hit Check (`nDuration`) |
|---|---|---|---:|
| `< 12` | `>= +34` | `>= +60` | **4 frames** |
| `12 .. 14` | `+10 .. +33` | `+30 .. +59` | **6 frames** |
| `15 .. 17` | `-15 .. +9` | `0 .. +29` | **8 frames** |
| `18 .. 19` | `-34 .. -16` | `-29 .. -1` | **10 frames** *(also Unarmed)* |
| `20 .. 22` | `-59 .. -35` | `-59 .. -30` | **12 frames** |
| `23 .. 25` | `-89 .. -60` | `-89 .. -60` | **14 frames** |
| `>= 26` | `<= -90` | `<= -90` | **16 frames** |

3. **Dual-Wield Double Strike (`nCount = 2`, `SkillBar.cpp:1005–1042`)**:
   - Inspects `COMPOSIT_LEFTHAND` and `COMPOSIT_RIGHTHAND` via `INVENTORY_GetCompositItem`: if **both** hands hold valid melee weapons (`ITEMS_CanBeEquipped` && `ITEMS_CheckItemTypeId(..., ITEMTYPE_MELEE_WEAPON)`), sets `nCount = 2` (otherwise `nCount = 1`).
   - Loops `nCount` times on that hit-check frame:
     - Searches for a target within `5` sub-tiles (`sub_6FD107F0(pGame, pUnit, 0, 0, 5, 0x8583, lastTargetId, ...)`), preferring a different target for the second weapon if one is in range.
     - Rolls hit & damage (`calc1 = ln12 = -50 + (slvl - 1)*8` `%ED`, `ToHit = (slvl - 1)*5%` AR), toggling skill flag `0x2000` (`sub_6FD15340` / `sub_6FD15320`) between iterations so the primary hand and off-hand each roll their own weapon damage, WSM interval, and on-hit modifiers!
   - When the Barbarian reaches `(SkillParam1, SkillParam2)` (`SkillFlags & 0x200`), `SrvDo076` clears `STATE_SKILL_MOVE` (#18) and `STATE_WHIRLWIND` (#174) and restores normal player path collision.
