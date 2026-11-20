# Diablo II v1.13c Paladin Combat Skills (`#96`, `#97`, `#101`, `#106`, `#107`, `#111`, `#112`, `#116`, `#117`, `#121`)

> **Binary Ground Truth**:
> - `D2Client.dll` v1.13c (Image Base `0x6FAB0000`)
> - `D2Game.dll` v1.13c (Image Base `0x6FC20000`)
> - `D2Common.dll` v1.13c (Image Base `0x6FD50000`)
> - MPQ Data Tables: `Skills.txt`, `Missiles.txt`, `States.txt`, `Overlay.txt`

This document establishes the authoritative client and server execution mechanics for all 10 Paladin **Combat Skills** in Diablo II: Lord of Destruction v1.13c: **Sacrifice** (`#96`), **Smite** (`#97`), **Holy Bolt** (`#101`), **Zeal** (`#106`), **Charge** (`#107`), **Vengeance** (`#111`), **Blessed Hammer** (`#112`), **Conversion** (`#116`), **Holy Shield** (`#117`), and **Fist of the Heavens** (`#121`).

---

## 1. Function Dispatch Tables (`D2Client.dll` & `D2Game.dll` v1.13c)

### 1.1 Client Skill & Missile Dispatch (`D2Client.dll`, Base `0x6FAB0000`)

