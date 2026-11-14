# Diablo II v1.13c Necromancer Summoning Spells Mechanics (`Skills #69, #70, #75, #79, #80, #85, #89, #90, #94, #95`)

## 1. Dispatch Tables (`D2Client.dll` `0x6FAB0000` & `D2Game.dll` `0x6FC20000`)

### Client Dispatch Tables (`D2Client.dll`, ImageBase `0x6FAB0000`)
- **`SkillCltStFunc`**: VA `0x6FB8E928`
  - `SkillCltStFunc[20]` = `0x6FB78410` (`SKILLS_CltSt20_RaiseSkeleton_Mage` — validates hovered selectable corpse on cast start)
  - `SkillCltStFunc[23]` = `0x6FB782A0` (`SKILLS_CltSt23_IronGolem` — validates hovered ground metal item on cast start)
  - `SkillCltStFunc[24]` = `0x6FB78620` (`SKILLS_CltSt24_Revive` — validates revivable corpse and spawns `revivesmall` #268, `revivemedium` #269, or `revivelarge` #270 by target monster size!)
- **`SkillCltDoFunc`**: VA `0x6FB8EA48`
  - `SkillCltDoFunc[31]` = `0x6FB788A0` (`SKILLS_CltDo31_RaiseSkeleton_Mage` — hides corpse and spawns `cltmissilea = corpseexplosion` #115 at corpse)
  - `SkillCltDoFunc[95]` = `0x6FB088B0` (`SKILLS_CltDo95_NecromageMissile` — fires `necromage1..4` #208..211 based on `necromage` right-hand component `0..3`)
- **`MissileCltDoFunc` (`g_apfnCltDoFunc`)**: VA `0x6FB8D8A0`
  - `MissileCltDoFunc[1]` = `0x6FB617C0` (`MISSMODE_CltDo01_Standard` — `necromage1..4` #208..211 and `revivesmall/medium/large` #268..270)
  - `MissileCltDoFunc[2]` = `0x6FB63060` (`MISSMODE_CltDo02_Blood` — `bigblood1` #20, `bigblood2` #21)
  - `MissileCltDoFunc[11]` = `0x6FB62DC0` (`MISSMODE_CltDo11_CorpseExplosion` — spawns gore chunks when raising a skeleton/mage)

### Server Dispatch Tables (`D2Game.dll`, ImageBase `0x6FC20000`)
- **`SkillSrvStFunc`**: VA `0x6FD27338`
  - `SkillSrvStFunc[15]` = `0x6FC6EF20` (`SKILLS_SrvSt15_RaiseSkeleton_Mage` — checks `D2GAME_CanSummonFromCorpse_6FD0C9E0`)
  - `SkillSrvStFunc[20]` = `0x6FC6EDD0` (`SKILLS_SrvSt20_IronGolem` — checks `IMODE_ONGROUND`, `ITEMS_IsMetalItem`, `IFLAG_IDENTIFIED`, unowned)
  - `SkillSrvStFunc[21]` = `0x6FC6ED60` (`SKILLS_SrvSt21_Revive` — checks `D2GAME_CanSummonFromCorpse`, `MonStats2.txt -> revive`, and `sub_6FD15190`)
- **`SkillSrvDoFunc`**: VA `0x6FD274A8`
  - `SkillSrvDoFunc[31]` = `0x6FC718B0` (`SKILLS_SrvDo031_RaiseSkeleton_Mage` — Raise Skeleton #70 & Raise Skeletal Mage #80)
  - `SkillSrvDoFunc[56]` = `0x6FC71750` (`SKILLS_SrvDo056_Golem` — Clay Golem #75, Blood Golem #85, Fire Golem #94)
  - `SkillSrvDoFunc[57]` = `0x6FC71540` (`SKILLS_SrvDo057_IronGolem` — Iron Golem #90)
  - `SkillSrvDoFunc[58]` = `0x6FC71340` (`SKILLS_SrvDo058_Revive` — Revive #95)
  - `SkillSrvDoFunc[66]` = `0x6FCBAF50` (`SKILLS_SrvDo066_HolyFire_HolyShock_Sanctuary_Conviction` — Fire Golem's `Holy Fire` #102 aura)
  - `SkillSrvDoFunc[149]` = `0x6FCD4B10` (`SKILLS_SrvDo149_NecromageMissile` — Skeletal Mage's `NecromageMissile` #338)
- **`MissileSrvDoFunc`**: VA `0x6FD2D970`
  - `MissileSrvDoFunc[1]` = `0x6FC5F540` (`MISSMODE_SrvDo01_BasicMissile` — `necromage1..4` #208..211)

---

## 2. `Skills.txt`, `PetType.txt` & `MonStats.txt` Data for Necromancer Summoning

### `Skills.txt` Data
| ID | Skill | ReqLvl | Prereq(s) | `srvst`/`do` | `cltst`/`do` | Mana (`mana`, `+lvl`) | `pettype` (`idx`) | `petmax` | `summon` (`MonStats` ID) | Key `calc1` (Bonus HP%) & `passivestat` / `aurastat` |
|---:|---|---:|---|---|---|---|---|---|---|---|
| 69 | **Skeleton Mastery** | 1 | Raise Skeleton | Passive | Passive | `0` | — | — | — | `passivestate=skel_mastery` (#97); `Param1=+8` HP/lvl (`necroskeleton`/`necromage`), `Param2=+2` flat dmg/lvl (`necroskeleton`), `Param3=+5%` HP/lvl & `Param4=+10%` ED/lvl (`Revive`) |
| 70 | **Raise Skeleton** | 1 | — | `15` / `31` | `20` / `31` | `6, +1` | `skeleton` (`4`) | `(lvl<4) ? lvl : (2+lvl/3)` | `necroskeleton` (#363) | `calc1 = (lvl<4)?0:50*(lvl-3)`% HP; `passivestat1=maxhp` ($+8\cdot\text{SM.lvl}$), `passivestat2=item_normaldamage` ($+2\cdot\text{SM.lvl} + \text{edmn}$); `aurastat1=damagepercent` ($7(\text{lvl}-3)$% if $\text{lvl}\ge 4$), `tohit`/`armorclass` $= +15(\text{lvl}+\text{SM.lvl})$ |
| 75 | **Clay Golem** | 6 | — | `0` / `56` | `0` / `0` | `15, +3` | `golem` (`3`) | `1` | `ClayGolem` (#289) | `calc1 = (100+35(lvl-1))*(100+GM.ln12+5*BG.blvl)/100 - 100`% HP; `aurastat1=item_slow` (`dm34`: `0..75%`); `auraevent1=damagedinmelee` $\to$ `EventFunc=27` |
| 79 | **Golem Mastery** | 12 | Clay Golem | Passive | Passive | `0` | — | — | — | `passivestate=golem_mastery` (#111); `ln12 = 20 + 20(slvl-1)`% HP, `dm34` (`0..40%`) velocity, `ln56 = 25 + 25(slvl-1)` AR |
| 80 | **Raise Skeletal Mage** | 12 | Raise Skeleton | `15` / `31` | `20` / `31` | `8, +1` | `skeletonmage` (`5`) | `(lvl<4) ? lvl : (2+lvl/3)` | `necromage` (#364) | `calc1 = (lvl<4)?0:7*(lvl-3)`% HP; `passivestat1=maxhp` ($+8\cdot\text{SM.lvl}$); `aurastat1=armorclass` ($+10(\text{lvl}+\text{SM.lvl})$); `sumskill1=NecromageMissile` (#338) at lvl $\text{SM.lvl} + ((lvl<4)?0:(lvl-2)/2)$ |
| 85 | **Blood Golem** | 18 | Clay Golem | `0` / `56` | `0` / `0` | `25, +4` | `golem` (`3`) | `1` | `BloodGolem` (#290) | `calc1 = GM.ln12`% HP; `domeleedamage` $\to$ `EventFunc=23` (Life Steal `ln12 = 75..150%`, `30%` to Necro); `damagedinmelee`/`missile` $\to$ `EventFunc=26` (`25%` damage diverted to Necro) |
| 89 | **Summon Resist** | 24 | Golem Mastery | Passive | Passive | `0` | — | — | — | `passivestate=summonresist` (#160); `passivestat1=passive_summon_resist` $= \text{dm12}$ (`Param1=20, Param2=75`: $28\%$ at slvl 1, $66\%$ at slvl 20) |
| 90 | **Iron Golem** | 24 | Blood Golem | `20` / `57` | `23` / `0` | `35, +0` | `golem` (`3`) | `1` | `IronGolem` (#291) | `calc1 = GM.ln12 + 5*BG.blvl`% HP; `aurastate=thorns` (#36), `thorns_percent = 150 + 15(slvl-1)`%, `fade = 16` (if ethereal item); `AC = +35*slvl` |
| 94 | **Fire Golem** | 30 | Iron Golem | `0` / `56` | `0` / `0` | `50, +10` | `golem` (`3`) | `1` | `FireGolem` (#292) | `calc1 = GM.ln12 + 5*BG.blvl`% HP; `fireresist = 100 - dm12`, `item_absorbfire_percent = dm12` (`25..100%`), flat `firemindam`/`firemaxdam`; `sumskill1=Holy Fire` (#102) at $\min(8+\text{slvl}-1, 30)$ |
| 95 | **Revive** | 30 | Raise Skeletal Mage, Iron Golem | `21` / `58` | `24` / `0` | `45, +0` | `revive` (`6`) | `lvl` | *(Target Corpse)* | `calc1 = 200 + 5*SM.lvl`% HP; `calc2 = ln34 = 4500` frames ($180\text{s}$); `aurastat1=damagepercent` ($+10\cdot\text{SM.lvl}$%); `passivestat1=velocitypercent = +50`% |

### `PetType.txt` & `MonStats.txt` Base Summon Profiles
All Necromancer summons have `warp = 1` (teleport with caster), `partysend = 1`, `unsummon = 1`, `automap = 1`, `drawhp = 1`, `AI = NecroPet`, `Align = 1`, `inTown = 1`, `noRatio = 1` (base HP is fixed in `MonStats.txt` per difficulty rather than scaled by `MonLvl.txt` HP ratios, except Revive!).

| Monster ID | Name (`Code`) | `pettype` (`idx`) | Base HP (N / NM / H) | Base AC (N / NM / H) | Base A1 Dmg (N / NM / H) | Base A2 Dmg (N / NM / H) | Base Resists (`Dm / Ma / Fi / Li / Co / Po`) | Block% | Vel / Run |
|---:|---|---|---|---|---|---|---|---:|---|
| 363 | `necroskeleton` (`SK`) | `skeleton` (`4`) | `21 / 30 / 42` | `5 / 5 / 6` | `1–2 / 1–2 / 1–2` | `1–2 / 1–2 / 1–2` | `0 / 0 / 0 / 0 / 0 / 0` (`lUndead=1`) | `3%` | `13 / 15` |
| 364 | `necromage` (`SK`) | `skeletonmage` (`5`) | `61 / 88 / 123` | `24 / 26 / 28` | `1–2` (uses `Skill1=NecromageMissile`) | — | `0 / 0 / 0 / 0 / 0 / 0` (`lUndead=1`) | `3%` | `12 / 14` |
| 289 | `claygolem` (`G1`) | `golem` (`3`) | `100 / 175 / 275` | `100 / 100 / 100` | `2–5 / 2–6 / 3–7` | `4–7 / 5–10 / 6–11` | `25 / 0 / 0 / 20 / 50 / 0` | `21%` | `8 / 8` |
| 290 | `bloodgolem` (`G2`) | `golem` (`3`) | `201 / 388 / 637` | `120 / 120 / 120` | `6–16 / 9–23 / 10–27` | `12–24 / 17–35 / 20–41` | `0 / 20 / 0 / 0 / 0 / 20` (`Drain=100`) | `31%` | `9 / 9` |
| 291 | `irongolem` (`G4`) | `golem` (`3`) | `306 / 595 / 980` | `140 / 140 / 140` | `7–19 / 11–30 / 12–33` | `15–29 / 23–45 / 25–49` | `0 / 0 / 0 / 50 / 0 / 100` (`inventory=1`) | `41%` | `9 / 9` |
| 292 | `firegolem` (`G3`) | `golem` (`3`) | `313 / 613 / 1013` | `200 / 200 / 200` | `10–27 / 15–39 / 18–47` (`+5–10` fire) | `21–41 / 30–60 / 35–71` | `0 / 0 / 100 / 0 / 0 / 0` | `50%` | `10 / 10` |

### `Missiles.txt` Suite for Summoning (`necromage1..4` & `revive*`)
| ID | Missile | `SrvDo` / `CltDo` | `EType` | `Vel` | `Range` | `CelFile` | `AnimLen` | `EMin`–`EMax` (Lev1 / 2 / 3 / 4 / 5) | `ELen` (Lev1..3) | Notes |
|---:|---|---|---|---:|---:|---|---:|---|---|---|
| 208 | `necromage1` | `1` / `1` | `pois` (`sh=8`) | `14` | `30` | `poisonNova` | 30 | `6–6` (`1 / 2 / 4 / 6 / 8`) | `500` (`+250 / +250 / +250` frames!) | Poison Mage bolt (`MaxDamage=1280`) |
| 209 | `necromage2` | `1` / `1` | `cold` (`sh=8`) | `14` | `30` | `Icebolt` | 6 | `1–4` (`1 / 2 / 3 / 4 / 5`) | `25` (`+25 / +25 / +25` frames) | Cold Mage bolt (`LoopAnim=1`) |
| 210 | `necromage3` | `1` / `1` | `fire` (`sh=8`) | `14` | `30` | `Firebolt` | 5 | `2–6` (`2 / 3 / 5 / 7 / 9`) | — | Fire Mage bolt (`Exp=shamanexp`) |
| 211 | `necromage4` | `1` / `1` | `ltng` (`sh=8`) | `14` | `30` | `ChargedBolt` | 10 | `1–7` (`Min: +1`, `Max: 3 / 5 / 8 / 11 / 14`) | — | Lightning Mage bolt (`LoopAnim=1`) |
| 268 | `revivesmall` | `0` / `1` | — | `0` | `25` | `Revive` | 25 | — | — | Spawned by `SkillCltStFunc[24]` for small monsters |
| 269 | `revivemedium` | `0` / `1` | — | `0` | `25` | `Revive` | 25 | — | — | Spawned by `SkillCltStFunc[24]` for medium monsters |
| 270 | `revivelarge` | `0` / `1` | — | `0` | `25` | `Revive` | 25 | — | — | Spawned by `SkillCltStFunc[24]` for large monsters |

---

## 3. Shared Server Summoning Pipeline (`SkillNec.cpp` & `Skills.cpp`)

Every Necromancer summon created via `D2GAME_SummonPet_6FD14430` passes through three universal stat-initialization stages:

### 1. Base Pet Level & `MonLvl.txt` Scaling (`D2GAME_SKILLS_SetSummonBaseStats_6FD0CB10`)
- Computes `petLevel`:
  $$\text{petLevel} = \text{clamp}\!\left(\text{slvl} + \left\lfloor \frac{3 \cdot \text{casterLevel}}{4} \right\rfloor,\; 1,\; \text{casterLevel}\right)$$
- Sets `STAT_LEVEL = petLevel` on the summoned unit.
- Looks up `MonLvl.txt[petLevel]` in the current difficulty (`0=N, 1=NM, 2=H`) and **adds** `MonLvl.txt -> L-AC` to `STAT_ARMORCLASS` and `MonLvl.txt -> L-TH` to `STAT_TOHIT`!

### 2. Passive Stats, `MonEquip.txt`, & Multiplicative Life (`D2GAME_SetSummonPassiveStats_6FD0C530`)
1. **`MonEquip.txt` Gear Initialization (`sub_6FCF9580`)**:
   - Evaluates `equipLvl = clamp(3 * slvl, 1, casterLevel)` and rolls `MonEquip.txt` entries for the summon's `hcIdx` (used by `necroskeleton` to upgrade weapon/armor/shield visual tiers with skill level).
2. **Flat Stat Additions (`passivestat1..5` / `passivecalc1..5`)**:
   - Evaluates each `passivecalc` on the **caster** (`SKILLS_EvaluateSkillFormula(pCaster, ...)`):
     - If `passivestat == STAT_MAXHP` (#7): adds `nValue` to both `STAT_MAXHP` and `STAT_HITPOINTS` **before** multiplicative `%HP` scaling! (This is why Skeleton Mastery's $+8$ flat HP per level is multiplied by Raise Skeleton's `calc1` `%HP`!).
     - If `passivestat == STAT_ITEM_NORMALDAMAGE` (#218): adds `nValue` to both `STAT_MINDAMAGE` and `STAT_MAXDAMAGE`.
3. **Buff Statlist (`aurastat1..6` / `aurastatcalc1..6`)**:
   - Allocates a permanent `STATLIST_BASIC` (`nFlags=0` or `0x40`) on the pet, applies `aurastat1..6`, and attaches `auraevent1..3` callbacks (`D2GAME_SKILLS_SetSummonAuraEvents_6FD0C150`).
4. **Multiplicative Life Scaling (`calc1`)**:
   - Evaluates `nBonusHpPct = SKILLS_EvaluateSkillFormula(pCaster, pSkillsTxtRecord->dwCalc[0], nSkillId, nSkillLevel)`:
     $$\text{FinalMaxHP} = \text{BaseAndPassiveHP} + \left\lfloor \frac{\text{BaseAndPassiveHP} \cdot \text{nBonusHpPct}}{100} \right\rfloor$$
5. **Granted Pet Skills (`sumskill1..5` / `sumsk1..5calc`)**:
   - Grants each `sumskill` at level `SKILLS_EvaluateSkillFormula(pCaster, dwSumSkCalc, ...)` onto the pet (`D2GAME_AssignSkill_6FD13800`); if `sumskill` is an aura (`Skills.txt -> aura == 1`, e.g. Fire Golem's `Holy Fire` #102), immediately activates it via `D2GAME_SKILLS_Handler_6FD12BA0`.

### 3. Summon Resist (`D2GAME_SetSummonResistance_6FD0C2E0`, Skill #89)
- Reads `STAT_PASSIVE_SUMMON_RESIST` (`stat #187`, granted by **Summon Resist** #89: `dm12` with `Param1=20, Param2=75`) from `pCaster`.
- Adds that value to the pet's `STAT_FIRERESIST`, `STAT_LIGHTRESIST`, `STAT_COLDRESIST`, and `STAT_POISONRESIST`, **with one critical assembly exception**:
  - Before adding each elemental resistance, checks if the pet's corresponding `STAT_ITEM_ABSORBFIRE_PERCENT` (#142), `STAT_ITEM_ABSORBLIGHT_PERCENT` (#144), or `STAT_ITEM_ABSORBCOLD_PERCENT` (#148) is `<= 0`!
  - Because **Fire Golem** (#94) has `STAT_ITEM_ABSORBFIRE_PERCENT = dm12 > 0`, `D2GAME_SetSummonResistance_6FD0C2E0` **skips adding Fire Resist** from Summon Resist to Fire Golem (preventing Summon Resist from pushing its `100%` Fire Resist cap/absorb formula out of alignment, while still granting it Lightning, Cold, and Poison Resist).

### 4. The Paladin Anti-Necromancy Easter Egg (`SKILLS_SrvDo031` & `SKILLS_SrvDo058`)
In both `SKILLS_SrvDo031_RaiseSkeleton_Mage` (`0x6FC718B0`) and `SKILLS_SrvDo058_Revive` (`0x6FC71340`), after summoning from a corpse:
```cpp
if (pCaster->dwUnitType == UNIT_PLAYER && pCaster->dwClassId == PCLASS_PALADIN) {
    int32_t nMaxHp = STATLIST_GetMaxLifeFromUnit(pCaster);
    if (nMaxHp > 0) {
        D2DamageStrc damage = {};
        damage.wResultFlags = 9;
        damage.dwPhysDamage = nMaxHp / 8;
        SUNITDMG_ExecuteMissileDamage(pGame, pCaster, pCaster, &damage);
    }
}
```
If a **Paladin** casts Raise Skeleton, Raise Skeletal Mage, or Revive (e.g., via `Harmony` runeword or item charges), he immediately takes **$12.5\%$ (`maxHP / 8`) of his maximum life** as unholy physical backlash damage!

---

## 4. Per-Skill Mechanics

### 1. Skeleton Mastery (`Skill #69`)
- Pure passive (`passive = 1`, `passivestate = skel_mastery` #97). Stores parameters read directly by **Raise Skeleton** (#70), **Raise Skeletal Mage** (#80), and **Revive** (#95):
  - `Param1 = 8`: $+8$ flat base HP per `Skeleton Mastery.lvl` to Skeletons and Skeletal Mages (multiplied by their `%HP` `calc1`!).
  - `Param2 = 2`: $+2$ flat base physical damage per `Skeleton Mastery.lvl` to Skeletons (multiplied by Skeleton `%ED`!).
  - `Param3 = 5`: $+5\%$ HP per `Skeleton Mastery.lvl` to Revived monsters.
  - `Param4 = 10`: $+10\%$ Enhanced Damage per `Skeleton Mastery.lvl` to Revived monsters.

### 2. Raise Skeleton (`Skill #70`, `SKILLS_SrvDo031` @ `0x6FC718B0` & `SKILLS_CltDo31` @ `0x6FB788A0`)
- **Pet Cap**: $\text{petmax} = (\text{slvl} < 4) \mathrel{?} \text{slvl} : \left(2 + \lfloor \text{slvl}/3 \rfloor\right)$ ($1, 2, 3$ at slvl $1..3$, then $+1$ every $3$ levels: $8$ at slvl 20).
- **Corpse Consumption**: Server sets `STATE_CORPSE_NODRAW` (#104) and clears collision; client (`SKILLS_CltDo31`) hides corpse and spawns `corpseexplosion` (#115 $\to$ `bigblood1`/`bigblood2` gore chunks).
- **Life Formula**:
  $$\text{SkeletonHP} = \left(\text{BaseHP}_{\text{diff}} + 8 \cdot \text{SM.lvl}\right) \times \left(1 + \frac{\max(0,\; 50\cdot(\text{slvl}-3))}{100}\right)$$
  *(where $\text{BaseHP}_{\text{diff}} = 21$ Normal, $30$ Nightmare, $42$ Hell).*
- **Damage Formula**:
  - Base damage (`1–2`) $+$ `passivecalc2` ($2 \cdot \text{SM.lvl} + \text{edmn}$, where `edmn` adds $+1\text{..}4$ per level above slvl 8), all multiplied by `aurastat1 = damagepercent` ($+7\% \cdot (\text{slvl}-3)$ for $\text{slvl} \ge 4$).
- **Visual Component Selection (`D2GAME_SetUnitComponent_6FD0C3A0`)**:
  - Reads `STAT_MODIFIERLIST_LEVEL` from `STATE_ITEMFULLSET` (`MonEquip.txt`) to select torso/legs/arms armor tier (`0..10`), and if `slvl > 2`, rolls a **$5\%$ (`Param1 = 5`) chance** to equip a shield on `nComponent[7]` (grants actual shield block via `MonStats.txt -> ToBlock = 3%` + shield item stats!).

### 3. Raise Skeletal Mage (`Skill #80`, `SKILLS_SrvDo031` @ `0x6FC718B0`)
- **Pet Cap**: Same formula as Raise Skeleton: $(\text{slvl} < 4) \mathrel{?} \text{slvl} : (2 + \lfloor \text{slvl}/3 \rfloor)$.
- **Life Formula**:
  $$\text{MageHP} = \left(\text{BaseHP}_{\text{diff}} + 8 \cdot \text{SM.lvl}\right) \times \left(1 + \frac{\max(0,\; 7\cdot(\text{slvl}-3))}{100}\right)$$
  *(where $\text{BaseHP}_{\text{diff}} = 61$ Normal, $88$ Nightmare, $123$ Hell).*
- **Element Selection (`D2GAME_SetUnitComponent_6FD0C3A0`)**:
  - Rolls `nElem = ITEMS_RollRandomNumber(&pMage->pSeed) & 3` (uniform $25\%$ each) and assigns `nComponent[11] = nComponent[12] = nElem` (glowing hand tint):
    - `0` = **Poison** (`necromage1` #208 — long-duration poison bolt: `500 + 250*(mlvl-1)` frames!)
    - `1` = **Cold** (`necromage2` #209 — chilling ice bolt: `25 + 25*(mlvl-1)` frames chill)
    - `2` = **Fire** (`necromage3` #210 — fire bolt)
    - `3` = **Lightning** (`necromage4` #211 — charged bolt)
- **Missile Skill Level (`NecromageMissile` #338, `SKILLS_SrvDo149` @ `0x6FCD4B10` & `SKILLS_CltDo95` @ `0x6FB088B0`)**:
  $$\text{mlvl} = \text{SM.lvl} + \begin{cases} 0 & \text{if } \text{slvl} < 4 \\ \lfloor (\text{slvl} - 2) / 2 \rfloor & \text{if } \text{slvl} \ge 4 \end{cases}$$
  When the mage attacks, `SKILLS_SrvDo149` / `SKILLS_CltDo95` reads `pMage->pMonsterData->nComponent[11]` (`0..3`) and fires `srvmissilea + nElem` (`208 + nElem`) at skill level `mlvl`.

### 4. Golem Group & Cross-Golem Hidden Synergies (`pettype = golem`, `idx = 3`)
All four golems share `pettype = golem` (`petmax = 1`), so summoning any golem automatically unsummons any previously active golem. Furthermore, all four golems share **hidden cross-golem base-level synergies (`blvl`)** in addition to **Golem Mastery** (#79, soft-level `lvl`):
- **Golem Mastery (#79)**: Grants $+20 \cdot \text{GM.lvl}\%$ Max HP (`ln12`), $+0\text{..}40\%$ Walk/Run Velocity (`dm34`), and $+25 \cdot \text{GM.lvl}$ Attack Rating (`ln56`) to **all** golems.
- **Clay Golem (#75 `blvl`)**: $+20$ Attack Rating per `ClayGolem.blvl` to all golems.
- **Blood Golem (#85 `blvl`)**: $+5\%$ Max HP per `BloodGolem.blvl` to Clay, Iron, and Fire Golems.
- **Iron Golem (#90 `blvl`)**: $+35$ Defense (`AC`) per `IronGolem.blvl` to all golems.
- **Fire Golem (#94 `blvl`)**: $+6\%$ Enhanced Physical Damage (`damagepercent`) per `FireGolem.blvl` to Clay, Blood, and Iron Golems.

### 5. Clay Golem (`Skill #75`, `SKILLS_SrvDo056_Golem` @ `0x6FC71750`)
- **Multiplicative Life Scaling**: Uniquely among golems, Clay Golem multiplies its own $+35\%\cdot(\text{slvl}-1)$ life bonus **multiplicatively** with Golem Mastery and Blood Golem synergy:
  $$\text{ClayHP}\% = \left\lfloor \frac{(100 + 35(\text{slvl}-1)) \cdot (100 + 20\cdot\text{GM.lvl} + 5\cdot\text{BG.blvl})}{100} \right\rfloor - 100$$
- **Dual Slow (`aurastat1 = item_slow` + `EventFunc27` @ `SKILLS_AuraEventFunc27_Slow`)**:
  1. **When Clay Golem hits an enemy**: `STAT_ITEM_SLOW = dm34` (`Param3=0, Param4=75`: $11\%$ at slvl 1, $63\%$ at slvl 20) slows the target via normal hit mechanics.
  2. **When Clay Golem is struck in melee (`auraevent1 = damagedinmelee`, `EventFunc27`)**: Applies `STATE_SLOWED` (#24) for $750$ frames ($30$ seconds) to the melee attacker (`pAttacker`), setting `-nSlow` to `STAT_VELOCITYPERCENT`, `STAT_ATTACKRATE`, and `STAT_OTHER_ANIMRATE` (capped at $50\%$ against players/bosses and $90\%$ against normal monsters).

### 6. Blood Golem (`Skill #85`, `SKILLS_SrvDo056_Golem` @ `0x6FC71750`)
- **Shared Life Steal (`EventFunc23` / `SKILLS_AuraEventFunc23_LifeSteal` on `domeleedamage`)**:
  - Steals `ln12` ($75 + 3\cdot(\text{slvl}-1)\%$, capped by target's current HP and scaled by target's `MonStats.txt -> Drain` effectiveness).
  - Splits stolen life: **`Param3 = 30%` goes to the Necromancer** (`pOwner`) and **`70%` goes to the Blood Golem** (if either unit is already at full HP, the overflow heals the other unit!). Applies Overlay #151 (`steallife`) on heal.
- **Shared Damage Link (`EventFunc26` / `SKILLS_AuraEventFunc26_DamageToCaster` on `damagedinmelee` & `damagedbymissile`)**:
  - Whenever Blood Golem takes damage, diverts `Param6 = 25%` (`dwParam[4]`/life link) of the incoming damage away from the Golem and onto the Necromancer (`pOwner`), **clamped so it can never reduce the Necromancer below `256` ($1.0$ HP)**.
  - *(Note: In v1.10+, the classic v1.09 "Blood Golem + Iron Maiden infinite life loop" was explicitly patched out in `EventFunc04_IronMaiden`: when `BloodGolem` (#290) is either the attacker or defender in an Iron Maiden reflection, `EventFunc04` overrides `dwPhysDamage` using a fixed life-fraction formula and zeroes out `EventFunc23` life-steal synergy).*

### 7. Iron Golem (`Skill #90`, `SKILLS_SrvSt20` @ `0x6FC6EDD0` & `SKILLS_SrvDo057` @ `0x6FC71540`)
- **Metal Item Validation (`SKILLS_SrvSt20_IronGolem`)**:
  - Target must be `UNIT_ITEM` in `IMODE_ONGROUND`, pass `ITEMS_IsMetalItem(pTarget->dwClassId)`, have `IFLAG_IDENTIFIED` (`0x10`), and not belong to another player (`D2GAME_Interactions_CheckItem_6FC4BD50`).
- **Item Ingestion & Persistence (`SKILLS_SrvDo057_IronGolem`)**:
  - Removes the item from the ground room (`D2GAME_RemoveItemIfOnGround_6FC4A660`), sets item mode to `IMODE_ONCURSOR`, summons `IronGolem` (#291, which has `MonStats.txt -> inventory = 1`), and equips the item directly into the Golem's body slot (`nBodyLoc1`) via `sub_6FC45060` + `D2GAME_ITEMS_UpdateItemStatlist_6FC42310`!
  - All item stats/auras/on-hit procs (e.g., `Insight` Meditation aura, `Pride` Concentration aura, Crushing Blow, resistances) merge into the Iron Golem's stats, and `D2GAME_SaveSummonInfo_6FD0C340` serializes the item into the Necromancer's character save so the Iron Golem persists across games!
  - If the consumed item is **Ethereal** (`ITEMS_CheckItemFlag(pItem, IFLAG_ETHEREAL)`), `D2GAME_SetSummonPassiveStats` leaves `aurastat2 = STAT_FADE = 16` active (rendering the Iron Golem translucent); if non-ethereal, it zeroes `STAT_FADE` (`STATLIST_SetStatIfListIsValid(..., STAT_FADE, 0, 0)`).
- **Thorns Self-Aura**: Sets `STATE_THORNS` (#36, `aura_thorns_front`/`back`) with `STAT_THORNS_PERCENT = ln12 = 150 + 15*(slvl - 1)%` melee damage returned to attackers.

### 8. Fire Golem (`Skill #94`, `SKILLS_SrvDo056_Golem` @ `0x6FC71750`)
- **Fire Immunity + Fire Absorb**:
  - `MonStats.txt` gives `firegolem` (#292) base `ResFi = 100`.
  - `Skills.txt` adds `aurastat1 = fireresist = 100 - dm12` and `aurastat2 = item_absorbfire_percent = dm12` (`Param1=25, Param2=100`: $33\%$ at slvl 1, $87\%$ at slvl 20), keeping Fire Golem's net Fire Resist $\ge 100\%$ while healing it from incoming fire damage.
- **Added Fire Damage & Active `Holy Fire` Aura**:
  - Adds `aurastat3 = firemindam` (`edmn`) and `aurastat4 = firemaxdam` (`edmx`) to its melee strikes.
  - Equips active Paladin aura `sumskill1 = Holy Fire` (#102, `SkillSrvDoFunc[66]` @ `0x6FCBAF50`) at skill level $\min(\text{ln56},\; 30) = \min(7 + \text{slvl},\; 30)$, dealing periodic radial fire pulse damage every `perdelay = 50` frames ($2$ seconds) to nearby enemies (`aurafilter = 42883`).

### 9. Revive (`Skill #95`, `SKILLS_SrvSt21` @ `0x6FC6ED60`, `SKILLS_SrvDo058` @ `0x6FC71340` & `SKILLS_CltSt24` @ `0x6FB78620`)
- **Target Validation (`SKILLS_SrvSt21_Revive`)**:
  - Target corpse must pass `D2GAME_CanSummonFromCorpse_6FD0C9E0`, have `MonStats2.txt -> revive == 1` (`gdwBitMasks[8]`, which excludes Act Bosses, SuperUniques, Champions/Uniques, and non-revivable constructs/unravelers), and pass `sub_6FD15190(pTarget, AISPECIALSTATE_REVIVED)`.
- **Client Cast Visual (`SKILLS_CltSt24_Revive` @ `0x6FB78620`)**:
  - Inspects the target corpse's monster size (`D2Common_10602` / `MonStats2.txt` size class `1..3`) and spawns:
    - Size `1` (Small): `cltmissileb = revivesmall` (#268)
    - Size `2` (Medium): `cltmissilea = revivemedium` (#269)
    - Size `3` (Large): `cltmissilec = revivelarge` (#270)
- **Server In-Place Resurrection (`SKILLS_SrvDo058_Revive`)**:
  - Unlike Raise Skeleton (which spawns a new `necroskeleton` unit and hides the corpse), Revive **resurrects the existing monster unit `pTarget` in-place**:
    1. Clears all corpse/curse/aura states, resets anim mode to `MONMODE_NEUTRAL` at `(X, Y)`.
    2. Re-rolls fresh 1-player HP for `pTarget->dwClassId` at `monsterLevel` (`D2Common_10646`); if `casterLevel < monsterLevel`, scales HP down by `casterLevel / monsterLevel`.
    3. Applies `D2GAME_SetSummonPassiveStats_6FD0C530`:
       - `calc1 = 200 + 5 * SkeletonMastery.lvl`% bonus HP ($3\times$ base HP at SM 0, $+5\%$ per SM level).
       - `aurastat1 = damagepercent = 10 * SkeletonMastery.lvl`% Enhanced Damage.
       - `passivestat1 = velocitypercent = +50%` (`Param5 = 50` movement speed boost!).
    4. Applies `D2GAME_SetSummonResistance_6FD0C2E0` (Summon Resist #89).
    5. Sets `STATE_REVIVE` (#96, translucent grey-black `colorshift = 73`), switches AI alignment to player's pet (`PETTYPE_REVIVE`, `idx = 6`, `petmax = slvl`), assigns `UMod 21` (timed death), and schedules `EVENTTYPE_MONUMOD` for `calc2 = ln34 = 4500` frames (**$180$ seconds**).

### 10. Port notes verified against the 1.13c MPQs (Issue #993)
- **`necromage1..4` CelFile** (Missiles.txt, re-read from `Patch_D2.mpq`): `poisonNova` (32 dirs, `LoopAnim=0`), `Icebolt`, `Firebolt`, `ChargedBolt` — the table in §2 is correct (some issue texts claimed `PoisonBall` / `LightningBolt`; those are wrong).
- **Skeletal Mage hands**: MonStats2.txt `necromage` has `S4v = S5v = pos,cld,fir,lht`; DCCs `data\global\monsters\SK\S4\SKS4{POS,CLD,FIR,LHT}{A1,GH,NU,S1,WL}HTH.dcc` (same for S5) are transparent glow layers. Variant index = 0xAC component[11] (= element, same order as necromage1..4). The port bakes `entities/monster-sk-hth-s4s5<variant>.{json,r8}` (`pack-entity-assets.ts --component-variants-only`) and selects them per unit (`monster-component-variants-113c.ts`).
- **Iron Golem metal test** (`ITEMS_IsMetalItem`): Weapons/Armor/Misc.txt `bitfield1 & 2` (Armor/Weapons `3` = metal, `1` = leather/wood/bone, `5` = wand/staff/orb; Misc rows are `0`/`1`, so rings/amulets/jewels are not metal).
- **Unsummon** (Skills.txt #3): `TargetPet=1`, `leftskill` blank (right-hand only), `InTown=1`; PetType.txt `unsummon=1` rows: valkyrie, golem, skeleton, skeletonmage, revive, dopplezon, spiritwolf, fenris, totem, vine, grizzly, shadowwarrior.
