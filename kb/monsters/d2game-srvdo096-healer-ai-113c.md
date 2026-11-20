# D2Game.dll 1.13c Monster Healer Skills (`#179`, `#182`, `#291`) & AI Think Gates

## Binary Provenance
- Binary: `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`)
- Data tables: `Skills.txt` (`#179 ZakarumHeal`, `#182 Bestow`, `#291 Healing Vortex`, `#295 Overseer Whip`), `Missiles.txt` (`#425 healing vortex`), `MonStats.txt`, `MonAI.txt`

## 1. `SKILLS_SrvDo096_ZakarumHeal_Bestow` (`0x6FCD3770..0x6FCD3887`)

`Skills.txt` assigns `srvdofunc = 96` to `#179 ZakarumHeal` and `#182 Bestow`.

- **Self-heal prohibition (`0x6FCD37B9`)**:
  - `cmp ebp, edi` (`pTarget == pCaster`) -> `je 0x6fcd37c1` (return `0`).
  - No monster healer in 1.13c can ever target itself with `#179 ZakarumHeal` or `#182 Bestow` (including Radament `hcIdx 229`, Achmel `hcIdx 367`, Council Members `hcIdx 345..347`, Bartuc, Zakarum Priests, Unravelers, and Oblivion Knights).
- **Prevent Monster Heal (`0x6FCD37BD`)**:
  - Checks state `52` (`STAT_PREVENTHEAL` / `STATE_PREVENTHEAL`) on `pTarget`; skips healing when active.
- **`#179 ZakarumHeal` percentage formula (`0x6FCD37DE..0x6FCD3857`)**:
  - Evaluates `Skills.txt` `calc1 = min(50, 15 + 5 * slvl)` and `calc2 = 50`.
  - Rolls uniform integer percentage `pct` in `[calc1, calc2]` and restores `trunc(maxHp * pct / 100)` HP capped at `maxHp`.

## 2. Per-AI Healer Think Gates (`D2Game.dll`)

| `MonAI` | Think Function | Ally Search Helper | Melee Priority | Ally Eligibility & Range | HP Threshold | RNG Gate & Cooldown |
| --- | --- | --- | --- | --- | --- | --- |
| `GreaterMummy` | `0x6FCA8380` (`Fn051`) | `0x6FC9B8E0` | Checks `bInMeleeRange` first (`A1` melee before heal/resurrect) | Undead allies (`!= self`), non-Unique unless Radament (`hcIdx 229`, who gets `+10` subtile scan bonus on `aip5 = 24`) | `hp < maxHp` | `rand(100) < aip3` (`40 / 45 / 55%`) |
| `HighPriest` | `0x6FC39080` (`Fn085`) | `0x6FC35660` | Checks `bInMeleeRange` first (`0x6FC390BB`: `A1`/`A2` melee only when in melee range; never casts `#179` or `#62` in melee) | Non-self combatant allies (`!= self`, non-turret/construct) within `50` subtiles (`0x9C4 = 2500` at `0x6FC391DD`) | Integer HP% `< 75` (`ctx.nBestLifePct = 0x4B` at `0x6FC391D5`, `cmp eax, [esi+0x4]; jge skip` at `0x6FC356AB` via `D2Common.#11027`) | Single roll per `aidel` tick: `rand(100) < aip2` (`25 / 30 / 20%` Normal, `15%` Hell / `25%` Bartuc); shared `dwSpellTimer` = `dwGameFrame + aip3` (`125 / 100 / 75` frames) at `0x6FC3920B` |
| `ZakarumPriest` | `0x6FCA7E60` (`Fn050`) | `0x6FC9BC70` | Evaluates retreat/melee vs heal | Non-self combatant allies within `aip6` | Integer HP% `<= 60` | Single roll per `aidel` tick: `rand(100) < 25` (`25%`) |
| `OblivionKnight` | `0x6FCA4DB0` (`Fn060`) | `0x6FC9BA40` | Evaluates melee/curse vs heal | Non-self combatant allies within `aip8` | Integer HP% `< 40` | Single roll per `aidel` tick: `rand(100) < aip5` (`65%`) and `rand(100) < aip6` (`30%`) |
| `FetishShaman` | `0x6FCA7BB0` (`Fn053`) | None | N/A | **No heal branch** (`aip5 = 50` is corpse resurrect scan radius) | N/A | N/A |
| `Overseer` | `0x6FC37CB0` (`Fn120`) | `0x6FC37F60..0x6FC3802A` | Evaluates `#295 Overseer Whip` first, then `#291 Healing Vortex` | Non-self combatant allies within `20` subtiles (`20^2 = 400`), `!state 52` | `hp <= 50% maxHp` (`0x32`) | `rand(100) < aip2` (`50%`), casts `#291` (`S2`), spawns visual `Missiles.txt #425 healing vortex`, heals `10 + 5*(slvl-1) .. 20 + 5*(slvl-1)` HP |

## 3. `HighPriest` `#62 Hydra` AI Think Gates (`0x6FC39230..0x6FC392EA`) & `#337 HydraMissile` (`0x6FC63D40`)

