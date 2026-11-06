# 1.13c Monster Missile Damage (`D2Common#10413`), Poison DoT (`STATE_POISON`), `GreaterMummy` AI & Curative Potions

Authoritative reverse-engineering reference from `D2Common.dll`, `D2Game.dll`, and MPQ Excel tables (`Missiles.txt`, `MonStats.txt`, `Skills.txt`, `States.txt`, `Misc.txt`) in Diablo II: Lord of Destruction v1.13c.

---

## 1. `D2Common#10413` (`0x6FDBBAA0`) — Server Missile Damage Packet Builder

When a monster (or object trap) fires a projectile without an explicit player skill damage override, `D2Game` populates the `SUnitDmg` packet via `D2Common#10413` (`MISSILE_CalculateDamageData`, `0x6FDBBAA0`):

1. **Base Missile Physical & Elemental Damage (`Missiles.txt`, `HitShift`, `Skill` link)**:
   - `0x6FDBA3E0` / `0x6FDBA510`: If `Missiles.txt` `Skill` (`offset 0x164`) resolves to a valid `Skills.txt` ID (`> 0`), physical and elemental `min..max` (in `1/256` fixed-point) delegate to `SKILLS_GetMinPhysDamage` / `SKILLS_GetMaxPhysDamage` / `SKILLS_GetElementalMinDamage` / `SKILLS_GetElementalMaxDamage` (`D2Common#10968` / `#10969` / `#10121` / `#11091`).
   - Otherwise, `0x6FDBB360` evaluates `Missiles.txt` 5-band level scaling (`MinDamage + MinLevDam1..5` and `EMin + MinELev1..5` / `Emax + MaxELev1..5` across brackets `2..8`, `9..16`, `17..22`, `23..28`, `29+`), optionally scaled by `DmgSymPerCalc` / `EDmgSymPerCalc`, and left-shifts by `HitShift` (`0..8`, where `HitShift = 8` means `× 256` = whole HP in `1/256` units, while poison breaths such as `mummy1..4` use `HitShift = 3..4` for `1/256` HP/frame bitrates).
   - `0x6FDB9DC0`: Elemental length `ELen` uses 3-band scaling (`slvl <= 1: ELen`, `2..8: +ELevLen1`, `9..16: +ELevLen2`, `17+: +ELevLen3`).
   - `D2Common#11089` (`0x6FDA4D6C`): When `EType == 'pois'`, `(minElem256..maxElem256)` is the **per-frame poison bitrate** (`1/256` HP/frame), NOT total cumulative HP; cumulative `1/256` poison damage is `bitrate256 * durationFrames`.

2. **`SrcDamage` Gate (`0x6FDBBCD4..0x6FDBBF6B`)**:
   - Monster `A1MinD..A1MaxD` / `A2MinD..A2MaxD` / `S1MinD..S1MaxD` physical damage and `MonStats.txt` `El1..3` elemental riders are added **only when `Missiles.txt` `SrcDamage > 0`**, scaled by `(monDmg256 * SrcDamage) >> 7` (`SrcDamage / 128`).
   - Projectiles with `SrcDamage = 0` (`mummy1..4`, `mummyex`, `unholybolt1..4`, `tentaclegoo`, `spidergoo`, `fetishdart1..2`, `trapfirebolt`, `trapnova`, `viper_poisjav`) inherit **zero** monster melee physical damage.

---

## 2. `MonStats.txt` `El1..3` Poison Rider Scaling (`D2Game.dll` `0x6FC97695`)

In `MONSTER_ApplyElementalDamage` (`0x6FC97620`), after scaling `ElMinD..ElMaxD` by `MonLvl.txt` `L-DM%`:

- For `ElType == 5` (`pois`, `0x6FC97695..0x6FC976CD`):
  - `STAT_POISONMINDAM = scaledElMin * 10` (`1/256` HP/frame)
  - `STAT_POISONMAXDAM = scaledElMax * 10` (`1/256` HP/frame)
  - `STAT_POISONLENGTH = ElDur * 2` (frames at 25 fps)
  - Total unmitigated poison damage over the full duration = `(scaledEl * 10 * (ElDur * 2)) / 256` whole HP.

