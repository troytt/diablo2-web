# 1.13c server aura functions: caster vs target stat routing

Source: `samples/d2/D2Game.dll` (image base 0x6FC20000), `samples/d2/excel/Skills.txt`.
SkillsTxt record offsets used below: `+0x50` aurafilter, `+0x54` aurastat[6] (word),
`+0x64` aurarangecalc, `+0x68` aurastatcalc[6], `+0x80` aurastate, `+0x82` auratargetstate,
`+0x94` passivestate, `+0x98` passivestat[5] (word), `+0xA4` passivecalc[5].

## SrvDo065 — friendly stat auras (0x6FCBA8D0)

- Evaluates `aurastat1..6` and applies them to the **caster** under `aurastate`
  (call 0x6FCBA1A0 at 0x6FCBAA52).
- Then `passivestat1..5` are written to the caster with 0x6FC2A6E2 only when
  `passivestate <= 0` (`cmp word [esi+0x94],0; jg skip`).
- Radial scan 0x6FCC0C70 (filter `+0x50`) applies `aurastat` to allies under
  `auratargetstate` with callback 0x6FCBA1A0.

## SrvDo066 (0x6FCBAF50) / SrvDo081 (0x6FCBABC0) — offensive auras

Rows: 066 = Holy Fire 102, Holy Shock 118, Sanctuary 119, Conviction 123; 081 = Holy Freeze 114.

- Caster: `aurastate` gets **only** `passivestat1..5` / `passivecalc1..5`
  (loop `cmp edi,5`, call 0x6FCBA1A0). E.g. Holy Freeze `coldmindam/coldmaxdam =
  enms*par5/256 / exms*par5/256`, Holy Fire `firemin/maxdam`, Holy Shock `lightmin/maxdam`.
  The caster **never** receives `aurastat` (so Holy Freeze does not slow its caster).
- Targets: `aurastat1..6` are evaluated only if `auratargetstate >= 0`
  (`cmp word [esi+0x82],0; jl skip`) and handed to the scan 0x6FCC0C70; callbacks
  0x6FCBA7C0 (066) / 0x6FCBA630 (081). The scan skips the caster itself.
- Holy Fire / Holy Shock / Sanctuary have empty `auratargetstate`, so their `aurastat`
  columns (e.g. Sanctuary `item_undeaddamage_percent`, `skill_bypass_undead`) are never
  applied by this function.
- Holy Freeze targets get exactly `velocitypercent/attackrate/other_animrate = -dm34`
  (Param3/4 = 25/60); there is no `item_slow`.
- For players, the stat calcs are skipped when `[esp+0x20] < [esp+0x1c]`, i.e. stat 8
  (`mana`, via 0x6FC2A42A) below the value from 0x6FC2AF58(skill, slvl) (presumably mana
  cost); mana is then drained via 0x6FCBED20 after the scan.

## Pulse period (`perdelay`) and frame-aligned state duration

SkillsTxt `+0x128` is `perdelay` (calc expression).

- **Lower-bound clamp (`>= 5` frames)**:
  - `SrvDo065` (`0x6FCBA955..0x6FCBA96C`), `SKILLS_GetNextPerDelayFrame` (`0x6FCBE970..0x6FCBE994`),
    and the periodic skill event schedulers (`0x6FCBF3B0`, `0x6FCC3120`) evaluate `perdelay` via
    `SKILLS_EvaluateSkillFormula` (`0x6FCBB190`) when non-negative and clamp the result with
    `cmp ecx, 5; jg ...; mov ecx, 5` (`d = max(5, eval(perdelay))`).
  - Skills with an empty `perdelay` column (`perdelay = -1` in `Skills.bin`), such as the Druid
    spirit totem auras `#296` (`Barbs Aura`), `#297` (`Wolverine Aura`), and `#298` (`Oak Sage Aura`),
    skip the formula evaluation (`0` -> clamped to `5`).
  - `#277` (`Blade Shield`, `SrvDo054` `0x6FCB34A0`) has `perdelay = par3` (`Param3 = 25`),
    evaluated via the same `+0x128` formula path rather than a hardcoded skill ID branch.
- **Global frame-aligned state duration**:
  - `SrvDo065` (`0x6FCBA973..0x6FCBA988`) reads `F = pGame->dwGameFrame` (`[pGame+0xA8]`) and computes:
    `duration = d * trunc((F + d - 1) / d) - F + 2` (i.e. `d * ceil(F / d) - F + 2` for `F >= 1`).
  - `SrvDo066` (`0x6FCBAFF8..0x6FCBB008`), `SrvDo081` (`0x6FCBAC5D..0x6FCBAC6B`), and `SrvDo082`
    (`0x6FCBA46C..0x6FCBA47E`) call `0x6FCBE970` (`nextFrame = d * trunc((F + d - 1) / d) + 1`)
    and compute `nextFrame + 1 - F`, yielding the identical duration `d * trunc((F + d - 1) / d) - F + 2`.

