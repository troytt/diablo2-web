# 1.13c `Skills.txt` `startmana`, `usemanaondo`, and `nocostinstate` Mechanics

## 1. Binary & Table Ground Truth (`samples/d2/D2Common.dll`, `samples/d2/D2Game.dll`, `samples/d2/excel/Skills.txt`)

### 1.1 `D2SkillsTxt` Field Layout (`D2Common.dll` `0x6FDB51DB..0x6FDB5287`)
- `wStartMana`: `WORD` at `+0x184` (`Skills.txt` `startmana` column)
- `wMinMana`: `WORD` at `+0x186` (`Skills.txt` `minmana` column)
- `nManaShift`: `BYTE` at `+0x188` (`Skills.txt` `manashift` column)
- `wMana`: `WORD` at `+0x18A` (`Skills.txt` `mana` column)
- `wLvlMana`: `WORD` at `+0x18C` (`Skills.txt` `lvlmana` column)
- `usemanaondo`: bit `37` (`0x25`) of `dwFlags` (`BYTE [+0x08] & 0x20`, `Skills.txt` `usemanaondo` column)
- `nocostinstate`: `Skills.txt` `nocostinstate` column (enforced on `wSrvDoFunc == 116` at `D2Common.dll` `0x6FDA0BEB` and `D2Game.dll` `0x6FCBECEF` / `0x6FC66210`)

### 1.2 Complete `Skills.txt` Sweep (6 Rows Across All 305 Rows)

| Id | Skill | Class | `srvstfunc` | `srvdofunc` | `startmana` | `minmana` | `manashift` | `mana` | `lvlmana` | `usemanaondo` | `nocostinstate` | `aurastate` |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 25 | `Plague Javelin` | `ama` | 4 | 0 (→68) | 0 | 1 | 7 | 14 | 1 | `1` | 0 | — |
| 41 | `Inferno` | `sor` | 11 | 19 | `6` | 0 | 2 | 36 | 1 | 0 | 0 | — |
| 223 | `Wearwolf` | `dru` | 0 | 116 | 0 | 1 | 8 | 15 | 0 | 0 | `1` | `wolf` (139) |
| 228 | `Wearbear` | `dru` | 0 | 116 | 0 | 1 | 8 | 15 | 0 | 0 | `1` | `bear` (140) |
| 230 | `Arctic Blast` | `dru` | 11 | 19 | `6` | 0 | 2 | 24 | 1 | 0 | 0 | — |
| 266 | `Blade Fury` | `ass` | 26 | 48 | `6` | 0 | 5 | 8 | 1 | `1` | 0 | — |

---

## 2. `startmana` (`D2Common.dll` `0x6FD9FDC0`, `D2Game.dll` `0x6FC64550` & `0x6FCB5BC0`)

- **`D2Common.dll` `SKILLS_CheckStartMana` (`0x6FD9FDC0`)** (called from `SKILLS_CanUnitUseSkill` `#10787` @ `0x6FDA2448`):
  - For player units (`dwUnitType == 0`), if `wStartMana > 0` (`+0x184`) and `!STATES_CheckState(pUnit, STATE_INFERNO=12)` (`0x6FD9FE50`), checks `STATLIST_UnitGetStatValue(pUnit, STAT_MANA=8, 0) >= (wStartMana << 8)`.
