# Diablo II v1.13c Amazon Passive & Magic Skills Mechanics (Skills #8, #9, #13, #17, #18, #23, #28, #29, #32, #33)

## 1. Dispatch Tables & Core Engine Functions (`D2Client.dll` `0x6FAB0000`, `D2Game.dll` `0x6FC20000`, `D2Common.dll` `0x6FD50000`)

### 1.1 Skill Dispatch Tables (`D2Game.dll`)
- `g_apfnSkillSrvDoFunc`: VA `0x6FD274A8`
  - `g_apfnSkillSrvDoFunc[6]` = `0x6FC6C2A0` (`SKILLS_SrvDo006_InnerSight_SlowMissiles`) — Radial enemy debuff aura (`Inner Sight` #8, `Slow Missiles` #17) with callback `0x6FC6C0E0` (`SKILLS_SrvDo006_Callback`)
  - `g_apfnSkillSrvDoFunc[15]` = `0x6FC6D8C0` (`SKILLS_SrvDo015_Dopplezon`) — Summons `dopplezon` (`hcIdx=356`), clones caster appearance & base equipment, applies temporary summon UMod (`#21`)
  - `g_apfnSkillSrvDoFunc[16]` = `0x6FC6D710` (`SKILLS_SrvDo016_Valkyrie`) — Summons `valkyrie` (`hcIdx=357`), generates `MonEquip.txt` magic/rare gear at `ilvl = 25 + 3*(slvl-1)`

*(Note: All 6 true passive skills—#9, #13, #18, #23, #29, #33—have `SrvStFunc = 0, SrvDoFunc = 0, CltStFunc = 0, CltDoFunc = 0`, and are applied automatically via `SKILLS_RefreshSkill` when learned or modified. Active magic skills #8, #17, #28, #32 use standard `SC` spellcast animation without custom `CltStFunc`/`CltDoFunc`.)*

### 1.2 Core Combat, Passive & Summon Engine Functions
- `D2Common.dll` (`0x6FD50000`):
  - `D2Common_11033` (`0x6FDB3AB0`, `SKILLS_CalculateDiminishingReturns` / `dm` formula): Computes diminishing-returns curves for Critical Strike, Dodge, Avoid, Evade, and Pierce.
  - `D2Common_10957` (`0x6FDAF8C0`, `SKILLS_RefreshSkill`): Evaluates `passivecalc1..5` and attaches `nPassiveState` (`STATLIST_AllocStatList` with `Passivestat1..5`) to the Amazon.
- `D2Game.dll` (`0x6FC20000`):
  - `SUNITDMG_FillDamageValues` (`0x6FCBE7E0`): Rolls `STAT_PASSIVE_CRITICAL_STRIKE` in the mutually exclusive Critical Hit chain (`Mastery Crit` $\to$ `Critical Strike` $\to$ `Deadly Strike`).
  - `SUNITDMG_ApplyBlockOrDodge` (`0x6FCC2530`) & `SUNITDMG_ApplyDodge` (`0x6FCC2610`): Resolves Shield Block followed by `STAT_PASSIVE_EVADE` (if moving), `STAT_PASSIVE_DODGE` (if stationary vs melee), or `STAT_PASSIVE_AVOID` (if stationary vs missile).
  - `MISSMODE_PierceHandler` (`0x6FC58E00`): Rolls `STAT_SKILL_PIERCE` on missile impact when `Missiles.txt` `Pierce = 1` (up to 4 pierces).
  - `D2GAME_SummonPet_6FD0CB10` (`0x6FD0CB10`) & `D2GAME_SetSummonPassiveStats_6FD0C530` (`0x6FD0C530`): Spawns pet unit, enforces `petmax=1`, applies `calc1`% Max HP bonus, `passivestat`s, `aurastat`s, and `sumskill`s.
  - `D2GAME_CreateMonsterEquipment_6FCF9580` (`0x6FCF9580`): Equips summoned `dopplezon` (cloned base gear) and `valkyrie` (rolled magic/rare items from `MonEquip.txt`).

---

## 2. `Skills.txt`, `States.txt`, `Overlay.txt`, `PetType.txt`, & `MonStats.txt` Tables

### 2.1 `Skills.txt` Configuration (Skills #8, #9, #13, #17, #18, #23, #28, #29, #32, #33)

| ID | Skill | ReqLvl | `Passive` | `SrvDo` | `Anim` | `Mana` (`Shift`, `+lvl`) | `Delay` | `PassiveState` / `TargetState` | Primary Stat(s) | Formula & Parameters |
|---:|---|---:|---:|---:|---|---|---:|---|---|---|
| 8 | **Inner Sight** | 1 | 0 | 6 | `SC` | `10<<7>>8` = 5 (`+0`/lvl) | 0 | `innersight` (`#17`) | `armorclass`, `item_light=3` | Radius `20` sub-tiles (`13.3` yds); Duration `200 + 100*(slvl-1)` frames; `-edmn` Defense (`-40`, `-25/-45/-60/-80/-100` per tier) |
| 9 | **Critical Strike** | 1 | 1 | 0 | — | 0 | 0 | `criticalstrike` (`#64`) | `passive_critical_strike` | `dm12` (`Param1=5, Param2=80`): `5%..80%` chance for 2x physical damage |
| 13 | **Dodge** | 6 | 1 | 0 | `S1` | 0 | 0 | `dodge` (`#65`) | `passive_dodge` | `dm12` (`Param1=10, Param2=65`): `10%..65%` chance to dodge melee while stationary |
| 17 | **Slow Missiles** | 12 | 0 | 6 | `SC` | `10<<7>>8` = 5 (`+0`/lvl) | 0 | `slowmissiles` (`#87`) | `skill_handofathena`, `item_light=3` | Radius `20` sub-tiles (`13.3` yds); Duration `300 + 150*(slvl-1)` frames; enemy missile speed set to `33%` (`Param1=33`) |
| 18 | **Avoid** | 12 | 1 | 0 | `S1` | 0 | 0 | `avoid` (`#66`) | `passive_avoid` | `dm12` (`Param1=15, Param2=75`): `15%..75%` chance to avoid missiles while stationary |
| 23 | **Penetrate** | 18 | 1 | 0 | — | 0 | 0 | `penetrate` (`#67`) | `item_tohit_percent` | `ln12` (`Param1=35, Param2=10`): `+35 + 10*(slvl-1)`% Attack Rating |
| 28 | **Dopplezon (Decoy)** | 24 | 0 | 15 | `SC` | `76<<6>>8` = 19 (`-0.75`/lvl, min 1) | 0 | `dopplezon` (`#63`) | `maxhp`, `allres` | `petmax=1`; Base HP = `50%` of caster MaxHP $\times (1 + 0.10 \cdot \text{slvl})$; Duration `250 + 125*(slvl-1)` frames; Resists `min(4*slvl, 85)` |
| 29 | **Evade** | 24 | 1 | 0 | `S1` | 0 | 0 | `evade` (`#68`) | `passive_evade` | `dm12` (`Param1=10, Param2=65`): `10%..65%` chance to evade melee or missiles while walking/running |
| 32 | **Valkyrie** | 30 | 0 | 16 | `SC` | `25<<8>>8` = 25 (`+1`/lvl) | 150 (6.0s) | — | `maxhp`, `str`, `dex`, `ac%`, `tohit`, `allres` | `petmax=1`, `InTown=1`; HP `+20%*(slvl-1) + 20%*Decoy.blvl`; Gear `ilvl = 25 + 3*(slvl-1)`; inherits Dodge/Avoid/Evade/CS |
| 33 | **Pierce** | 30 | 1 | 0 | — | 0 | 0 | `pierce` (`#69`) | `skill_pierce` | `dm12` (`Param1=10, Param2=100`): `10%..100%` chance for missiles with `Pierce=1` to pass through targets |

### 2.2 `States.txt` & `Overlay.txt` Suite

| State ID | State Name | `nosend` | `overlay1` (ID, `Filename`, `Frames`) | Special Flags & Properties |
|---:|---|---:|---|---|
| 17 | `innersight` | 0 | `innersight` (`#48`, `HardenArmor`, 24f) | `armred=1` (marks monster defense bar red), `stat=armorclass` |
| 63 | `dopplezon` | 0 | — (`sumoverlay`: `dopllezon_appear` `#171`, `DopplezonAppear`, 19f) | `transform=1, disguise=1, gfxtype=2, gfxclass=0` (disguises monster unit as Amazon class `0`) |
| 64 | `criticalstrike` | 1 | — | Passive stat carrier |
| 65 | `dodge` | 1 | — | Passive stat carrier |
| 66 | `avoid` | 1 | — | Passive stat carrier |
| 67 | `penetrate` | 0 | — | Passive stat carrier (`stat=item_tohit_percent`) |
| 68 | `evade` | 1 | — | Passive stat carrier |
| 69 | `pierce` | 0 | — | Passive stat carrier (`stat=skill_pierce`) |
| 87 | `slowmissiles` | 0 | `innersight` (`#48`, `HardenArmor`, 24f) | `stat=skill_handofathena`; reuses `innersight` target overlay (`#48`) |

*(Cast Overlays: `cast_innersight` = `#47` (`EOZCast`, 29 frames, `Trans=3`); `cast_slowmissiles` = `#49` (`HOAcast`, 21 frames, `Trans=3`).)*

### 2.3 `PetType.txt` & `MonStats.txt` Summon Definitions

| Monster ID (`hcIdx`) | `PetType` (`idx`) | `AI` (`aidel`) | `Code` | `Velocity` / `Run` | Base `minHP..maxHP` (N/NM/H) | Base `AC` (N/NM/H) | `ToBlock` | `Crit` | `DamageRegen` | Base Attacks (N / NM / H) |
|---|---|---|---:|---|---:|---|---:|---:|---:|---|
| `dopplezon` (`#356`) | `dopplezon` (`8`) | `Idle` (`15`) | `VK` | `9` / `9` | `10..10` (overridden by caster MaxHP) | `141 / 152 / 164` | `28%` | `5%` | `15` | None (`AI=Idle`, `threat=14` high aggro magnet) |
| `valkyrie` (`#357`) | `valkyrie` (`2`) | `NecroPet` (`6`) | `VK` | `11` / `11` | `400..480` (`noRatio=1`, all diffs) | `141 / 152 / 164` | `28%` | `5%` | `12` | `A1`: `9-24` (`250` AR) / `13-35` (`300`) / `16-41` (`350`); `A2`: `18-37` / `26-53` / `31-62` |

---

## 3. Diminishing Returns (`dm` Formula, `D2Common_11033` @ `0x6FDB3AB0`)

All five percentage-chance Amazon passives (**Critical Strike**, **Dodge**, **Avoid**, **Evade**, **Pierce**) evaluate `passivecalc1 = dm12`, which invokes `D2Common_11033(slvl, Param1, Param2)` (`0x6FDB3AB0`):

$$\text{dm}(a, b, \text{slvl}) = \min\!\left(b,\; a + \left\lfloor \frac{(b - a) \cdot \left\lfloor \frac{110 \cdot \text{slvl}}{\text{slvl} + 6} \right\rfloor}{100} \right\rfloor\right)$$

| Skill | `Param1` ($a$) | `Param2` ($b$) | slvl 1 | slvl 5 | slvl 10 | slvl 15 | slvl 20 | Asymptote ($\text{slvl} \to \infty$) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Critical Strike (#9)** | 5 | 80 | 16% | 42% | 56% | 63% | 68% | 80% |
| **Dodge (#13)** | 10 | 65 | 18% | 37% | 47% | 52% | 56% | 65% |
| **Avoid (#18)** | 15 | 75 | 24% | 45% | 55% | 61% | 65% | 75% |
| **Evade (#29)** | 10 | 65 | 18% | 37% | 47% | 52% | 56% | 65% |
| **Pierce (#33)** | 10 | 100 | 23% | 55% | 71% | 79% | 85% | 100% (hits 100% at slvl 60; 69% at slvl 9 + Razortail 33% = 102%) |

---

## 4. Radial Debuff Curses: Inner Sight (#8) & Slow Missiles (#17) (`SKILLS_SrvDo006` @ `0x6FC6C2A0`)

Both **Inner Sight (#8)** and **Slow Missiles (#17)** share `SKILLS_SrvDo006_InnerSight_SlowMissiles` (`0x6FC6C2A0`):
1. **Radial Enemy Search**:
   - Evaluates `aurarangecalc = ln56` (`Param5 = 20, Param6 = 0` $\implies$ `20` sub-tiles = `13.33` yards) around the Amazon's position.
   - Iterates over all valid monsters in range matching `aurafilter` (`0x8583` for Inner Sight; `0xC583` for Slow Missiles, which additionally requires `LineOfSight` / missile-capable targets) via `sub_6FD0FE80` and invokes `SKILLS_SrvDo006_Callback` (`0x6FC6C0E0`).
2. **Curse Stat List Application (`SKILLS_SrvDo006_Callback` @ `0x6FC6C0E0`)**:
   - Evaluates duration `auralencalc = ln34`:
     - **Inner Sight (#8)**: `200 + 100 * (slvl - 1)` frames (`8.0s` at slvl 1, `+4.0s` per slvl).
     - **Slow Missiles (#17)**: `300 + 150 * (slvl - 1)` frames (`12.0s` at slvl 1, `+6.0s` per slvl).
   - Allocates or updates a timed stat list (`STATLIST_AllocStatList` with flags `0xA0` = curse/debuff) bound to `auratargetstate` (`innersight` `#17` or `slowmissiles` `#87`), calls `STATES_ToggleState(pTarget, nState, 1)` and `D2GAME_SetStatOrResetState_6FC6C080`:
     - **Unconditional Illumination (`0x6FC6C18F`)**: Sets `STAT_ITEM_LIGHTRADIUS = 3` on every affected monster, causing them to emit light in dark areas!
     - **Inner Sight (#8) Defense Reduction**: Evaluates `aurastatcalc1 = -edmn` (`-SKILLS_GetElementalMinDamage`), subtracting a flat amount from monster `STAT_ARMORCLASS`:
       - slvl 1: `-40` Defense (`EMin = 40`, `HitShift = 8`).
       - slvl 2–8: `-25`/lvl; slvl 9–16: `-45`/lvl; slvl 17–22: `-60`/lvl; slvl 23–28: `-80`/lvl; slvl 29+: `-100`/lvl (e.g., `-815` flat Defense at slvl 20!). Because this applies directly to base `armorclass` (`states.txt` `armred=1`), it reduces monster defense *before* monster `% Enhanced Defense` auras or modifiers, drastically boosting party hit chance.
     - **Slow Missiles (#17) Velocity Scaling**: Evaluates `aurastatcalc1 = ln12` (`Param1 = 33, Param2 = 0`), setting `STAT_SKILL_HANDOFATHENA = 33` on the monster. When a monster with `STAT_SKILL_HANDOFATHENA` spawns any missile with `CanSlow = 1` in `Missiles.txt`, the missile initialization scales its velocity (`Vel` and `MaxVel`) to `33%` of normal (`-67%` missile speed).

---

## 5. Combat Passive Mechanics: Critical Strike (#9), Penetrate (#23), Dodge (#13), Avoid (#18), Evade (#29), & Pierce (#33)

### 5.1 Critical Strike (#9) (`SUNITDMG_FillDamageValues` @ `0x6FCBE7E0`)
In `SUNITDMG_FillDamageValues` (`0x6FCBE7E0`), physical critical hits are rolled in strict sequential order, where a success skips the remaining checks (`wResultFlags |= DAMAGERESULTFLAG_CRITICALSTRIKE = 0x20`):
1. **Weapon Mastery Crit** (`STAT_PASSIVE_MASTERIES_CRIT`—Barbarian/Assassin masteries).
2. **Amazon Critical Strike (`STAT_PASSIVE_CRITICAL_STRIKE`)**: Rolled if Mastery Crit did not trigger (`rand(0..99) < dm(5, 80, slvl)`).
3. **Item Deadly Strike (`STAT_ITEM_DEADLYSTRIKE`)**: Rolled only if neither Mastery Crit nor Critical Strike triggered:
   $$P(\text{2x Phys Damage}) = 1 - \left(1 - \frac{\text{CS}\%}{100}\right)\left(1 - \frac{\text{DS}\%}{100}\right)$$
- When triggered, doubles `pDamage->dwPhysDamage` (`dwPhysDamage <<= 1`). It applies to **both melee and ranged physical attacks** (and doubles physical damage *prior* to Magic/Fire/Cold Arrow conversion, Lightning Bolt conversion, or Berserk/Vengeance conversion).

### 5.2 Penetrate (#23) (`SKILLS_RefreshSkill` @ `0x6FDAF8C0`)
- Passively grants `STAT_ITEM_TOHIT_PERCENT = 35 + 10 * (slvl - 1)`% (`+35%` AR at slvl 1, `+225%` AR at slvl 20).
- *(1.13c Bug Note)*: If an Amazon receives **Blessed Aim** (`States.txt` state `#9`), Blessed Aim overwrites `STAT_ITEM_TOHIT_PERCENT` on the active state layer without summing with Penetrate's passive state (`#67`), causing Blessed Aim to temporarily mask Penetrate.

### 5.3 Dodge (#13), Avoid (#18), & Evade (#29) (`SUNITDMG_ApplyBlockOrDodge` @ `0x6FCC2530`, `SUNITDMG_ApplyDodge` @ `0x6FCC2610`)
When an attack passes its Attack Rating check (or is an auto-hit physical/elemental missile with `CollideType=3`), `SUNITDMG_ApplyBlockOrDodge` (`0x6FCC2530`) executes **after** Shield Block (`SUNITDMG_ApplyBlock`):
1. **Movement State Check (`SUNITDMG_ApplyDodge` @ `0x6FCC2610`)**:
   - Inspects the defender's `dwAnimMode`:
     - For Players: `PLRMODE_WALK` (`2`) or `PLRMODE_RUN` (`3`).
     - For Monsters (e.g. Valkyrie): `MONMODE_WALK` (`2`) or `MONMODE_RUN` (`14`).
2. **Mutually Exclusive Branching (`bMoving` vs `bAvoid`)**:
   - **If Moving (`bMoving == 1`)**: Rolls **ONLY `STAT_PASSIVE_EVADE`** (`dm(10, 65, slvl)`), regardless of whether the incoming hit is melee (`bAvoid == 0`) or missile (`bAvoid == 1`). If successful, sets `BLOCKFLAG_EVADE` (`0x8`).
   - **If Stationary (`bMoving == 0`) and Melee (`bAvoid == 0`)**: Rolls **ONLY `STAT_PASSIVE_DODGE`** (`dm(10, 65, slvl)`). If successful, sets `BLOCKFLAG_DODGE` (`0x2`).
   - **If Stationary (`bMoving == 0`) and Ranged/Missile (`bAvoid == 1`)**: Rolls **ONLY `STAT_PASSIVE_AVOID`** (`dm(15, 75, slvl)`). If successful, sets `BLOCKFLAG_AVOID` (`0x1`).
3. **Animation Lock (`S1` Mode) & Fend/Strafe Interruption ("D/A/E Bug")**:
   - On a successful Dodge or Avoid (and melee Evade), if `bAllowModeChange` is true, the Amazon is forced into animation mode `PLRMODE_SPECIAL1` (`13`, `S1` sequence, playing `amazon_dodge_1` sound) (`SUnitDmg.cpp` `0x6FCBFD20`).
   - *(Note on Missile Evade in `SUNITDMG_ExecuteMissileDamage`)*: When `DAMAGERESULTFLAG_EVADE` (`0x100`) triggers against a missile while moving, `SUNITDMG_ExecuteMissileDamage` attaches sound `12` (`amazon_dodge_1`) and returns early without forcing `PLRMODE_SPECIAL1` (`13`), allowing the Amazon to keep running seamlessly; whereas `DAMAGERESULTFLAG_DODGE` and `DAMAGERESULTFLAG_AVOID` transition into `PLRMODE_SPECIAL1` (`13`).
   - Because `PLRMODE_SPECIAL1` interrupts any active multi-strike sequence (`Fend`, `Jab`, `Impale`, `Strafe`) on the server while the client or remaining server hits continue swinging without a valid attack frame, triggering Dodge/Avoid during a multi-hit sequence causes remaining attacks in that volley to miss ("Fend/Dodge bug").

### 5.4 Pierce (#33) (`MISSMODE_PierceHandler` @ `0x6FC58E00`)
When a missile with `Pierce = 1` in `Missiles.txt` successfully hits a unit (`DAMAGERESULTFLAG_SUCCESSFULHIT`):
1. `MISSMODE_PierceHandler` (`0x6FC58E00`) checks `STAT_SKILL_PIERCE` (sum of Amazon's passive `Pierce` `dm(10, 100, slvl)` + item `item_pierce` such as Razortail's `+33%`).
2. Checks the missile's pierce counter (stored in `pMissile`'s frame/pierce counter): a missile can pierce **at most 4 times** (hitting up to **5 targets** total along its trajectory).
3. If `rand(0..99) < PiercePct` and pierce count `< 4`, clears the missile's `CollideKill` termination for this hit, records `LastCollide` so the missile cannot immediately re-collide with the same monster, and allows the missile (and any `AlwaysExplode = 1` hit function such as Exploding Arrow, Freezing Arrow, Plague Javelin, or Lightning Fury!) to continue flying and trigger full AoE explosions on every pierced target.

---

## 6. Summon Skills: Decoy / Dopplezon (#28) & Valkyrie (#32)

### 6.1 Decoy / Dopplezon (#28) (`SKILLS_SrvDo015_Dopplezon` @ `0x6FC6D8C0`)
1. **Pet Spawning & Disguise State**:
   - Calls `D2GAME_SummonPet_6FD0CB10` to spawn `dopplezon` (`hcIdx = 356`, `PetType = 8`, `petmax = 1`, `AI = Idle`, `threat = 14`). Because `threat = 14` (higher than player `threat` and Valkyrie `threat = 11`), nearby monsters strongly prioritize attacking the Decoy.
   - Applies `aurastate = dopplezon` (State `#63`, `transform=1, disguise=1, gfxtype=2, gfxclass=0`) and `sumoverlay = dopllezon_appear` (`Overlay #171`), causing the client to render the monster unit using the Amazon's DCC composite appearance.
2. **Cloned Equipment (`sub_6FCF9580` @ `0x6FCF9580`)**:
   - Calls `D2GAME_CreateMonsterEquipment_6FCF9580` with `MonEquip.txt` entries for `dopplezon` (where item codes are blank `'    '`), which reads the caster Amazon's currently equipped base item codes (`D2Common_10443`) for each body location and equips matching non-magical visual dummy items onto the Decoy so she mirrors the caster's gear!
3. **Two-Stage HP Formula (`0x6FC6D8C0` + `0x6FD0C530`)**:
   - First (`0x6FC6D95A`), `SKILLS_SrvDo015_Dopplezon` overrides the Decoy's base HP (`10` in `MonStats.txt`) with `calc3 = par3 = 50`% of the caster's current Maximum Life:
     $$\text{HP}_{\text{base}} = \left\lfloor \frac{\text{CasterMaxHP} \times 50}{100} \right\rfloor$$
   - Second (`0x6FC6D9B2`), `D2GAME_SetSummonPassiveStats_6FD0C530` applies `calc1 = slvl * par4 = 10 * slvl`% bonus HP on top of $\text{HP}_{\text{base}}$, sets `STAT_LEVEL = CasterLevel`, and applies `aurastat1..4` (`fireresist`, `lightresist`, `coldresist`, `poisonresist` = $\min(4 \cdot \text{slvl}, 85)$):
     $$\text{HP}_{\text{final}} = \left\lfloor \text{HP}_{\text{base}} \times \left(1 + \frac{10 \cdot \text{slvl}}{100}\right) \right\rfloor = \text{CasterMaxHP} \times 0.50 \times (1 + 0.10 \cdot \text{slvl})$$
4. **Timed Expiration (`MONUMOD_TEMPSUMMON = 21`)**:
   - Assigns Monster UMod `21` (`TEMPSUMMON`) and schedules timer event `MONSTERAI_EventFunc06` for `calc2 = ln12 = 250 + 125 * (slvl - 1)` frames ($10 + 5(\text{slvl}-1)$ seconds).

### 6.2 Valkyrie (#32) (`SKILLS_SrvDo016_Valkyrie` @ `0x6FC6D710`)
1. **Pet Spawning & Base Stats**:
   - Castable in town (`InTown = 1`), with a `150`-frame (`6.0` second) casting delay (`delay = 150`).
   - Spawns `valkyrie` (`hcIdx = 357`, `PetType = 2`, `petmax = 1`, `AI = NecroPet`, `aidel = 6` across all difficulties, `DamageRegen = 12`).
   - Base HP in `MonStats.txt` (`noRatio = 1`) is randomly rolled in `[400, 480]` (average `440`) in Normal, Nightmare, and Hell.
2. **Synergized HP, Defense, Stats, Resists & Passives (`D2GAME_SetSummonPassiveStats_6FD0C530` @ `0x6FD0C530`)**:
   - **Life (`calc1`)**: `+20 * (slvl - 1) + 20 * Dopplezon.blvl`% Max HP:
     $$\text{ValkyrieHP} = \text{BaseHP}_{[400..480]} \times \left(1 + 0.20 \cdot (\text{slvl} - 1) + 0.20 \cdot \text{blvl}_{\text{Decoy}}\right)$$
   - **Strength & Dexterity (`aurastat1..2`)**:
     $$\text{Strength} = 25 \cdot \text{slvl}, \qquad \text{Dexterity} = 12 \cdot \text{slvl}$$
     *(Strength grants `+1%` physical damage per point to her spear attacks; Dexterity adds `+Dex/4` base Defense and `+5*Dex` Attack Rating.)*
   - **Defense (`passivestat1 = item_armor_percent`)**: `+10 * (slvl - 1)`% Enhanced Defense (applied on top of her `MonStats.txt` base AC `141/152/164` + equipped armor AC + `Dexterity/4`).
   - **Attack Rating (`passivestat2 = tohit`)**: `+40 * slvl + 40 * Penetrate.blvl` flat Attack Rating (added to base `250/300/350` AR).
   - **All Resistances (`aurastat3..6`)**:
     $$\text{AllRes} = \min\!\left(85,\; 2 \cdot (\text{slvl} + \text{blvl}_{\text{Decoy}})\right)$$
     *(Plus any resistances rolled on her generated magic/rare equipment, easily exceeding 85% effective immunity to elemental damage at high levels.)*
   - **Inherited Amazon Passives (`sumskill1..4`)**: Grants the Valkyrie her own skill levels in **Dodge**, **Avoid**, **Evade**, and **Critical Strike** equal to the Amazon's **base levels (`blvl`)** in those 4 skills!
3. **Procedural Equipment Generation (`sub_6FCF9580` @ `0x6FCF9580` via `MonEquip.txt`)**:
   - Evaluates `ilvl = calc2 = ln56 = 25 + 3 * (slvl - 1)` (`Param5 = 25, Param6 = 3`).
   - `sub_6FCF9580` scans `MonEquip.txt` rows for `valkyrie` where `row.level <= ilvl` and generates real Magic (`mod=4`, blue) and Rare (`mod=6`, yellow) items equipped into her `pInventory`:

| Min `slvl` | `ilvl` (`25 + 3*(slvl-1)`) | Body Slot (`loc`) | Generated Item (`item` + Quality `mod`) |
|---:|---:|---|---|
| **1** | 25 | `tors` (Torso) / `rarm` (Weapon) | Rare Full Plate Mail (`ful`, Rare) + Magic Spear (`spr`, Magic) |
| **2** | 28 | `glov` (Gloves) | Magic Heavy Gloves (`vgl`, Magic) |
| **4** | 34 | `feet` (Boots) | Magic Heavy Boots (`vbt`, Magic) |
| **5** | 37 | `belt` (Belt) | Magic Heavy Belt (`vbl`, Magic) |
| **7** | 43 | `tors` (Torso) / `rarm` (Weapon) | Upgrades to Rare Chaos Armor (`xul`, Rare) + Magic Lance (`9p9`, Magic) |
| **8** | 46 | `glov` (Gloves) | Upgrades to Magic War Gauntlets (`xhg`, Magic) |
| **10** | 52 | `feet` (Boots) | Upgrades to Magic War Boots (`xhb`, Magic) |
| **11** | 55 | `belt` (Belt) | Upgrades to Magic War Belt (`zhb`, Magic) |
| **12** | 58 | `neck` (Amulet) | Magic Amulet (`amu`, Magic) |
| **13** | 61 | `tors` (Torso) | Upgrades to Rare Sacred Armor (`uar`, Rare) |
| **14** | 64 | `glov` (Gloves) | Upgrades to Rare Crusader Gauntlets (`utg`, Rare) |
| **16** | 70 | `feet` (Boots) / `head` (Helm) | Rare Mirrored Boots (`utb`, Rare) + Magic Circlet (`ci0`, Magic) |
| **17** | 73 | `rarm` (Weapon) / `belt` (Belt) | **Rare War Pike (`7p7`, Rare)** + Rare Colossus Girdle (`uhc`, Rare) |
| **21** | 85 | `neck` (Amulet) | Upgrades to Rare Amulet (`amu`, Rare) |
| **27** | 103 (capped at 99) | `head` (Helm) | Upgrades to Rare Tiara (`ci2`, Rare) |
