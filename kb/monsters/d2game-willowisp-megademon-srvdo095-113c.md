# `WillOWisp` (`0x6FCA0F20`), `Megademon` (`0x6FC38CE0`), `FrozenHorror` (`0x6FC379A0`) & `SrvDo095` Monster Inferno (`0x6FCD32E0` / `0x6FCD65E0` / `0x6FCD6A60`) — v1.13c

## 1. `AITHINK_Fn025_WillOWisp` (`D2Game.dll` `0x6FCA0F20..0x6FCA1C6F`)
- Applies to `hcIdx 118..121` (`willowisp1..4`), `639..641` (`willowisp5..7`), and `733` (`willowisp8`).
- **Never calls `CastSkill` (`0x6FD12380`)**: although `MonStats.txt` populates `Skill1 = Chain Lightning (#53)` (`Sk1mode = SC`), `AITHINK_Fn025_WillOWisp` never invokes `CastSkill`.
- **Ranged `MissC` Lightning Bolt**:
  - Within `aip3` (`30..50` sub-tiles), rolls `rand(100) < aip1` (`40..75%`, unconditional on HP) to execute `MONMODE_CAST` (`'C'`, mapped to `'SC'` in `MonStats.txt`), spawning `MissC` (`#320 willowisplightningbolt` or `#666 willowisplightningbolt2`).
  - `#320` and `#666` carry `SrcDamage = 128`, `MinDamage = MaxDamage = 0`, `EMin = EMax = 0`, `EType = ltng`.
  - In `D2Common#10413` (`0x6FDBBAA0`), mode `'C'` (`MONMODE_CAST`) carries `0` physical melee weapon/A1 damage (`modeMinPhys = modeMaxPhys = 0`) and resolves `MonStats.txt` `El2Mode = 'SC'` (`type = 'ltng'`, `minD = 5`, `maxD = [120, 160, 190]` scaled by `MonLvl.txt` `L-DM%`), never `El1Mode = 'A1'` (`type = 'mana'`).

## 2. `SKILLS_SetInfernoMissileRange` (`0x6FCD32E0..0x6FCD33A6`) & `SrvSt53` / `SrvDo095`
- Applies across all 5 `Skills.txt` rows with `srvstfunc = 53`, `srvdofunc = 95`:
  1. `#178 FetishInferno` (`srvmissilea = fetishinferno1` `#144`: `Vel = 12`, `Range = 30`, `Param2 = 7`, `calc1 = ''`, `calc2 = 'par1'`, `param1 = 15`, `calc3 = '3'`)
  2. `#311 mon inferno sentry` (`srvmissilea = inferno sentry 1` `#523`: `Vel = 12`, `Range = 50`, `Param2 = 12`, `calc1 = "ln34/2 + skill('Wake of Fire Sentry'.blvl)"`, `param3 = 40`, `calc2 = "par1 + skill('Wake of Fire Sentry'.blvl)"`, `param1 = 15`, `calc3 = '3'`)
  3. `#317 Baal Inferno` (`srvmissilea = baal inferno` `#554`: `Vel = 20`, `Range = 2048`, `Param2 = 12`, `calc1 = ''`, `calc2 = 'par1'`, `param1 = 20`, `calc3 = '2'`)
  4. `#319 MegademonInferno` (`srvmissilea = megademoninferno` `#675`: `Vel = 12`, `Range = 30`, `Param2 = 7`, `calc1 = ''`, `calc2 = 'par1'`, `param1 = 15`, `calc3 = '2'`)
  5. `#323 Horror Arctic Blast` (`srvmissilea = frozenhorror arcticblast1` `#493`: `Vel = 12`, `Range = 30`, `Param2 = 7`, `calc1 = ''`, `calc2 = 'par1'`, `param1 = 15`, `calc3 = '2'`)
- **`SKILLS_SetInfernoMissileRange` (`0x6FCD32E0`)**:
  - Evaluates `pSkillsTxt->dwCalc[0]` (`calc1`).
  - When `<= 0`, falls back to `pMissilesTxt->dwParam[1] + nSkillLevel - 1` (`missile.param2 + slvl - 1`).
  - Clamps `[1, 255]` and writes the frame count directly to `nTotalFrames` / `nRemainingFrames` (overriding raw `Missiles.txt.Range = 30` / `50` / `2048`).
- **`SKILLS_SrvSt53_MonsterInferno` (`0x6FCD65E0`) & `SKILLS_SrvDo095_MonsterInferno` (`0x6FCD6A60`)**:
  - Applies `STATE_INFERNO (12)` for `calc2` frames (`15` or `20`) and spawns 1 `srvMissileA` bolt (`skipMultishot: true`) every `max(1, calc3)` frames (`2` or `3`), aborting immediately on GetHit, freeze, stun, or loss of `STATE_INFERNO (12)`.

## 3. `AITHINK_Fn089_Megademon` (`0x6FC38CE0`) & `AITHINK_Fn124_FrozenHorror` (`0x6FC379A0`)
- **`Megademon`** (`hcIdx 360..362, 558, 686..687, 712`): rolls `rand(100) < aip1` (`50..90%`) at range (`> 2.5`) or `rand(100) < aip2` (`40..65%`) in melee (`<= 2.5`), and paces `#319 MegademonInferno` with `aip6` (`[75, 60, 45]` frames).
- **`FrozenHorror`** (`hcIdx 501..505`): checks `!STATES_CheckState(pUnit, STATE_INFERNO /*12*/)` and rolls `rand(100) < aip3` (`60..80%`) to channel `#323 Horror Arctic Blast`.