---

## 3. Poison Application (`SUNITDMG_ApplyPoison` `0x6FCFCAB0`) & Regen Ticking

1. **No Instant Poison Burst on Hit (`0x6FCFCAB0`, `0x6FCFE237`)**:
   - `dwPoisDamage` is mitigated by `STAT_POISONRESIST` (`45`, capped by `75 + STAT_MAXPOISONRESIST` `46`), `dwPoisLen` is scaled by `100 - STAT_ITEM_POISONLENGTHRESIST` (`110`, floor `-100%`, cap `75%`), and applied as `STATE_POISON` (`state 2`) setting `STAT_HPREGEN` (`74`) = `-poisonBitrate256` on the poison statlist.
   - `dwTotalDamage` subtracted instantaneously on impact includes physical + fire + lightning + cold + magic damage ONLY — **never** `poisonBitrate256 * poisonDurationFrames`.
   - Single-highest-bitrate rule (`0x6FCF6C60`): a new poison overwrites an existing poison on a target when no poison is active or `newBitrate256 >= currentBitrate256`.

2. **Player Poison Ticking (`PLAYER_UpdateHpRegen` `0x6FC97CB0`)**:
   - Sums `STAT_HPREGEN` (`74`, positive `item_replenish_life` / Prayer minus active `poisonBitrate256`) into `STAT_HITPOINTS` (`6`, `1/256` fixed-point) each frame.
   - `0x6FC97CFF`: `if (newHp256 < 0x100) newHp256 = 0x100` — **Poison on a player clamps at `256` (`1.0 HP`) and never kills a player directly**.

3. **Monster / Mercenary / Minion Poison Ticking (`MONSTER_Regen` `0x6FC96740`)**:
   - `0x6FC9675B..0x6FC9676E`: While `STATE_POISON` (`2`) is active, natural monster/hireling base `STAT_HPREGEN` is subtracted so natural regeneration is suppressed during poison.
   - `0x6FC967EC..0x6FC9680F`: In town (`DUNGEON_IsRoomInTown != 0`), negative `STAT_HPREGEN` will not drop a hireling/pet below `0x100` (`1 HP`); outside town, `newHp256 <= 0` kills the monster/minion (`0x6FC96964`).

---

## 4. `AITHINK_Fn022_GreaterMummy` (`0x6FCA8380`) & `#192 PrimePoisonNova`

- **`GreaterMummy` (`unraveler1..9`, `Radament` `hcIdx 229`, `Achmel` `hcIdx 568`)**:
  - `0x6FCA843A`: `cmp eax, 5; jge 0x6FCA8484` — `GreaterMummy` fires its `A2` poison breath missile (`MissA2 = mummy1..4` / `mummyex`) **only at close range (`distance < 5` sub-tiles)**.
  - At `distance >= 5`, `GreaterMummy` never uses `MissA2`; it heals injured allies, resurrects undead corpses, or casts `#157 UnHolyBolt` (`unholybolt1..4` magic projectile).
- **`#192 PrimePoisonNova`**:
  - Used by `radament` (`hcIdx 229`), `andariel`, and `mephisto` / `ubermephisto` (`#118 poisonnova`, `EType = pois`, `ELen = 100..450` frames). Must never be classified as an ally-healing skill in `tryCastMonsterUtilitySkill`.

---

## 5. Curative & Utility Potions (`Misc.txt` `yps`, `wms`, `vps`)

Per `Misc.txt` and `D2Game.dll` `ITEMS_UsePotion`:

| Code | Name | Cured States | Stacking Buff State (`+750` frames = 30s per potion) | Stat Modifiers |
| :--- | :--- | :--- | :--- | :--- |
| `yps` | Antidote Potion | `STATE_POISON` (`2`) | `STATE_ANTIDOTE` (`178`) on player & merc | `poisonresist +50`, `maxpoisonresist +10` |
| `wms` | Thawing Potion | `STATE_FREEZE` (`1`), `STATE_COLD` (`11`) | `STATE_THAWING` (`179`) on player & merc | `coldresist +50`, `maxcoldresist +10` |
| `vps` | Stamina Potion | Clears `staminaExhausted`, refills `staminaFixed` | `STATE_STAMINAPOT` (`180`) on player | `staminarecoverybonus +5000` |

