# D2Game 有效抗性解析 (0x6FCFB3C0) — 1.13c

Source: `samples/d2/D2Game.dll` (image base 0x6FC20000), `samples/d2/D2Common.dll`
(0x6FD50000), `DifficultyLevels.txt` / `Properties.txt` / `ItemStatCost.txt` from
`Patch_D2.mpq`. Server implementation: `src/server/engine/combat-pipeline.ts`
(`computeEffectiveResistance`, `defenderResistParams113c`) and
`src/server/engine/difficulty-resist-penalty.ts`.

## Call chain

`0x6FCFC0B0` (damage application) builds a context on the stack, then loops 12
resistance descriptors at `0x6FD22AB0` (stride 0x2C) via `0x6FCFBD00`, which calls
`0x6FCFB3C0` (`ebx` = descriptor, `edi` = context) for every non-zero damage field.

Context (`edi`):

| Offset | Meaning |
| --- | --- |
| +0x00 | game (`[game+0x70]` expansion flag, `[game+0x6D]` difficulty byte) |
| +0x04 | `DifficultyLevels.txt` record (offset 0 = `ResistPenalty`) |
| +0x08 | attacker unit |
| +0x0C | defender unit |
| +0x10 | attacker is a non-hireling monster |
| +0x14 | defender is a non-hireling monster |

`+0x14` is set at 0x6FCFC10A..0x6FCFC121: `type == UNIT_MONSTER` **and**
D2Common #11104 (RVA 0x1A2D0, hireling type: `hcIdx` 271→1, 338→2, 359→3,
560/561→4, else 0) returns 0. Hirelings therefore resolve like players; player
summons (Valkyrie, golems, …) are ordinary monsters here.

## Descriptor table (first fields)

| # | dmg offset | res stat | max stat | pierce stat |
| --- | --- | --- | --- | --- |
| 0 | 0x08 phys | 36 `damageresist` | -1 | -1 |
| 1 | 0x10 fire | 39 `fireresist` | 40 | 333 `passive_fire_pierce` |
| 2 | 0x1C ltng | 41 `lightresist` | 42 | 334 `passive_ltng_pierce` |
| 3 | 0x24 cold | 43 `coldresist` | 44 | 335 `passive_cold_pierce` |
| 4 | 0x20 magic | 37 `magicresist` | 38 `maxmagicresist` | -1 |
| 5,6 | 0x30 / 0x34 (cold length / freeze) | 43 | 44 | 335 |
| 7 | 0x2C poison length | 110 `item_poisonlengthresist` | -1 | 336 |
| 8 | 0x28 poison | 45 `poisonresist` | 46 | 336 `passive_pois_pierce` |

Item "-x% to enemy resistance" uses `Properties.txt` `pierce-fire/ltng/cold/pois`
→ stats 333..336, the same stats the descriptor reads. Stats 305..308
(`item_pierce_*`) are **not** read by this resolver.

## Algorithm

```
res = resStat == -1 ? 0 : stat(defender, resStat)
if pierceStat != -1 and !(res >= 100 and defIsMonster):     ; 0x6FCFB3E0
    res -= stat(attacker, pierceStat)
if !defIsMonster and resStat not in {36, 37}:               ; 0x6FCFB3FE
    res += expansion ? DifficultyLevels.ResistPenalty       ; 0 / -40 / -100
                     : (diff==1 ? -20 : diff==2 ? -50 : 0)  ; classic
if res <= 0: return max(res, -100)                          ; 0x6FCFB434
if !defIsMonster:                                           ; 0x6FCFB44A
    cap = maxStat == -1 ? (resStat == 36 ? 50 : 75)
                        : min(95, 75 + stat(defender, maxStat))
    res = min(res, cap)
; monsters: no upper cap (>= 100 is immunity in the caller)
if resStat == 36 and attacker has state 47 (sanctuary)       ; 0x6FCFB480, positive res only
   and defender is undead (D2Common #10239, MonStats undead flags): res = 0
return res
```

Consequences for players and hirelings: physical DR caps at 50, magic resist at
`75 + maxmagicresist`, elemental resists at `min(95, 75 + max*resist)`, the
Nightmare/Hell penalty applies to fire/ltng/cold/poison (and poison length), and
`res >= 100` never means immunity.