- **Out-of-melee & shared `dwSpellTimer` gate (`0x6FC390BB`, `0x6FC39242..0x6FC3924B`)**:
  - `0x6FC390BB` (`test ecx, ecx; je 0x6fc39186`) enters the spell-casting block (`Skill2 = ZakarumHeal`, then `Skill1 = Hydra`) **only when `bInMeleeRange == 0`**. When `bInMeleeRange != 0`, `HighPriest` never casts `#179` or `#62`.
  - Both `#179 ZakarumHeal` and `#62 Hydra` share `pAiControl->dwSpellTimer` (`[eax+0x18]`). If `#62 Hydra` does not fire (or `candidates.length === 0`), execution proceeds to approach/kite movement (`0x6FC392ED`) and **never** falls back to an unrolled `#179 ZakarumHeal` cast.
- **Target distance & `aip4` probability gates (`0x6FC39251..0x6FC3927E`)**:
  - `0x6FC39255` (`movsx eax, WORD PTR [ebx+edx*2+0x80]`): reads `MonStats.bin` `+0x80` = `aip8[difficulty]` (`0x56 + 7 * 6 = 0x80`, `'range'`), requiring `nTargetDist < aip8` (`30` subtiles on `councilmember1..3` `#345..347` and `baalhighpriest` `#557`). Note that `+0x7a` (`aip7 = 15 / 13 / 12`) is `'ltng engaged?'` (`0x6FC39408` / `0x6FC39559`), not Hydra cast range.
  - `0x6FC3926E..0x6FC3927E`: requires `rand(100) < aip4` (`40 / 35 / 45%` in Normal, `45 / 40 / 50%` in Nightmare/Hell).
- **Hydra spell cooldown & skill level propagation (`0x6FC392DF`, `0x6FC63F1C`)**:
  - `0x6FC392DF` (`add ecx, 0x64`): sets `pAiControl->dwSpellTimer = dwGameFrame + 100` (`100` frames = `4.0s`).
  - `SKILLS_SrvDo144_Hydra` (`0x6FC63F1C`) propagates the caster's resolved `#62 Hydra` `slvl` (`Sk1lvl + MonsterSkillBonus`, never double-adding `MonsterSkillBonus`) to the summoned `hydra1..3` turret (`MonStats.txt #351..353`, `Align = 1`, `neverCount = 1`).
  - `Missiles.txt #247 hydra` links `Skill = Hydra` (`Skills.txt #62`, `HitShift = 7` = `128/256`, `EMin = 28, EMinLev1..5 = 11, 15, 19, 23, 27`, `EMax = 39, EMaxLev1..5 = 13, 17, 21, 25, 29`, `SrcDamage = 0`).
- **No Uncapped Utility Summon/Blink Fallback (`#60`, `#62`, `#167`, `#210`, `#302`, `#330`)**:
  - Dedicated summon/armor/blink skills (`#62 Hydra` cap 3, `#167 Nest` cap `8 + 2*diff`, `#302 MinionSpawner` cap 6, `#330 Imp Teleport` `distance <= 6` escape on Nihlathak, `#60 Chilling Armor` state `20`, `#210 MonBoneArmor` state `14`) must never fall through to generic `skill.summon !== ''` / `/teleport/` / `skill.state1 !== ''` utility casting when their 1.13c cap, range, or state gate rejects them.

## 4. Why `HighPriest` `MONMODE_SKILL1` Never Spawns `#343 highpriestlightning` & `RangedType = 0` Mode-Missile Sweep (`0x6FC94F20`, `0x6FC95CE0..0x6FC95E0D`, `D2Common.#10853`)

- **`HighPriest` `MONMODE_SKILL1` (`mode 8`) moveable-mode quirk**:
  - When `AITHINK_Fn085_HighPriest` (`0x6FC39562..0x6FC3956D`) transitions into `MONMODE_SKILL1` (`mode 8`) without an active `pSkill`, `MONMODE_InitParams` (`0x6FC95070`) calls `MONMODE_IsMoveableMode(pMonster, 8)` (`0x6FC94F20`).
  - For `mode 8`, `MONMODE_IsMoveableMode` reads `MonStats2.txt` `mS1` (`BYTE PTR [pMonStats2Txt + 0x105]`, `mSm` in `MonStats.txt`). On `councilmember1..3` (`#345..347`) and `baalhighpriest` (`#557`), `mS1 = 1`, so `MONMODE_IsMoveableMode` returns `1`.
  - In `MONMODE_ExecuteEvent` (`0x6FC95D78..0x6FC95E0D`), `bMoveable == 1` skips the non-moveable dispatch (`0x6FC95DBE`), advances path/animation via `D2Common.#10853` (`0x6FD82460`), and checks `cmp BYTE PTR [esi+0x4e], 1; je 0x6fc95dbe` at `0x6FC95DFE`.
  - `AnimData.d2` `HPS1HTH` defines `events = [{ frame: 3, code: 2 }]` (`code == 2` missile event, not `1`), so `D2Common.#10853` (`0x6FD82517..0x6FD8251E`) writes `BYTE PTR [esi+0x4e] = 2`. Consequently `[esi+0x4e] != 1` and `MONMODE_SpawnModeMissile` (`0x6FC95C60`, `wMissS1 = #343 highpriestlightning`) is never invoked in vanilla 1.13c.