---

## 6. Monster Mode Missile `slvl` (`MONMODE_SpawnModeMissile` `0x6FC95C60`) & `MonsterSkillBonus` (`0x6FCD019B`)

### 6.1 `Difficultylevels.txt` `MonsterSkillBonus` (`D2Common#10237` `+0x10`)
- `Patch_D2.mpq` `data\global\excel\Difficultylevels.txt` defines `MonsterSkillBonus = 0` (Normal), `3` (Nightmare), `7` (Hell), read from `D2DifficultyLevelsTxt` offset `+0x10` via `D2Common#10237` (`DATATBLS_GetDifficultyLevelsTxtRecord`).

### 6.2 `MONMODE_SpawnModeMissile` (`D2Game.dll` `0x6FC95C60..0x6FC95CD7`)
- When a monster fires a `MonStats.txt` mode projectile (`MissA1`, `MissA2`, `MissS1..S4`, `MissC`, `MissSQ`) without an active skill (`nSkillId = 0`):
  - `0x6FC95C96`: Tests `pMonster->dwFlags & 0x200` (`UNITFLAG_ISMERC`). Only hirelings use `D2Common#10519(pMonster, STAT_LEVEL, 0)` as `nSkillLevel`.
  - `0x6FC95CBC..0x6FC95CC7`: All non-hireling monsters compute `nSkillLevel = pDiff->dwMonsterSkillBonus + 1` (`1` in Normal, `4` in Nightmare, `8` in Hell), NEVER `monster.level` (`mlvl`).
  - Example: `slinger5` / `slinger6` (`Slayer` cat-potion throwers in Act 2 Rocky Waste / Dry Hills, `mlvl = 15..16`) throw `MissA1 = pantherpotorange` (`#238`, `MinDamage=3..5, MinLevDam1=5, EMin=2..5, MinELev1=7`) and `pantherpotgreen` (`#239`, `HitShift=1, EMin=9..12, MinELev1=6, ELen=400`). At Normal `slvl = 1`, `pantherpotorange` deals `3..5` phys + `2..5` fire (`5..10` total) and `pantherpotgreen` deals `18..24 / 256` HP/f × `400`f (`28..38` poison HP over 16s).

### 6.3 `MONSTER_InitSkills` (`D2Game.dll` `0x6FCD019B..0x6FCD0215`)
- Explicit `MonStats.txt` `Skill1..8` entries with `Sk1lvl..8lvl > 0` add `pDiff->dwMonsterSkillBonus` (`+0` Normal, `+3` Nightmare, `+7` Hell) when registering active/castable monster skills. Innate monster auras (`MONSTER_UpdateAura` `0x6FC95FD0`) scale from `mlvl` via `resolveInnateMonsterAura113c`.

### 6.4 `Missiles.txt` `ToHit` Auto-Hit Gate on Monster Projectiles
- Across all 734 `MonStats.txt` rows, weapon projectiles (`spike1..6`, `cr_arrow1..5`, `skbowarrow1..8`, `pantherjav1..5`, `blowgun`, `ancient throwing axe`, `trap spike`) have `Missiles.txt` `ToHit = 1` and roll Attack Rating vs Defense, whereas spell/potion mode projectiles (`pantherpotorange`, `pantherpotgreen`, `skmage1..4`, `impmiss21..25`, `arcanelightningbolt`, `tentaclegoo`, `viper_fire`, `viper_poisjav`, `willowisplightningbolt`, `mummy1..4`, `goospit1..5`, `bighead1..6`) have `ToHit = ''` (`0`) and auto-hit (`guaranteedHit = !missile.toHit`, matching why `MonStats.txt` leaves `A1TH` empty on those rows).

