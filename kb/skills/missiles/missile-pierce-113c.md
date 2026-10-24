# Missile pierce: `pierce_idx` (1.13c)

Sources: `samples/d2/D2Game.dll` (image base `0x6FC20000`), `samples/d2/D2Common.dll` (`0x6FD50000`),
`samples/d2/excel/Missiles.txt`, `samples/d2/excel/Skills.txt`, ItemStatCost (`item_pierce` 156, `skill_pierce` 166,
`pierce_idx` 328). Implemented in `src/server/engine/missile-pierce.ts` (Issue #1420).

## Creation roll — `0x6FC8F660` (called at `0x6FC8FE59` by missile creation)

```
owner type must be 0 (player) or 1 (monster); missile type 3
test [MissilesTxt+4], PierceMask          ; Missiles.txt `Pierce` column
total = GetStat(owner, 156) + GetStat(owner, 166)   ; je -> no roll when 0
SEED_InitLowSeed(&seed, GetUnitBaseStat(owner, 328)) ; D2Common #10587 / #10614 -> { lo, hi = 0x29A }
for (n = 0; n < 4; ++n) if ((SEED_Rand(&seed) % 100) >= total) break   ; signed cmp
SetUnitStat(missile, 328, n)              ; D2Common #10887
```

`SEED_Rand`: `lo:hi = lo * 0x6AC690C5 + hi` (`0x6FC8F6F8..0x6FC8F70E`), result `lo % 100`.

## Owner `pierce_idx` = attack counter

The attack-sequence starters (`0x6FCEE520`, `0x6FCEE5A0` and siblings through `0x6FCEEA20`) execute
`SetUnitStat(unit, 328, GetUnitBaseStat(unit, 328) + 1)` before starting an attack. All missiles of one attack therefore
share one seed; consecutive attacks roll differently. The server mirrors this with `advanceUnitPierceSeed` once per
skill execution (`src/server/skills/registry.ts`).

## Hit consumption — `0x6FC58F40` (called at `0x6FC5EF2A` by unit collision `0x6FC5EDE0`)

- The collision handler only calls it if the row has `Pierce` and the owner currently has non-zero `skill_pierce`
  (`0x6FC5EF09`) or `item_pierce` (`0x6FC5EF19`).
- `pierce_idx > 0` -> `pierce_idx - 1`, returns 2 (keep flying); else returns 3 (CollideKill decides).

## Data facts

- `Pierce` is only a permission flag: e.g. `arrow`, `javelin`, `magicarrow`, monster `skbowarrow*`, `cr_arrow*`,
  `pantherjav*` have `Pierce=1 CollideKill=1`. Without owner pierce stats they die on the first hit.
- `guidedarrow` has `Pierce` empty -> never pierces.
- `lightningbolt`, `bonespear`, `shockwave` have `Pierce` empty and `CollideKill` empty: they are never removed by a
  unit hit; this is unrelated to pierce. `blessedhammer` has `Pierce=1` but `CollideKill` empty.
- Skills.txt `Pierce` (#33): `passivestat1 = skill_pierce`, `passivecalc1 = dm12`, `Param1 = 10`, `Param2 = 100`.