- **Full 734-row `RangedType = 0` `modeMissiles` sweep**:
  - `isRanged` for generic `F12.3` mode-missile basic attacks must derive strictly from `MonStats.txt` `RangedType = 1` or `MonAI` `profile.ranged = true`, never from a blanket `MissA1..MissS1` check:
    - `councilmember1..3` (`#345..347`) & `baalhighpriest` (`#557`, `ai = HighPriest`, `RangedType = 0`, `MissS1 = highpriestlightning`): melee + `#179 ZakarumHeal` + `#62 Hydra` only.
    - `venomlord` (`#558`, `ai = Megademon`, `RangedType = 0`, `MissS1 = infernoflame1`): melee + `#319 MegademonInferno`, never 35-subtile `infernoflame1` sniping.
    - `regurgitator1..4` (`#307..309, #694`, `ai = Regurgitator`, `RangedType = 0`, `MissA2 = regurgitatorcorpse`): melee unless `corpseAmmo > 0` after `#214 RegurgitatorEat` (`#213 CorpseSpit`).
    - `maggotqueen1..5` (`#284..288`, `ai = SandMaggotQueen`, `RangedType = 0`, `MissA2 = goospit1..5`): stationary `#163 MagottLay` egg-layers, never ranged shooters.

## 5. `AIGENERAL_Think` `nTargetMode = 1` Gate (`0x6FCBD3B0..0x6FCBD4F3`) & `D2Common.#10666` / `#10830` Ally Alignment Filter

- **Hostile target acquisition gate before `pfnAiThink` (`0x6FCBD494 -> 0x6FCBD160 -> 0x6FD13220`)**:
  - `AIGENERAL_Think` (`0x6FCBD3B0`) looks up the monster's `MonAI` row in `g_MonAiTable` (`0x6FD2E788`, `148` rows `0x00..0x93`, `0x10` bytes per entry: `+0x04 pfnAiThink`, `+0x08 pfnAiInit`, `+0x0C nTargetMode`).
  - Across all `148` rows, every hostile combat, healer, shaman, resurrector, Overseer, and boss AI (`104` rows total — including `FallenShaman` `#5/#13`, `GreaterMummy` `#22`, `ZakarumPriest` `#36`, `FetishShaman` `#53`, `BloodRaven` `#59`, `HighPriest` `#85`, `OblivionKnight` `#88`, `Overseer` `#120`) uses `nTargetMode = 1`.
  - At `0x6FCBD494` (`call 0x6FCBD160`), `nTargetMode = 1` invokes `0x6FD13220` (`AI_FindHostileTarget`). When `pTarget == NULL`, `0x6FCBD19F` (`sete %dl`) returns `1` and `0x6FCBD49B` (`test %eax, %eax; jne 0x6FCBD4EC`) returns immediately without invoking `call *0x4(%eax)` (`pfnAiThink` at `0x6FCBD4E9`).
  - Consequently, an unawakened `HighPriest` (`aidist = 18` on `councilmember1..3`), `ZakarumPriest`, `GreaterMummy`, `OblivionKnight`, `FallenShaman`, `FetishShaman`, or `BloodRaven` with no hostile player/mercenary/summon inside `aidist` (and no active `threatUntilFrame` from being attacked) never heals wounded allies (`50`-subtile `HighPriest` heal scan) or raises corpses across dungeon rooms/walls.
- **Ally alignment & Mind-Blast/Conversion filter (`D2Common.#10666` `0x6FDD4D30` `UNITS_AreUnitsAllied` & `D2Common.#10830` `0x6FD891F0` `UNITS_GetAlignment`)**:
  - Monster ally-support callbacks (`0x6FC35660..0x6FC356B9`, `0x6FC9FB30`, `0x6FCC4D00`, `0x6FC37F60`) verify `D2Common.#10648(pAlly) == 0` (`!dead`), `D2Common.#10666(pCaster, pAlly) != 0` (`UNITS_AreUnitsAllied`), and `D2Common.#10830(pAlly) == 0` (`ALIGN_EVIL`, not converted to `ALIGN_GOOD` `2` via `STATE_CONVERSION` `53` or friendly `NpcBarb` `Align = 1`).
  - Evil monster support/buff/heal/whip/impregnate scans (`#179 ZakarumHeal`, `#182 Bestow`, `#291 Healing Vortex`, `#290 Cry Help`, `#295 Overseer Whip`, `#300/#316 Impregnate`, and `#541 Madawc` `#138 Shout`) must reject both `ally.align !== monster.align` (`NpcBarb` `#522..523`, player summons) and `isMonsterConverted(ally)` (`state 53`).