- **Activation pulse gate (`Skills.txt` `immediate` at `0x6FCC1D9C..0x6FCC1E72` & `0x6FCCDBC8..0x6FCCDBE9`)**:
  - When `D2GAME_AssignSkill` (`0x6FCC2100`) activates a right-hand aura via `0x6FCC1D10`, it checks `SkillsTxt` flag `immediate` (`[ebx+0x05] & [0x6FD18BE0+0x1C]`):
    - `immediate = 1` (`#98, #100, #104, #105, #108, #110, #113, #115, #122, #125`): immediately invokes `0x6FCC19A0` (`SrvDo065`) on the `SelectSkill` frame and schedules `EVENTTYPE_PERIODICSKILLS` via `0x6FCBF3B0`.
    - `immediate = 0` (`#99, #102, #103 Thorns, #109, #114, #118, #119, #120, #123, #124, #296..#298`): toggles `aurastate` (`0x6FCC1DDE`) with only `STAT_MODIFIERLIST_SKILL (350)` / `LEVEL (351)` and defers the first `SrvDo` pulse until `nextFrame = d * trunc((F + d - 1) / d) + 1` (`0x6FCBF3B0`).

Implementation: `src/server/engine/aura-scanner.ts` (`setActiveAura`, `pulseAura`, `tick`), tests
`tests/skills/aura-self-stats-1409.test.ts`, `tests/skills/aura-perdelay-duration-1443.test.ts`, `tests/skills/aura-mana-nomanaregen-1444.test.ts`.

## Pulse Mana Cost & `STATE_NOMANAREGEN` (`85`) Toggle

- **`D2Common.dll` ordinal 10090 (`0x6FD9EA00`, called via `0x6FC2AF58` in `D2Game.dll`)**:
  Computes per-pulse mana cost in `1/256` fixed-point units from `Skills.txt` columns `mana` (`wMana` at `+0x18A`),
  `lvlmana` (`wLvlMana` at `+0x18C`), and `manashift` (`nManaShift` at `+0x188`):
  `manaCost256 = (mana + lvlmana * (slvl - 1)) << manashift`.
  - `#99` Prayer (`mana=16, lvlmana=3, manashift=4`): `(16 + 3 * (slvl - 1)) << 4` (`256` at `slvl=1`, `1168` at `slvl=20`).
  - `#119` Sanctuary (`mana=1, lvlmana=0, manashift=8`): `(1 + 0 * (slvl - 1)) << 8 = 256`.
  - All other `aura=1` skills (`#98, #100, #102..#105, #108..#110, #113..#115, #118, #120, #122..#125, #296..#298`) have `mana=0, lvlmana=0` (`0` mana cost).
- **Insufficient mana gate (`SKILLS_SrvDo065` `0x6FCBA99F..0x6FCBA9B0`, `SKILLS_SrvDo066` `0x6FCBB063..0x6FCBB072`)**:
  When `pUnit->dwUnitType == UNIT_PLAYER (0)` and `curMana256 < manaCost256`, `aurastat1..6` evaluation (including Prayer's `hitpoints` heal) is skipped (`0x6FCBA9AC: cmp [esp+0x20], edi; jl 0x6FCBAA03`). The aura state itself remains active on the caster.
- **Healed/affected target count (`SKILLS_AuraCallback_BasicAura` `0x6FCBA357..0x6FCBA36E`)**:
  For `direct=1` `STAT_HITPOINTS` (`#6`), `args.field_40` (`[esp+0x74]` in `SrvDo065`) is incremented (`0x6FCBA36B: inc DWORD PTR [eax+0x40]`) only when `newHp > curHp` (`0x6FCBA357: cmp ebx, [esp+0x24]; je 0x6FCBA36E`).
- **End-of-pulse mana deduction & `STATE_NOMANAREGEN` (`85`) (`SKILLS_SrvDo065` `0x6FCBAB66..0x6FCBABA7`, `SKILLS_SrvDo066` `0x6FCBB26F..0x6FCBB2B7`, `0x6FCBED20`)**:
  Only when `manaCost256 > 0 && pUnit != NULL && pUnit->dwUnitType == UNIT_PLAYER (0)`:
  - If `activeUnitsCount > 0` (`healedCount > 0` for Prayer `#99`; `enemiesAffected > 0` for Sanctuary `#119`): calls `STATES_ToggleState(pUnit, 85, 1)` (`0x6FCBAB80`) and `0x6FCBED20(pUnit, manaCost256)` (`0x6FCBAB89`).
  - Else (`activeUnitsCount <= 0`): calls `STATES_ToggleState(pUnit, 85, 0)` (`0x6FCBABA2`) and deducts `0` mana.
  - Non-player casters (`dwUnitType != 0`: monsters, mercenaries, pets) skip mana checks, mana deduction, and `STATE_NOMANAREGEN` (`85`).
