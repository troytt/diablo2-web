# P5.5 Statistical Fallback (temporary)

`tools/oracle/lib/stat-tests.ts` (two-sample Kolmogorov–Smirnov, chi-square homogeneity) compares
**distributions** of probabilistic outcomes between the original game and the TS server when the
individual RNG draws cannot be aligned yet. Tests: `tests/oracle/stat-tests.test.ts`.

> [!IMPORTANT]
> A statistical pass is **not** parity. The acceptance criterion for every mechanic remains
> frame-exact agreement in `tools/oracle/diff.ts` (including unit seed columns). Each use of this
> fallback must be listed below together with the RNG-alignment work item that retires it.

## Usage rules

1. Collect ≥ 10⁵ samples per side (e.g. `dmg[].raw` rolls from many oracle runs with different
   `-seed`, versus the replica over the same seeds/scenarios).
2. Continuous/ordinal outcomes (damage rolls, durations): `ksTwoSample`; categorical outcomes
   (hit/miss, crit, block, dodge, drop quality): `chiSquareHomogeneity`.
3. Fail threshold: `p < 0.001`. Report statistic, p, n, m.
4. Register the use in the table below **in the same change**.

## Why it is needed today

Per-unit `D2SeedStrc` streams (`src/server/engine/game-instance/unit-seeds-113c.ts`,
`D2Common.#10920` `SEED_InitLowSeed` + `D2Game` `SUNIT_AllocUnitData`) and Town `AI_Npc`
(`0x6FC3DB40`) are now aligned frame-by-frame through frame 65 in town scenarios, while hostile
wild-area combat scenarios (`a1-blood-moor-combat` etc.) still diverge at monster AI state-machine
decisions before individual `SUnitDmg` melee/missile rolls can be compared draw-for-draw in
`tools/oracle/diff.ts`. Until hostile AI decision timing and per-unit `SUnitDmg` draw order match
frame-exactly, `tests/oracle/stat-tests.test.ts` guards the `executeSUnitDmg` continuous damage
roll and categorical hit/block/crit distributions at `N = 100,000` (`>= 10^5`) samples per side.

## Registry (fallback uses → retirement work item)

| Mechanic | Test | Retired by |
|---|---|---|
| `SUnitDmg` melee physical damage roll + `%ED` + CS/DS + physical resist (`0x6FCFE011` / `0x6FCFD5C2` / `0x6FCFD51A` / `0x6FCFB3C0`) | `tests/oracle/stat-tests.test.ts` (`ksTwoSample`, `n = m = 100,000`, `p >= 0.001`) | Align hostile monster AI decision state machine (`AI_General` / `MonAI` tables) and `SUnitDmg` per-unit `D2SeedStrc` draw order (`kb/combat/d2game-sunitdmg-rng-rolls-113c.md`) so `tools/oracle/diff.ts` compares `dmg[]` and `seedLo`/`seedHi` columns frame-exactly. |
| `SUnitDmg` melee categorical outcome table (`miss` / `block` / `normal` / `crit`, `0x6FCFE011` / `0x6FCFB7A0` / `0x6FCFD51A`) | `tests/oracle/stat-tests.test.ts` (`chiSquareHomogeneity`, `n = m = 100,000`, `dof = 3`, `p >= 0.001`) | Same: retire once wild-area combat scenarios reach frame-exact `dmg[]` + `seedLo`/`seedHi` agreement in `tools/oracle/diff.ts`. |