- **`D2Game.dll` `SkillSrvStFunc[11]` (`0x6FC64550`, `Inferno` #41 / `Arctic Blast` #230) & `SkillSrvDoFunc[19]` (`0x6FC64390` -> `0x6FC643F0`)**:
  - At start (`0x6FC6459F`), checks `STATES_CheckState(pUnit, STATE_INFERNO=12)`. If not in state `12`, requires `STAT_MANA >= (wStartMana << 8)` (`6 << 8 = 1536`).
  - Helper `0x6FC643F0` applies `STATE_INFERNO` (`12`) for `20` frames on initial entry (extended by `+6` frames per channeling tick) and allows continued channeling below `startmana << 8` as long as `STAT_MANA >= manaCost256` (`144` at slvl 1 for `Inferno`, `96` at slvl 1 for `Arctic Blast`). When `STAT_MANA < manaCost256`, clears `STATE_INFERNO` (`12`) and terminates channeling.
- **`D2Game.dll` `SkillSrvStFunc[26]` (`0x6FCB5BC0`, `Blade Fury` #266) & `SkillSrvDoFunc[48]` (`0x6FCB5560`)**:
  - Checks `STATES_CheckState(pUnit, STATE_INFERNO=12)`. If not in state `12` and `wStartMana > 0`, requires `STAT_MANA >= (wStartMana << 8)` (`6 << 8 = 1536`) and sets `STATE_INFERNO` (`12`) for `21` frames (extended by `+7` frames per loop tick at `0x6FCB5D55`, firing `SkillSrvDoFunc[48]` @ `0x6FCB5D21` and `SKILLS_ConsumeMana` @ `0x6FCB5D36`).

---

## 3. `usemanaondo` (`D2Game.dll` `0x6FCBFD00` & `0x6FCC19A0`)

- **`SKILLS_DoSkillStart` (`0x6FCBFD00`)**:
  - After `gpSkillSrvStFnTable[wSrvStFunc]` succeeds (`0x6FCBFE5C`), tests `usemanaondo` (`bit 0x25` at `0x6FCBFE6C`).
  - Only calls `SKILLS_ConsumeMana` (`0x6FCBF850`) at start when `wSrvStFunc > 0` AND `usemanaondo == 0`.
  - When `usemanaondo == 1` (`Plague Javelin` #25, `Blade Fury` #266), no mana is consumed during `SKILLS_DoSkillStart`.
  - TS: `schedulePlayerSkillWindup113c` (`player-skills-target-and-melee.ts`) commits the cast at start when
    `srvStFunc > 0 && !useManaOnDo` (`manaCommittedOnStart`). Oracle `p52-necromancer-curses`: Raise Skeleton
    (`srvstfunc` 15) pays its mana on the cast-start frame F1510, not on the action frame. The TS check does not
    model a failing `srvstfunc` (then the original pays nothing at start).
- **`SKILLS_DoSkillDo` (`0x6FCC19A0`)**:
  - At `0x6FCC1AE5`, when `usemanaondo == 1`, calls `SKILLS_CheckSkillMana` (`0x6FCBEC80`) before invoking `gpSkillSrvDoFnTable[wSrvDoFunc]`, aborting if mana fell below `manaCost256` during wind-up.
  - At `0x6FCC1C5F..0x6FCC1C8A`, after `gpSkillSrvDoFnTable[wSrvDoFunc]` returns non-zero, calls `SKILLS_ConsumeMana` (`0x6FCBF850`) when `gpSkillSrvStFnTable[wSrvStFunc] == NULL` (`wSrvStFunc == 0`) OR `usemanaondo == 1`.

---

## 4. `nocostinstate` (`D2Common.dll` `0x6FDA0AF0`, `D2Game.dll` `0x6FCBEC80` & `0x6FC66210`)

- **`D2Common.dll` `SKILLS_CheckSkillMana` (`0x6FDA0AF0` @ `0x6FDA0BEB`) & `D2Game.dll` `SKILLS_CheckSkillMana` (`0x6FCBEC80` @ `0x6FCBECEF`)**:
  - When `wSrvDoFunc == 116` (`0x74`: `Wearwolf` #223, `Wearbear` #228) and `UNITS_IsShapeshifted(pUnit)` (`D2Common #10683` @ `0x6FD83B80`), returns `1` immediately, waiving the `STAT_MANA >= manaCost256` gate.
- **`D2Game.dll` `SKILLS_SrvDo116_Wearwolf_Wearbear` (`0x6FC66210`)**:
  - Calls `sub_6FCBEA30(pUnit, wAuraState, 1)` to clear `States.txt` `group = 3` states (`wolf` 139, `bear` 140, `feralrage` 120, `maul` 117) and clamp `STAT_HITPOINTS >= 256` (`1` HP survival floor).
  - If `pUnit` was already in `wAuraState` (`wolf` 139 for `Wearwolf` #223, `bear` 140 for `Wearbear` #228), sets skill delay and returns `0` (`0x6FC662C6`) so `SKILLS_DoSkillDo` (`0x6FCC1C5B`) skips `SKILLS_ConsumeMana` (`0` mana spent on unmorph).
  - If `pUnit` was in human form, applies `wAuraState` and returns `1`, so `SKILLS_DoSkillDo` calls `SKILLS_ConsumeMana` (`15 << 8 = 3840` mana spent).