| Dispatch Table | Table VA | Index | Function VA | RVA | Assigned Skills / Missiles |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `25` | `0x6FADBF40` | `0x02BF40` | Charge (`#107`) |
| `g_apfnSkillCltStFunc` | `0x6FB8E928` | `53` | `0x6FAC51B0` | `0x0151B0` | Zeal (`#106`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `21` | `0x6FAC4FD0` | `0x014FD0` | Zeal (`#106`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `34` | `0x6FADB530` | `0x02B530` | Sacrifice (`#96`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `35` | `0x6FADBE30` | `0x02BE30` | Blessed Hammer (`#112`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `36` | `0x6FADBD20` | `0x02BD20` | Fist of the Heavens (`#121`) |
| `g_apfnSkillCltDoFunc` | `0x6FB8EA48` | `37` | `0x6FADB6E0` | `0x02B6E0` | Charge (`#107`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `1` | `0x6FB617C0` | `0x0B17C0` | `holybolt` (`#55`), `blessedhammer` (`#92`), `teethexplode` (`#204`), `fistoftheheavensdelay` (`#233`), `fistoftheheavensbolt` (`#234`) |
| `g_apfnCltDoFunc` | `0x6FB8D8A0` | `2` | `0x6FB63060` | `0x0B3060` | `blood1` (`#18`, spawned by Sacrifice) |
| `g_apfnCltHitFunc` | `0x6FB8DA10` | `9` | `0x6FB66990` | `0x0B6990` | `holybolt` (`#55`), `fistoftheheavensbolt` (`#234`) |
| `g_apfnCltHitFunc` | `0x6FB8DA10` | `26` | `0x6FB6AD40` | `0x0BAD40` | `fistoftheheavensdelay` (`#233`) |

### 1.2 Server Skill & Missile Dispatch (`D2Game.dll`, Base `0x6FC20000`)

| Dispatch Table | Table VA | Index | Function VA | Symbolic Name | Assigned Skills / Missiles |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `29` | `0x6FCB8E90` | `SKILLS_SrvSt29_Sacrifice` | Sacrifice (`#96`) |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `31` | `0x6FCB9620` | `SKILLS_SrvSt31_Charge` | Charge (`#107`) |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `32` | `0x6FC473C0` | `SKILLS_SrvSt32_Conversion_Bash_Stun_Concentrate_BearSmite` | Conversion (`#116`) |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `35` | `0x6FCB8BA0` | `SKILLS_SrvSt35_Vengeance` | Vengeance (`#111`) |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `36` | `0x6FCB8390` | `SKILLS_SrvSt36_HolyShield` | Holy Shield (`#117`) |
| `gpSkillSrvStartFnTable` | `0x6FD27338` | `37` | `0x6FC6C4F0` | `SKILLS_SrvSt37_Zeal_Fury_BloodLordFrenzy` | Zeal (`#106`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `2` | `0x6FCC3220` | `SKILLS_SrvDo002_Kick_PowerStrike_..._Vengeance` | Vengeance (`#111`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `13` | `0x6FC6DAC0` | `SKILLS_SrvDo013_Fend_Zeal_Fury` | Zeal (`#106`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `18` | `0x6FC628F0` | `SKILLS_SrvDo018_DefensiveBuff` | Holy Shield (`#117`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `64` | `0x6FCB9290` | `SKILLS_SrvDo064_Sacrifice` | Sacrifice (`#96`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `67` | `0x6FCB9D20` | `SKILLS_SrvDo067_Charge` | Charge (`#107`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `73` | `0x6FCB94C0` | `SKILLS_SrvDo073_BlessedHammer` | Blessed Hammer (`#112`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `79` | `0x6FCB9830` | `SKILLS_SrvDo079_Conversion` | Conversion (`#116`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `80` | `0x6FCB93A0` | `SKILLS_SrvDo080_FistOfTheHeavens` | Fist of the Heavens (`#121`) |
| `gpSkillSrvDoFnTable` | `0x6FD274A8` | `150` | `0x6FCB9000` | `SKILLS_SrvDo150_Smite` | Smite (`#97`) |
| `gpMissileSrvDoFnTable` | `0x6FD2D970` | `1` | `0x6FC5F540` | `MISSMODE_SrvDo01_BasicMissile` | All Paladin combat missiles |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `7` | `0x6FC59FD0` | `MISSMODE_SrvHit07_HolyBolt_FistOfTheHeavenBolt` | `holybolt` (`#55`), `fistoftheheavensbolt` (`#234`) |
| `gpMissileSrvHitFnTable` | `0x6FD2DA48` | `22` | `0x6FC5DB30` | `MISSMODE_SrvHit22_FistOfTheHeavensDelay` | `fistoftheheavensdelay` (`#233`) |
| `gpMissileSrvDmgFnTable` | `0x6FD2DB68` | `5` | `0x6FC5A790` | `MISSMODE_SrvDmg05_BlessedHammer` | `blessedhammer` (`#92`) |

---

## 2. MPQ Data Tables (`Skills.txt`, `Missiles.txt`, `States.txt`)

### 2.1 `Skills.txt` Summary Table

| ID | Skill | ReqLvl | Anim / Seq | `srvst` / `srvdo` | `cltst` / `cltdo` | Mana (`mana` / `lvlmana` / `shift`) | Missiles / States | Core Formulas (`calc1`..`calc4`, Synergies) |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| `96` | **Sacrifice** | 1 | `A1` / `A1` (`seqnum=2`) | `29` / `64` | `0` / `34` | `0` (`shift=8`) | `cltmissilea=blood1` (`#18`) | `calc1 = ln12 + Redemption.blvl*15 + Fanaticism.blvl*5` (`180 + 15*(slvl-1)`% ED); `calc2 = 8` (% self-dmg); `ToHit = 20 + 7*(slvl-1)`% |
| `97` | **Smite** | 1 | `S1` / `S1` (`weapsel=4`) | `0` / `150` | `0` / `0` | `2` / `0` / `8` (2.0 flat) | `ResultFlags=8` (Knockback), `itypea1=shld` | `calc1 = ln34` (`15 + 15*(slvl-1)`% ED); `calc2 = min(250, ln12)` (`min(250, 15 + 5*(slvl-1))` stun frames) |
| `101` | **Holy Bolt** | 6 | `SC` / `SC` | `0` / `0` | `0` / `0` | `32` / `1` / `4` ($2 + 0.0625(\text{slvl}-1)$) | `srvmissile=holybolt` (`#55`), `castoverlay=cast_undead` | `calc1 = ln12 * (100 + Prayer.blvl*15) / 100` (min heal, `ln12 = 1 + 2*(slvl-1)`); `calc2 = ln34 * (100 + Prayer.blvl*15) / 100` (max heal, `ln34 = 6 + 4*(slvl-1)`); `EDmgSymPerCalc = (Blessed Hammer.blvl + Fist of the Heavens.blvl)*50`% |
| `106` | **Zeal** | 12 | `A1` / `A1` | `37` / `13` | `53` / `21` | `2` / `0` / `8` (2.0 flat) | `SrcDam=128`, `Param2=100` (% rollback) | `calc1 = min(2 + slvl - 1, 5)` (swings); `calc2 = ((lvl < 5) ? 0 : (lvl-4)*6) + Sacrifice.blvl*12`% ED; `ToHit = 10 + 10*(slvl-1)`% |
| `107` | **Charge** | 12 | `SQ` / `A1` (`seqnum=4`, `seqinput=8`) | `31` / `67` | `25` / `37` | `9` / `0` / `8` (9.0 flat) | `STATE_SKILL_MOVE` (`#18`), `Param1=150` (% vel), `Param5=2` (trails) | `calc1 = ln34 + (Vigor.blvl + Might.blvl)*20` (`100 + 25*(slvl-1)`% ED); `ToHit = 50 + 15*(slvl-1)`% |
| `111` | **Vengeance** | 18 | `A1` / `A1` | `35` / `2` | `0` / `0` | `16` / `1` / `6` ($4 + 0.25(\text{slvl}-1)$) | `EType=cold`, `ELen=30`, `ELevLen1..3=15` | `calc1` (Fire%) $= (70 + 6(\text{slvl}-1)) + \text{Resist Fire.blvl}\cdot 10 + \text{Salvation.blvl}\cdot 2$; `calc2` (Cold%) / `calc3` (Ltng%) analogous |
| `112` | **Blessed Hammer** | 18 | `SC` / `SC` | `0` / `73` | `0` / `35` | `20` / `1` / `6` ($5 + 0.25(\text{slvl}-1)$) | `srvmissilea=blessedhammer` (`#92`), `Param1=4` (Conc 4/8) | `EType=mag`, `EMin=12` (`+8/10/12/13/14`), `EMax=16` (`+8/10/12/13/14`); `EDmgSymPerCalc = (Vigor.blvl + Blessed Aim.blvl)*14`% |
| `116` | **Conversion** | 24 | `A1` / `A1` | `32` / `79` | `0` / `0` | `4` / `0` / `8` (4.0 flat) | `auratargetstate=conversion` (`#53`), `conversion_save` (`#109`) | `calc1 = dm34` (`0..50`% diminishing chance); `auralencalc = ln12 = 400` frames (16.0 s constant) |
| `117` | **Holy Shield** | 24 | `SC` / `SC` (`itypea1=shld`) | `36` / `18` | `0` / `0` | `35` / `0` / `8` (35.0 flat) | `aurastate=holyshield` (`#101`) | `auralencalc = 750 + 625*(slvl-1)` frames; `aurastat1=toblock` (`dm56`: `10..40`%); `calc1 = (25 + 15*(slvl-1)) + Defiance.blvl*15`% (`skill_armor_percent`); Smite flat dmg `MinDam=3` (`+2/3/4/4/4`), `MaxDam=6` (`+2/3/4/4/4`) |
| `121` | **Fist of the Heavens** | 30 | `SC` / `SC` (`delay=25`) | `0` / `80` | `0` / `36` | `25` / `0` / `8` (25.0 flat) | `srvmissilea=fistoftheheavensdelay` (`#233`), `srvoverlay=handofgod` | `EType=ltng`, `EMin=150` (`+15/30/45/55/65`), `EMax=200` (`+15/30/45/55/65`); `EDmgSymPerCalc = Holy Shock.blvl*7`%; `aurarangecalc=20`, `aurafilter=42375` (`0xA587`) |

### 2.2 `Missiles.txt` Summary Table

| ID | Missile Name | `pCltDo` / `pCltHit` | `pSrvDo` / `pSrvHit` / `pSrvDmg` | `Vel` / `MaxVel` / `Accel` | `Range` | Collision (`Type` / `Friend` / `Kill` / `Pierce`) | Key Parameters & Submissiles |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `18` | `blood1` | `2` / `0` | `0` / `0` / `0` | `3` / `3` / `0` | `128` | `0` / `0` / `1` / `0` | `LocalBlood=1`, `Explosion=1`, `CelFile=BloodSmall01` |
| `55` | `holybolt` | `1` / `9` | `1` / `7` / `0` | `20` / `20` / `0` | `50` | `3` / `1` / `1` / `0` | `Holy=1`, `sHitPar1=1` (heal ally), `sHitPar2=1` (undead only), `ProgOverlay=healing`, `CltHitSubMissile1=teethexplode` (`#204`) |
| `92` | `blessedhammer` | `1` / `0` | `1` / `0` / `5` | `18` / `30` / `250` | `120` | `3` / `0` / `0` / `1` | `dParam1=50` (+50% Undead), `dParam2=50` (+50% Demon), `InitSteps=6`, `SrcTown=1`, `CltSrcTown=8`, `ResultFlags=4` |
| `204` | `teethexplode` | `1` / `0` | `1` / `0` / `0` | `0` / `0` / `0` | `13` | `0` / `0` / `0` / `0` | `Explosion=1`, `AnimLen=13`, `Trans=1` |
| `233` | `fistoftheheavensdelay` | `1` / `26` | `1` / `22` / `0` | `0` / `0` / `0` | `10` | `0` / `0` / `0` / `0` | `AlwaysExplode=1`, `Explosion=1`, `HitSubMissile1` / `CltHitSubMissile1=fistoftheheavensbolt` (`#234`) |
| `234` | `fistoftheheavensbolt` | `1` / `9` | `1` / `7` / `0` | `12` / `12` / `0` | `50` | `3` / `1` / `1` / `0` | `Holy=3`, `NextDelay=4`, `sHitPar1=1`, `sHitPar2=1`, `EType=mag`, `EMin=40` (`+6/10/16/32/48`), `EMax=50` (`+6/10/16/32/48`), `EDmgSymPerCalc = Holy Bolt.blvl*15`% |

---

## 3. Detailed Skill Reverse-Engineering

### 3.1 Sacrifice (`#96`)

#### Server Execution (`SKILLS_SrvSt29_Sacrifice` @ `0x6FCB8E90`, `SKILLS_SrvDo064_Sacrifice` @ `0x6FCB9290`)
1. **Start Phase (`SrvSt29` @ `0x6FCB8E90`)**:
   - Verifies the target exists (`SUNIT_GetTargetUnit`) and checks `UNITS_IsInMeleeRange(pUnit, pTarget, 0)`.
   - Allocates a `D2DamageStrc` via `SUNITDMG_AllocDamageData` (`dwHitClass = 2`, `SrcDam = 128`) and evaluates `calc1`:
     $$\text{ED}\% = \underbrace{180 + 15(\text{slvl} - 1)}_{\text{ln12}} + 15 \cdot \text{Redemption}_{\text{blvl}} + 5 \cdot \text{Fanaticism}_{\text{blvl}}$$
   - Calls `SUNITDMG_FillDamageValues(pGame, pUnit, pTarget, pDamage, 0, srcDam)` with Attack Rating bonus `ToHit = 20 + 7*(slvl - 1)`% and stores `pDamage` on the caster's skill/attack record.
2. **Action Frame (`SrvDo064` @ `0x6FCB9290`)**:
   - Retrieves `pDamage` via `SUNITDMG_GetDamageFromUnits(pUnit, pTarget)` and snapshots the physical damage rolled against the target (`nBasePhysDamage = pDamage->dwPhysDamage`) before resistances/events modify it.
   - Calls `SUNITDMG_ExecuteEvents(pGame, pUnit, pTarget, 1, pDamage)`.
   - If the attack hits (`pDamage->wResultFlags & DAMAGERESULTFLAG_SUCCESSFULHIT`):
     - Caps `nPhysDamage` at the target's remaining `STAT_HITPOINTS` (`nHitpoints = STATLIST_UnitGetStatValue(pTarget, STAT_HITPOINTS, 0)`):
       $$D_{\text{capped}} = \min(D_{\text{phys}}, \text{HP}_{\text{target}})$$
     - Evaluates `calc2` (`par3 = 8`%) and computes self-inflicted physical damage:
       $$D_{\text{self}} = \left\lfloor \frac{D_{\text{capped}} \times 8}{100} \right\rfloor$$
     - Constructs a separate `selfDamage` struct (`dwHitFlags = pDamage->dwHitFlags | 0x1000`, `wResultFlags = pDamage->wResultFlags`, `dwPhysDamage = nSelfDamage`) and applies it to the Paladin via `SUNITDMG_ExecuteEvents(pGame, pTarget, pUnit, 0, &selfDamage)` followed by `SUNITDMG_ExecuteMissileDamage(pGame, pTarget, pUnit, &selfDamage)`. Because it goes through `SUNITDMG_ExecuteEvents`, the Paladin's own physical damage reduction (`STAT_DAMAGERESIST` / integer `STAT_NORMAL_DAMAGE_REDUCTION`) reduces the self-damage, and a Paladin CAN kill himself with Sacrifice if `D_self` exceeds his current life!
   - Finishes by calling `SUNITDMG_ExecuteMissileDamage(pGame, pUnit, pTarget, pDamage)` on the target.

#### Client Execution (`SkillCltDoFunc_34` @ `0x6FADB530`)
- Checks the `gore` / local blood option (`0x6FAF4320`); if disabled, returns immediately.
- Evaluates `cltcalc1` (`3`) via `D2Common#11276`, adds a random `0..2` (`rand % 3`), and spawns `3..5` client-only `blood1` (`#18`) missiles (`pCltDoFunc = 2` @ `0x6FB63060`) at the Paladin's coordinates moving along the opposite vector (`2*x_pal - x_target`, `2*y_pal - y_target` plus `-2..+2` random jitter) to spray blood backward from the Paladin's own body.

---

### 3.2 Smite (`#97`)

#### Server Execution (`SKILLS_SrvDo150_Smite` @ `0x6FCB9000`)
Smite has no `SrvStFunc` (`srvstfunc = 0`) and no client functions (`cltstfunc = 0`, `cltdofunc = 0`). All combat resolution executes in `SKILLS_SrvDo150_Smite` (`0x6FCB9000`):
1. **Shield Requirement & Range Check**:
   - Calls `INVENTORY_GetEquippedShield(pUnit->pInventory, &pShield)`. If `!pShield`, returns `0`.
   - Verifies `UNITS_IsInMeleeRange(pUnit, pTarget, 0)`. Because Smite never calls `SUNITDMG_RollHitOrMiss`, it **auto-hits** (100% hit chance, ignoring Attack Rating and target Defense; can only be avoided by weapon/shield block skills in PvP).
2. **Base Shield Damage + Holy Shield Flat Bonus**:
   - Reads the shield item's `MonStats`/`Armor.txt` smite damage in 256ths:
     $$D_{\min} = \text{ITEMS\_GetMinDamage}(p\text{Shield}) \ll 8, \qquad D_{\max} = \text{ITEMS\_GetMaxDamage}(p\text{Shield}) \ll 8$$
   - Checks if the Paladin has `STATE_HOLYSHIELD` (`#101`) active via `STATLIST_GetStatListFromUnitAndState(pUnit, STATE_HOLYSHIELD)`. If active, reads the stored skill ID (`STAT_MODIFIERLIST_SKILL`) and skill level (`STAT_MODIFIERLIST_LEVEL`) from the Holy Shield statlist and adds Holy Shield's `MinDam`/`MaxDam` (`SKILLS_GetMinPhysDamage` / `SKILLS_GetMaxPhysDamage`) directly to $D_{\min}$ and $D_{\max}$ before percentage bonuses!
3. **Enhanced Damage Multiplier (`bUseWeapon = 0`)**:
   - Evaluates `calc1 = ln34 = 15 + 15*(slvl - 1)`% and calls `SUNITDMG_ApplyDamageBonuses(pUnit, 0, pShield, nMinDamage, nMaxDamage, nBonusDmgPct, 0, 0x80)`:
     - Passing `bUseWeapon = 0` and `pItem = pShield` means **weapon Enhanced Damage% (`+% ED` on weapon) and weapon Min/Max Damage (`+Min`/`+Max` on weapon or charms/jewels) are NOT applied** to Smite.
     - However, integer `+Damage` (`STAT_ITEM_NORMALDAMAGE`, e.g., *Grief* runeword, *The Redeemer*, *Astreon's Iron Ward*), off-weapon `+% ED` (Fortitude, Might, Fanaticism, Concentration), Strength bonus (`100%` per point), and `+% Damage to Demons/Undead` all apply!
     - Notably, `STAT_SKILL_CONCENTRATION` is checked inside `SUNITDMG_ApplyDamageBonuses` even when `bUseWeapon = 0`.
4. **Stun & Knockback**:
   - Sets `damage.dwHitFlags = 2` (`DAMAGEHITFLAG_MELEE` / bypasses normal AR roll), `damage.wResultFlags = pSkillsTxtRecord->wResultFlags | DAMAGERESULTFLAG_SUCCESSFULHIT` (`8 | 1 = 9`, forcing **Knockback** + Successful Hit).
   - Evaluates `calc2 = min(250, 15 + 5*(slvl - 1))` and sets `damage.dwStunLen` (stunning eligible targets for `0.6s` at slvl 1 up to a hard cap of `250` frames = `10.0s` at slvl 48).
   - Calls `SUNITDMG_ExecuteEvents(pGame, pUnit, pTarget, 1, &damage)` (triggering Crushing Blow, Open Wounds, and Chance-to-Cast on Striking, while Life/Mana Steal do not work because Smite sets `dwHitFlags = 2` without leech flags) and `SUNITDMG_ExecuteMissileDamage`.

---

### 3.3 Holy Bolt (`#101`)

#### Cast Path (`srvdofunc = 0`, `srvmissile = holybolt` `#55`)
Holy Bolt defines `srvstfunc = 0`, `srvdofunc = 0`, `cltstfunc = 0`, `cltdofunc = 0`, and sets `srvmissile = holybolt` (`#55`), `cltmissile = holybolt` (`#55`), `TargetAlly = 1`, `TargetPet = 1`.
- On the server, `D2GAME_SKILLS_Handler_6FD12BA0` (`Skills.cpp:2507–2552`) detects `srvdofunc == 0` with a valid `wSrvMissile` (`#55`) and automatically launches `holybolt` toward the target coordinates via `sub_6FD11420`.
- On the client, the default client cast handler spawns `cltmissile = holybolt` (`#55`) with `castoverlay = cast_undead` (`HolyBoltCloud`).

#### Collision & Dual Heal/Undead-Damage Handler (`MISSMODE_SrvHit07_HolyBolt_FistOfTheHeavenBolt` @ `0x6FC59FD0`)
`holybolt` (`#55`) has `CollideType = 3` (units + walls), `CollideFriend = 1` (collides with allies/pets!), `CollideKill = 1`, `sHitPar1 = 1` (heals allies), and `sHitPar2 = 1` (undead only). When `holybolt` collides with `pUnit`, `MISSMODE_SrvHit07` (`0x6FC59FD0`) executes:
1. **Wall / Null Target**: If `!pUnit`, returns `MISSMODE_SrvDmgHitHandler(pGame, pMissile, nullptr, 1)` (destroying the bolt on walls).
2. **Self-Collision Bypass**: If `pUnit == pOwner`, returns `4` (continues flying through the caster).
3. **Friendly Ally / Pet Heal (`sHitPar1 != 0`)**:
   - Checks `SUNIT_AreUnitsAligned(pGame, pOwner, pUnit)`. If aligned (party player, mercenary, or summon):
     - Evaluates `calc1` and `calc2` on the owning skill (`Holy Bolt` `#101` or `Fist of the Heavens` `#121`):
       $$\text{Heal}_{\min} = \left\lfloor (1 + 2(\text{slvl}-1)) \times \frac{100 + 15 \cdot \text{Prayer}_{\text{blvl}}}{100} \right\rfloor, \qquad \text{Heal}_{\max} = \left\lfloor (6 + 4(\text{slvl}-1)) \times \frac{100 + 15 \cdot \text{Prayer}_{\text{blvl}}}{100} \right\rfloor$$
       *(shifted left by `HitShift = 8` for 256ths precision).*
     - Rolls random heal in $[\text{Heal}_{\min}, \text{Heal}_{\max}]$, caps `STAT_HITPOINTS` at `STATLIST_GetMaxLifeFromUnit(pUnit)`, and if `nHitpoints != nMaxHp`, applies `ProgOverlay = healing`.
     - Returns `3` (terminating the missile on the healed ally).
4. **Enemy Collision (`sHitPar2 = 1` Undead Filter)**:
   - If `pUnit->dwUnitType != UNIT_MONSTER`, returns `4` (**passes harmlessly through hostile players** in PvP!).
   - Checks `sHitPar2`:
     - `sHitPar2 == 1` (`holybolt` & `fistoftheheavensbolt`): Calls `MONSTERS_IsUndead(pUnit)`. If the monster is **NOT Undead**, returns `4` (**pierces harmlessly through non-undead monsters** without detonating!).
     - If the monster **IS Undead**, calls `MISSMODE_SrvDmgHitHandler(pGame, pMissile, pUnit, 0)` and returns `3` (dealing Magic damage scaled by `+50% * (Blessed Hammer.blvl + Fist of the Heavens.blvl)` synergy and destroying the missile).
     - **Undead Magic Immunity Bypass (`Missiles.txt` `Holy` Bitmask)**: In `D2Common/src/Units/Missile.cpp:564–577`, `nHoly & 1` sets `pMissileDamageData->nFlags |= 0x100` (`STAT_SKILL_BYPASS_UNDEAD` `#356`), which in `MISSMODE_FillDamageParams` (`MissMode.cpp:264`) sets `DAMAGEHITFLAG_BYPASSUNDEAD`. Inside `SUNITDMG_ApplyResistancesAndAbsorb` (`0x6FCBFB40`), `DAMAGEHITFLAG_BYPASSUNDEAD` sets `bDontAbsorb = 1` against Undead targets, clamping any positive resistance (`nResValue > 0`, **including $\ge 100\%$ Magic Immunity** on Greater Mummies / Achmel the Cursed!) to **`0%`**. Thus `holybolt` (`Holy = 1`) and `fistoftheheavensbolt` (`Holy = 3`) unconditionally pierce Undead Magic Immunity!

#### Client Collision (`MissileCltHitFunc_09` @ `0x6FB66990`)
Mirrors `MISSMODE_SrvHit07` on `D2Client.dll`: ignores `pOwner` (returns `4`), checks alignment when `cHitPar1 != 0` (detonates with `teethexplode` `#204` on allies), checks `MONSTERS_IsUndead` when `cHitPar2 == 1` (passes through non-undead with return `4`, or spawns `CltHitSubMissile1 = teethexplode` `#204` with `HitSound = paladin_holybolt_impact_1` and returns `3` on Undead).

---

### 3.4 Zeal (`#106`)

Zeal shares its server/client multi-strike rollback architecture with Amazon Fend and Druid Fury.

#### Server Execution (`SKILLS_SrvSt37_Zeal_Fury_BloodLordFrenzy` @ `0x6FC6C4F0`, `SKILLS_SrvDo013_Fend_Zeal_Fury` @ `0x6FC6DAC0`)
1. **Start Phase (`SrvSt37` @ `0x6FC6C4F0`)**:
   - Checks `UNITS_IsInMeleeRange(pUnit, pTarget, 0)`.
   - Evaluates `calc1 = min(2 + slvl - 1, 5)` (`2` swings at slvl 1 up to `5` swings at slvl 4+) and stores:
     - `SkillParam1` = remaining swing counter $N_{\text{swings}}$
     - `SkillParam2` = `pTarget->dwUnitType`
     - `SkillParam3` = `pTarget->dwUnitId`
   - Sets `SKILLS_SetFlags(pSkill, 0x200)` (`uninterruptible` during the swing sequence).
2. **Action Frame & Rollback Loop (`SrvDo013` @ `0x6FC6DAC0`)**:
   - Resolves the current target from `(SkillParam2, SkillParam3)`; if dead or out of melee range (`!UNITS_IsInMeleeRange`), searches for a new valid enemy in melee range via `sub_6FD15460(pGame, pUnit, 0, nAuraRange)`.
   - Evaluates `calc2` for Enhanced Damage%:
     $$\text{ED}\% = \begin{cases} 12 \cdot \text{Sacrifice}_{\text{blvl}} & \text{if } \text{slvl} < 5 \\ 6(\text{slvl} - 4) + 12 \cdot \text{Sacrifice}_{\text{blvl}} & \text{if } \text{slvl} \ge 5 \end{cases}$$
   - Rolls weapon hit and damage (`ToHit = 10 + 10*(slvl - 1)`%, `SrcDam = 128`) and executes `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`.
   - Decrements `SkillParam1` (`nSwingsLeft = SkillParam1 - 1`).
   - If `nSwingsLeft > 0`:
     - Calls `sub_6FD15460` to pick the next adjacent enemy (or stay on the same enemy if no other target is found).
     - Calls `sub_6FD15080(pUnit, pSkillsTxtRecord->dwParam[1])` with `Param2 = 100` (100% animation rollback to the sequence start/contact frame), causing the server unit to fire the next `SrvDo013` event after a rapid follow-up swing interval rather than restarting a full `A1` animation!
   - When `nSwingsLeft == 0`, clears `SkillParam1..3` and lets the animation finish normally.

#### Client Execution (`SkillCltStFunc_53` @ `0x6FAC51B0`, `SkillCltDoFunc_21` @ `0x6FAC4FD0`)
- `CltStFunc_53` (`0x6FAC51B0`): Evaluates `calc1` (`min(2 + slvl - 1, 5)`), stores the swing count on the client `D2SkillStrc`, and locks the initial target.
- `CltDoFunc_21` (`0x6FAC4FD0`): Plays weapon swing sound, decrements the client swing counter, and while `swingsLeft > 0`, rewinds the client unit's animation frame by `Param2 = 100`% so client visuals stay frame-locked with the server's rapid swing cadence.

---

### 3.5 Charge (`#107`)

#### Server Execution (`SKILLS_SrvSt31_Charge` @ `0x6FCB9620`, `SKILLS_SrvDo067_Charge` @ `0x6FCB9D20`)
1. **Start Phase (`SrvSt31` @ `0x6FCB9620`)**:
   - Checks if the Paladin is **already in melee range** (`UNITS_IsInMeleeRange(pUnit, pTarget, 0)`). If so, Charge **cannot** initiate a sprint and instead falls back to a standard melee attack (`D2GAME_SKILLS_Handler_6FD12BA0(pGame, pUnit, 0, 1, 1, 0, 0)`) and returns `0`!
   - Otherwise, sets `STATES_ToggleState(pUnit, STATE_SKILL_MOVE, 1)` (`#18`), configures the unit's `pDynamicPath` with `PATHTYPE_CHARGEDBOLT` / sprint tracking (`D2Common_10142`), and sets `SKILLS_SetFlags(pSkill, 0x1001)`.
   - Computes sprint velocity in `SKILLS_SetChargeVelocity` (`SkillPal.cpp:25–53`):
     $$V_{\text{charge}} = \left\lfloor \frac{V_{\text{base\_run}} \times \left(150 + \max(50, \text{STAT\_VELOCITYPERCENT})\right)}{100} \right\rfloor$$
     *(where `Param1 = 150`%).*
2. **Sprint & Impact (`SrvDo067` @ `0x6FCB9D20`)**:
   - Executed repeatedly on animation event ticks during `SQ` (`seqnum = 4`, `seqinput = 8`).
   - While NOT yet in melee range of the target (`!UNITS_IsInMeleeRange`) and path steps remain: keeps `STATE_SKILL_MOVE` active and continues sprinting.
   - Upon reaching melee range (or colliding with the target):
     - Clears `STATE_SKILL_MOVE` (`#18`) and resets skill flags.
     - Rewinds unit animation to the impact event frame (`nEventFrame = 7`) and switches to `seqtrans = A1`.
     - Rolls melee hit (`ToHit = 50 + 15*(slvl - 1)`%, `SrcDam = 128`) with massive Enhanced Damage (`calc1`):
       $$\text{ED}\% = \underbrace{100 + 25(\text{slvl} - 1)}_{\text{ln34}} + 20 \cdot \left(\text{Vigor}_{\text{blvl}} + \text{Might}_{\text{blvl}}\right)$$
     - Forces Knockback (`damage.wResultFlags |= 8`), sets `damage.dwHitClass = 0x70`, applies impact overlay `147` (`UNITS_SetOverlay(pTarget, 147, 0)`), and executes `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`.

#### Client Execution (`SkillCltStFunc_25` @ `0x6FADBF40`, `SkillCltDoFunc_37` @ `0x6FADB6E0`)
- `CltStFunc_25` (`0x6FADBF40`): Initializes the client sprint path, plays `paladin_charge`, and enables motion shadow trails (`Param5 = 2`).
- `CltDoFunc_37` (`0x6FADB6E0`): Advances the `SQ` charge sequence while moving; upon reaching melee range, transitions the client animation to the `A1` strike frame and disables motion trails.

---

### 3.6 Vengeance (`#111`)

#### Server Execution (`SKILLS_SrvSt35_Vengeance` @ `0x6FCB8BA0`, `SKILLS_SrvDo002` @ `0x6FCC3220`)
Vengeance computes its entire tri-elemental weapon conversion during the start phase (`SrvSt35` @ `0x6FCB8BA0`) and finishes state/damage application in the shared melee finisher (`SrvDo002` @ `0x6FCC3220`):
1. **Base Weapon Damage Roll (`SrvSt35` @ `0x6FCB8BA0`)**:
   - Verifies `UNITS_IsInMeleeRange(pUnit, pTarget, 0)`.
   - Allocates `D2DamageStrc` and calls `SUNITDMG_FillDamageValues` (`ToHit = 20 + 10*(slvl - 1)`%, `SrcDam = 128`) to roll standard physical damage, leech, and hit/miss.
   - If the attack hits (`pDamage->wResultFlags & DAMAGERESULTFLAG_SUCCESSFULHIT`):
     - Queries the Paladin's **base weapon damage** (before off-weapon `% ED`, Strength, or auras like Might/Fanaticism, though **including** weapon `+% ED`, `+Min`/`+Max` damage, and integer `+Damage` depending on `SUNITDMG_RollDamageValueInRange`):
       $$D_{\text{wpn}} \in [D_{\text{wpn\_min}}, D_{\text{wpn\_max}}]$$
2. **Tri-Elemental Percentage Calculation & Mastery Application**:
   - Evaluates `calc1` (Fire%), `calc2` (Cold%), and `calc3` (Lightning%):
     $$\begin{aligned}
     P_{\text{fire}} &= 70 + 6(\text{slvl} - 1) + 10 \cdot \text{Resist Fire}_{\text{blvl}} + 2 \cdot \text{Salvation}_{\text{blvl}} \\
     P_{\text{cold}} &= 70 + 6(\text{slvl} - 1) + 10 \cdot \text{Resist Cold}_{\text{blvl}} + 2 \cdot \text{Salvation}_{\text{blvl}} \\
     P_{\text{ltng}} &= 70 + 6(\text{slvl} - 1) + 10 \cdot \text{Resist Lightning}_{\text{blvl}} + 2 \cdot \text{Salvation}_{\text{blvl}}
     \end{aligned}$$
   - For each element $e \in \{\text{fire}, \text{cold}, \text{ltng}\}$, checks `STAT_PASSIVE_FIRE_MASTERY` (`#329`), `STAT_PASSIVE_COLD_MASTERY` (`#331`), and `STAT_PASSIVE_LTNG_MASTERY` (`#330`) (e.g., from Rainbow Facets or Ormus' Robes) and scales the percentage if present:
     $$D_e = \left\lfloor \frac{D_{\text{wpn}} \times P_e}{100} \times \frac{100 + \text{Mastery}_e}{100} \right\rfloor$$
   - Adds $D_{\text{fire}}$, $D_{\text{cold}}$, and $D_{\text{ltng}}$ directly onto `pDamage->dwFireDamage`, `pDamage->dwColdDamage`, and `pDamage->dwLtngDamage`, while keeping the physical damage `pDamage->dwPhysDamage` intact!
   - Sets `pDamage->dwColdLen` from `SKILLS_GetElementalLength` (`ELen = 30 + 15*(slvl - 1)` frames = `1.2s + 0.6s*(slvl - 1)` in Normal).
   - Cycles `pDamage->dwHitClass` across `0x20` (`32`, Fire), `0x30` (`48`, Cold), and `0x40` (`64`, Lightning) using `SkillParam1 = (SkillParam1 + 1) % 3` so successive swings alternate elemental hit audio/visuals!

---

### 3.7 Blessed Hammer (`#112`)

#### Archimedean Spiral Path (`PATH_ComputePathBlessedHammer` @ `D2Common.0x6FDAB3C0`, Ordinal `#10334` @ `0x6FD86230`)
Both the server (`SKILLS_SrvDo073_BlessedHammer` @ `0x6FCB94C0`) and client (`SkillCltDoFunc_35` @ `0x6FADBE30`) spawn `blessedhammer` (`#92`), set path type `PATHTYPE_BLESSEDHAMMER` (`14`), and invoke `D2Common#10334`:
- Generates **77 discrete path points** (`i = 0..76`) around the Paladin's origin `(X_0, Y_0)` in 16.16 fixed-point sub-tile coordinates:
  - Angular velocity: $\Delta\theta = \frac{512}{32} = 16$ binary-256 angle units per step (**32 steps per full $360^\circ$ revolution**, starting at a fixed north-west angle regardless of the Paladin's facing direction!).
  - Radial expansion: $\Delta r = 9600$ in 16.16 fixed-point ($9600 / 65536 = 0.146484375$ sub-tiles per step).
  - At step $k$, position is:
    $$X_k = X_0 + \left\lfloor k \cdot 0.146484375 \cdot \cos\left(\theta_0 + \frac{2\pi k}{32}\right) \right\rfloor, \qquad Y_k = Y_0 + \left\lfloor k \cdot 0.146484375 \cdot \sin\left(\theta_0 + \frac{2\pi k}{32}\right) \right\rfloor$$
- `blessedhammer` (`#92`) has `Range = 120` frames (`4.8` seconds), `Vel = 18`, `MaxVel = 30`, `Accel = 250`, `Pierce = 1` (pierces all enemies without dying), and `CollideType = 3` (destroyed only on walls/obstacles).

#### Concentration Aura Interaction (`SKILLS_GetConcentrationDamageBonus` in `SKILLS_SrvDo073_BlessedHammer` @ `0x6FCB94C0`)
Blessed Hammer is the **only spell in Diablo II** boosted by an Enhanced Damage% aura:
1. Inside `SKILLS_SrvDo073_BlessedHammer` (`0x6FCB94C0`), after rolling base Magic damage (`EMin`/`EMax` + `+14% * (Vigor.blvl + Blessed Aim.blvl)` synergy), the server calls `SKILLS_GetConcentrationDamageBonus(pUnit, nSkillId)` (`D2Common/src/D2Skills.cpp:1772`):
   - Checks `STATES_CheckState(pUnit, STATE_CONCENTRATION)` (`#42`).
   - If active, looks up the `STATE_CONCENTRATION` statlist on `pUnit` (`STATLIST_GetStatListFromUnitAndState`) and reads `STAT_DAMAGEPERCENT` (`#25`) specifically from that aura statlist (so off-weapon item `%ED` such as Fortitude or Might does not affect Blessed Hammer) and scales it by `Param1 / 8`:
     $$\text{ConcBonus}\% = \left\lfloor \frac{\text{Concentration\_ED}\% \times \text{Param1}}{8} \right\rfloor = \left\lfloor \frac{\left(60 + 15(\text{slvl}_{\text{Conc}} - 1)\right) \times 4}{8} \right\rfloor = \left\lfloor \frac{\text{Concentration\_ED}\%}{2} \right\rfloor$$
   - Multiplies the hammer's magic damage (`dwMagDamage`) by:
     $$D_{\text{hammer}} = \left\lfloor D_{\text{base\_mag}} \times \frac{100 + \text{ConcBonus}\%}{100} \right\rfloor$$
   - Because `Param1 = 4`, Blessed Hammer receives **exactly 50% ($\frac{4}{8}$) of Concentration's Enhanced Damage%** as a multiplicative multiplier on top of synergies!

#### +50% Damage vs Undead & Demons (`MISSMODE_SrvDmg05_BlessedHammer` @ `0x6FC5A790`) & v1.13c `Holy = 0` Change
When `blessedhammer` (`pSrvDmgFunc = 5`) hits a monster, `MISSMODE_SrvDmg05_BlessedHammer` (`0x6FC5A790`, `MissMode.cpp:4418–4439`) executes:
- Reads base magic damage `nBaseDamage = MISSMODE_GetDamageValue(pGame, pMissile, pUnit, pDamage)`:
  - If `MONSTERS_IsUndead(pUnit)` and `dParam1 > 0` (`dParam1 = 50`): adds `+50%` Magic damage (`MISSMODE_AddDamageValue(..., nBaseDamage * 50 / 100)`).
  - If `MONSTERS_IsDemon(pUnit)` and `dParam2 > 0` (`dParam2 = 50`): adds `+50%` Magic damage (`MISSMODE_AddDamageValue(..., nBaseDamage * 50 / 100)`).
- **v1.13c Resistance Bypass Removal (`Holy = 0`)**: In patches 1.10–1.12, `blessedhammer` had `Holy = 3` (`0b011`) in `Missiles.txt`, which set `STAT_SKILL_BYPASS_UNDEAD` and `STAT_SKILL_BYPASS_DEMONS` (`Missile.cpp:564–572`) and ignored Magic Immunity on Undead and Demons. In **v1.13c**, `blessedhammer`'s `Holy` field in `Missiles.txt` is `0` (`empty`): Blessed Hammer still gains its `+50%` damage multiplier against Undead and Demons via `MISSMODE_SrvDmg05_BlessedHammer`, but no longer bypasses their Magic Resistance or Magic Immunity (unless the Paladin has **Sanctuary** `#119` active, whose `aurastat3 = skill_bypass_undead` sets `STAT_SKILL_BYPASS_UNDEAD` on all missiles created by the Paladin in `Missile.cpp:672`!).

---

### 3.8 Conversion (`#116`)

#### Server Execution (`SKILLS_SrvSt32` @ `0x6FC473C0`, `SKILLS_SrvDo079_Conversion` @ `0x6FCB9830`)
1. **Melee Hit (`SrvSt32` @ `0x6FC473C0`)**:
   - Performs a normal weapon melee attack (`SrcDam = 128`). If the melee swing misses or is blocked, Conversion does not roll.
2. **Conversion Roll & Level-Ratio HP Scaling (`SrvDo079` @ `0x6FCB9830`)**:
   - Executes `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`. If `wResultFlags & DAMAGERESULTFLAG_SUCCESSFULHIT`:
     - Verifies target is a living hostile monster (`pTarget->dwUnitType == UNIT_MONSTER`, `!MONSTERS_GetHirelingTypeId(pTarget)`, `STATLIST_GetUnitAlignment(pTarget) == UNIT_ALIGNMENT_EVIL`), is not a Boss/SuperUnique (`sub_6FD15190(pTarget, AISPECIALSTATE_TERROR)`), and is not level-restricted (`clvl >= mlvl` is NOT required, see below).
     - Evaluates `calc1 = dm34` (diminishing returns from `Param3 = 0` to `Param4 = 50`%: $\lfloor \frac{50 \times \lfloor \frac{110 \cdot \text{slvl}}{\text{slvl}+6} \rfloor}{100} \rfloor$, giving `9%` at slvl 1 up to `45%` at slvl 20) and rolls `(rand % 100) < nChance`.
     - On success:
       - Applies `STATE_CONVERSION` (`#53`, `overlay1 = conversionaura`) for `auralencalc = ln12 = 400` frames (`16.0` seconds) with expiry callback `SKILLS_StatRemoveCallback_Conversion` (`0x6FCB9B60` in 1.13c / `SkillPal.cpp:696`).
       - Flips the monster's alignment to friendly (`sub_6FCBDD30(pTarget, UNIT_ALIGNMENT_GOOD, 1)`).
       - **1.10+ Anti-Exploit HP Scaling (`clvl < mlvl`)**: If the Paladin's character level `clvl < mlvl`, creates a hidden `STATE_CONVERSION_SAVE` (`#109`) statlist storing the monster's original `STAT_LEVEL` and `STAT_MAXHP`, sets the monster's `STAT_LEVEL = clvl`, and scales both `STAT_HITPOINTS` and `STAT_MAXHP` down by $\frac{\text{clvl}}{\text{mlvl}}$.
       - When the 16-second duration expires, `SKILLS_StatRemoveCallback_Conversion` flips alignment back to `UNIT_ALIGNMENT_EVIL`, restores `STAT_LEVEL` and `STAT_MAXHP` from `STATE_CONVERSION_SAVE`, and scales current `STAT_HITPOINTS` back up by $\frac{\text{mlvl}_{\text{saved}}}{\text{clvl}}$ (preventing the classic 1.09 bug where high-level monsters reverted with 1 HP).

---

### 3.9 Holy Shield (`#117`)

#### Server Execution (`SKILLS_SrvSt36_HolyShield` @ `0x6FCB8390`, `SKILLS_SrvDo018_DefensiveBuff` @ `0x6FC628F0`)
1. **Shield Check (`SrvSt36` @ `0x6FCB8390`)**:
   - Calls `INVENTORY_GetEquippedShield(pUnit->pInventory, nullptr)`. If no shield is equipped (`itypea1 = shld`), aborts casting (`return 0`).
2. **Buff Application (`SrvDo018` @ `0x6FC628F0`)**:
   - Evaluates duration `auralencalc = ln12 = 750 + 625*(slvl - 1)` frames (`30s + 25s*(slvl - 1)`).
   - Creates/updates an expiring statlist for `aurastate = holyshield` (`#101`, `transform = 1`, which visually swaps the Paladin's equipped shield graphic to the glowing sacred targe `hs` overlay/mode and shortens block recovery animation frames!).
   - Assigns two aura stats to the statlist:
     - `aurastat1 = toblock` (`#20`): `dm56` (`Param5 = 10`, `Param6 = 40`%: $+14\%$ faster/increased block chance at slvl 1 up to $+35\%$ at slvl 20, added directly to shield base block before Dexterity scaling!).
     - `aurastat2 = skill_armor_percent` (`#171`): `ln34 + Defiance.blvl*15` (`(25 + 15*(slvl - 1)) + 15*Defiance.blvl`% Enhanced Defense — multiplies the character's **total** base defense, not just the shield's!).
   - Stores `STAT_MODIFIERLIST_SKILL = 117` and `STAT_MODIFIERLIST_LEVEL = slvl` on the statlist so `SKILLS_SrvDo150_Smite` (`0x6FCB9000`) can query Holy Shield's flat physical shield damage (`MinDam = 3` `+2/3/4/4/4`, `MaxDam = 6` `+2/3/4/4/4`).

---

### 3.10 Fist of the Heavens (`#121`)

Fist of the Heavens executes a two-stage sky-strike + radial Holy Bolt nova with a `delay = 25` frame (`1.0` second) casting cooldown.

#### Stage 1: Delay Missile & Sky-Strike Overlay (`SKILLS_SrvDo080_FistOfTheHeavens` @ `0x6FCB93A0`, `SkillCltDoFunc_36` @ `0x6FADBD20`)
1. **Target Acquisition**:
   - Both server (`SrvDo080` @ `0x6FCB93A0`) and client (`CltDoFunc_36` @ `0x6FADBD20`) require a valid target unit (`SUNIT_GetTargetUnit`).
2. **Spawning `fistoftheheavensdelay` (`#233`)**:
   - Applies `srvoverlay = handofgod` (`HolyShockHit`, 21 frames) directly onto the target unit (`UNITS_SetOverlay`).
   - Spawns invisible timer missile `fistoftheheavensdelay` (`#233`, `Range = 10` frames = `0.4` seconds, `AlwaysExplode = 1`) at the target's exact `(X, Y)` coordinates.
   - Packs the primary target's identity into the missile's target fields:
     - `MISSILE_SetTargetX(pMissile, pTarget->dwUnitType)`
     - `MISSILE_SetTargetY(pMissile, pTarget->dwUnitId)`

#### Stage 2: Lightning Impact & Radial Holy Bolt Nova (`MISSMODE_SrvHit22_FistOfTheHeavensDelay` @ `0x6FC5DB30`, `MissileCltHitFunc_26` @ `0x6FB6AD40`)
After `Range = 10` ticks (`0.4` seconds), `fistoftheheavensdelay` expires and triggers `pSrvHitFunc = 22` (`0x6FC5DB30`) on the server and `pCltHitFunc = 26` (`0x6FB6AD40`) on the client:
1. **Primary Target Lightning Strike (`MISSMODE_SrvHit22` @ `0x6FC5DB30`)**:
   - Unpacks `(TargetX, TargetY)` as `(eTargetType, dwTargetGUID)` and resolves `pTarget = SUNIT_GetServerUnit(pGame, eTargetType, dwTargetGUID)`.
   - If `pTarget` is alive, populates `D2DamageStrc` from `fistoftheheavensdelay` (which inherited FoH's Lightning damage: `EMin = 150` `+15/30/45/55/65`, `EMax = 200` `+15/30/45/55/65`, scaled by `+7% * Holy Shock.blvl` synergy) and deals it directly via `SUNITDMG_ExecuteEvents` + `SUNITDMG_ExecuteMissileDamage`.
2. **Radial Target Scan (`aurarangecalc = 20` sub-tiles)**:
   - Evaluates `aurarangecalc = 20` sub-tiles ($13.33$ yards) around the delay missile's detonation coordinates.
   - Calls `sub_6FD0FE80` with `aurafilter = 42375` (`0xA587`: hostile monsters/players, valid attackable targets, not in town) and callback `MISSMODE_FistOfTheHeavensDelay_AuraCallback` (`MissMode.cpp:1985`).
   - For **every valid enemy** inside the 20-subtile radius (except the primary target `pTarget` itself, which is skipped so it is not hit by a spawned bolt at point-blank), spawns **one** `fistoftheheavensbolt` (`#234`) originating from the detonation point and aimed directly at that enemy!
   - *(Note: Despite `Skills.txt` listing `Param1 = 6`, `Param2 = 1`, `calc4 = ln12` ("# bolts"), `MISSMODE_SrvHit22_FistOfTheHeavensDelay` does NOT spawn a fixed ring of bolts; it spawns exactly 1 bolt per valid enemy in range!)*
3. **`fistoftheheavensbolt` (`#234`) Behavior**:
   - Uses `pSrvHitFunc = 7` (`MISSMODE_SrvHit07_HolyBolt_FistOfTheHeavenBolt` @ `0x6FC59FD0`) and `pCltHitFunc = 9` (`0x6FB66990`) with `sHitPar1 = 1`, `sHitPar2 = 1`, and `NextDelay = 4` frames.
   - Deals Magic damage (`EMin = 40` `+6/10/16/32/48`, `EMax = 50` `+6/10/16/32/48`, scaled by `+15% * Holy Bolt.blvl` synergy) **exclusively to Undead** (piercing harmlessly through non-undead monsters and hostile players), or heals friendly allies/pets (`calc1 = 1 + 2*(slvl-1)`, `calc2 = 6 + 2*(slvl-1)`) on contact!
   - Client `MissileCltHitFunc_26` (`0x6FB6AD40`) runs an identical radial scan via `0x6FB51860` (callback `0x6FB663C0`) so client `fistoftheheavensbolt` trajectories match the server's one-bolt-per-enemy targeting.
