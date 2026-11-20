# D2Game.dll 1.13c — Monster Melee Combat Skills: ToHit, Shield Block & `S1` Riders

## Scope & Authoritative Sources
- **Binaries**: `D2Game.dll` v1.13c (`SUNITDMG_AllocCombat` `0x6FCFE5A0`, `SKILLS_RollToHit` / melee skill helper `0x6FCC11B0`, `SrvDo150_Smite` `0x6FCB87D0` / `0x6FCB9000`, `SrvDo103_DiabRun` `0x6FCD3F10`, `SrvDo134_SiegeBeastStomp` `0x6FC2C900` -> `0x6FCC10B0`, `SrvDo109_MonFrenzy` `0x6FCD67EC`).
- **MPQ Data Tables**: `Patch_D2.mpq` `data\global\excel\Skills.txt`, `MonStats.txt`.

---

## 1. `RollToHit` vs `ResultFlags` & Shield Block Matrix

In `D2Game.dll` 1.13c, monster melee combat skills do **not** bypass `SUNITDMG_AllocCombat` (`0x6FCFE5A0`) with raw unmitigated HP subtraction. Instead, each skill's `Skills.txt` `ResultFlags` bit `0` (`0x1`) and `srvdofunc` govern whether `RollToHit` (Attack Rating vs Defense) and Shield Block / Weapon Block / Dodge (`SUNITDMG_CheckBlockOrDodge` `0x6FCFB790`) execute:

| Skill ID | `Skills.txt` Name | `srvdofunc` | `ResultFlags` | `%AR` Bonus (`ToHit` / `LevToHit` / `ToHitCalc`) | `RollToHit` vs AC? | Shield Block (`PLRMODE_BLOCK = 9`)? | On-Hit Effects |
| ---: | :--- | ---: | ---: | :--- | :---: | :---: | :--- |
| `10` | `Jab` | `7` | `0` | `10 + 9 * (slvl - 1)` | Yes | Yes | 3 rapid physical strikes (`-15 + 3*(slvl-1)%` ED) |
| `97` | `Smite` | `150` | `8` | Auto-hit (`0x6FCB87D0`) | **No** (auto-hit) | **No** (unblockable & unavoidable) | Knockback + Stun (`state 21`, `min(250, 15 + 15*slvl)` frames) on hit |
| `107` | `Charge` | `67` | `0` | `50 + 15 * (slvl - 1)` | Yes | Yes | `+100 + 25*(slvl-1)%` ED + Knockback on hit |
| `126` | `Bash` | `2` | `8` | `15 + 5 * slvl` | Yes | Yes | `+50 + 5*(slvl-1)%` ED, `+slvl` flat phys, Knockback on hit |
| `143` | `Leap Attack` | `78` | `0` | `50 + 15 * (slvl - 1)` | Yes | Yes | `+100 + 30*(slvl-1)%` ED + Knockback on hit |
| `151` | `Whirlwind` | `76` | `0` | `5 * (slvl - 1)` | Yes | Yes | Multi-frame spin channel (`-50 + 8*(slvl-1)%` ED) |
| `156` | `Fire Hit` | `83` | `0` | `20 + 10 * (slvl - 1)` | Yes (`S1` AR) | Yes | Uses `MonStats.txt` `S1` phys + `El1Mode = S1` elemental rider |
| `198` | `DiabRun` | `103` | `5` (`0x1 \| 0x4`) | `ResultFlags & 1` | **No** (auto-hit) | **Yes** | Knockback on unblocked hit |
| `215` | `MonFrenzy` | `109` | `0` | `10 + 10 * (slvl - 1)` | Yes | Yes | Self `state 141` (`frenzy`) **only** when hit succeeds (`ResultFlags & 1`) |
| `301` | `Siege Beast Stomp` | `134` | `1` (`0x1`) | `ResultFlags & 1` | **No** (auto-hit) | **Yes** | AoE melee physical slam within `4.0` sub-tiles |
| `328` | `BloodLordFrenzy` | `109` | `0` | `10 + 10 * (slvl - 1)` | Yes | Yes | Self `state 141` (`frenzy`) **only** when hit succeeds |
| `352` | `SerpentCharge` | `67` | `0` | `50 + 15 * (slvl - 1)` | Yes | Yes | `Param3 = 0, Param4 = 0` (`+0%` ED, unlike `#107 Charge`) + Knockback on hit |

---

## 2. Key Binary Rules

### 2.1 Conditional On-Hit Knockback, Stun, and Self-Frenzy (`0x6FCD67EC`)
- Knockback (`ResultFlags & 8` or skill knockback) and Stun (`state 21`) only execute when the attack hits and is **not** blocked/dodged (`dmgOut.hit === true`).
- `SrvDo109_MonFrenzy` (`0x6FCD67EC`, shared by `#215 MonFrenzy` and `#328 BloodLordFrenzy`) checks `(ResultFlags & 1) != 0` after the melee strike before applying `STATE_FRENZY` (`141`) to the attacker. Missed or shield-blocked Frenzy swings grant zero Frenzy haste.

### 2.2 `#156 Fire Hit` Uses `MonStats.txt` `S1` Mode & `El1Mode = S1` Riders
Despite its internal skill name `"Fire Hit"`, `Skills.txt` row `156` has empty `EType`, `EMin`, and `EMax` columns. Its elemental payload comes entirely from the casting `SandRaider` row's `S1` attack and `El1Mode = S1` rider in `MonStats.txt`:
- **Fire `S1` variants**: `sandraider1` (`hcIdx 29`, Sand Raider), `sandraider3` (`31`, Invader), `sandraider5` (`33`, Assailant), `sandraider6` (`599`), `sandraider8` (`601`), `sandraider10` (`603`) — `El1Mode = S1`, `El1Type = fire`, `El1Pct = 100`.
- **Cold `S1` variants**: `sandraider2` (`hcIdx 30`, Marauder, `El1Dur = 75`), `sandraider4` (`32`, Infidel, `El1Dur = 75`), `sandraider7` (`600`, Marauder, `El1Dur = 150`), `sandraider9` (`602`, Invader, `El1Dur = 250`) — `El1Mode = S1`, `El1Type = cold`, `El1Pct = 100`, applying `STATE_COLD` (`11`) chill on hit.

### 2.3 `#352 SerpentCharge` vs `#107 Charge` (`ClawViper` Family)
- `clawviper1..5` (`hcIdx 73..77`) cast `#352 SerpentCharge` (`Param3 = 0, Param4 = 0` -> `1.0x` physical multiplier).
- `clawviper6..10` (`hcIdx 594..598`) cast `#107 Charge` (`slvl = 5`, `Param3 = 100, Param4 = 25` -> `3.0x` physical multiplier) and store their primary physical base damage in `S1`/`A2` when `A1` is `0..0`.
