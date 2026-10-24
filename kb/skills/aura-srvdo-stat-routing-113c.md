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

Implementation: `src/server/engine/aura-scanner.ts` (`pulseAura`), test
`tests/skills/aura-self-stats-1409.test.ts`.
