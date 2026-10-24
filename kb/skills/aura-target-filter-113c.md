# 1.13c aura target selection: `aurarangecalc` radius + `aurafilter` bits

Ground truth: `samples/d2/D2Game.dll` (image base 0x6FC20000), `samples/d2/D2Common.dll`
(image base 0x6FD50000), `samples/d2/excel/Skills.txt`. Implemented in
`src/common/skills/aura-filter.ts` and used by `src/server/engine/aura-scanner.ts` (issue #1410).

## Radial scan 0x6FCC0C70

Called by `SrvDo065` (0x6FCBAB61), `SrvDo066`, `SrvDo081`, `SrvDo082` and the Blade Shield pulse
0x6FCB35CB with `(unit, x=0, y=0, range, filter, callback, ctx, flag)`:

| arg | source |
| --- | --- |
| `range` | evaluated `aurarangecalc` (`[skill+0x64]`, calc via 0x6FC2AC9A) |
| `filter` | `aurafilter` (`[skill+0x50]`) |

- `test ebx,ebx; jle exit`: a radius `<= 0` scans nothing.
- `x = y = 0` -> the source unit's own sub-tile coordinates (0x6FC21100 / 0x6FC21130).
- filter `0` -> `0x583`.
- `6fcc0d00: imul ebp,ebx` -> `range²`. For every unit D2Common ord 10769 (0x6FD84580:
  `sub; sub; imul; imul; add`) returns the sub-tile `dx² + dy²`; `6fcc0e07: cmp ebp,eax; jl skip`.
  So a unit is hit when `dx² + dy² <= range²` — a circle in sub-tile space (no 2:1 squash, no pixel
  conversion).
- filter bit `0x2000`: rooms for which D2Common ord 10057 is true are skipped entirely. Ord 10057
  reads `room->+0x10->+0x58->+0x1D0` (level id) and calls 0x6FD7D320, a byte table over level ids
  1..109 that returns 1 for the five act towns (IsTown).

## Per-unit predicate 0x6FCC0370

Jump table 0x6FCC0610 on unit type: 0 player 0x6FCC038B, 1 monster 0x6FCC03BC, 2 object 0x6FCC0411,
3 missile 0x6FCC041E, 4 item 0x6FCC0448; type > 4 rejected.

| bit | meaning |
| --- | --- |
| `0x1` | players allowed |
| `0x2` | monsters allowed (mercenaries / summons are monsters) |
| `0x4` | monster must be undead: D2Common ord 10239 = MonStats flags byte +0xD & (`gdwBitMasks[3]` \| `[4]`) = `lUndead` \| `hUndead` |
| `0x8` | missiles allowed (plus a Missiles.txt flag test) |
| `0x10` | objects allowed |
| `0x20` | items allowed |
| `0x80` | unit flag `0x4` required (`[unit+0xC4]`) |
| `0x100` | target's room is town (ord 10331 + ord 10057) -> reject |
| `0x200` | D2Common ord 11076 path test (collision mask 4) from source to target fails -> reject |
| `0x400` | unit flag `0x8` required |
| `0x1000` | with it only dead units (player mode 0x11, monster mode 0x0C); without it dead/dying (mode 0 / 0x11 / 0x0C) are rejected |
| `0x2000` | (scan loop) skip town rooms |
| `0x4000` | D2Common ord 10064 = MonStats flag bit 6 (`boss`) -> reject |
| `0x8000` | 0x6FD00A60 (hostile after owner resolution) required |
| `0x10000` | 0x6FD00570 (same unit / same owner / party) required; monsters with MonStats flag bit 8 (`npc`) rejected |
| `0x20000` | D2Common ord 11138 relation check required (no aura row uses it) |
| `0x40000` | D2Common ord 10278 = MonStats flag bit 7 (`primeevil`) -> reject |
| `0x80000` | target in state 86 `justhit` (D2Common ord 10494) -> reject |

`gdwBitMasks` is the Fog.dll export imported by both DLLs (`1 << n`).

## Skills.txt values

| rows | aurafilter | notes |
| --- | --- | --- |
| Might, Prayer, resist auras, Thorns, Defiance, Blessed Aim, Cleansing, Concentration, Vigor, Fanaticism, Salvation | 73731 = 0x12003 | players + monsters, ally, **town rooms skipped** |
| Meditation 120 | 73729 = 0x12001 | players only |
| Barbs / Wolverine / Oak Sage Aura 296-298 | 65795 = 0x10103 | ally, target not in town |
| Holy Fire 102, Holy Shock 118 | 42883 = 0xA783 | enemy, LOS, town skipped |
| Conviction 123 | 42371 = 0xA583 | enemy, no LOS bit, town skipped |
| Holy Freeze 114 | 303747 = 0x4A283 | enemy, LOS, not prime evil, town skipped |
| Sanctuary 119 | 59270 = 0xE786 | undead non-boss monsters only, LOS, town skipped |
| Redemption 124 | 4354 = 0x1102 | dead monsters, not in town; `ln12` = 16 + 0 |
| Blade Shield 277 | 33667 = 0x8383 | enemy, LOS, not in town; `aurarangecalc = par4` = 6 |

## Town behaviour

Friendly paladin auras do **not** reach party members, mercenaries or summons in town: the `0x2000`
room skip removes every town unit from the scan. The caster still carries its own `aurastate`,
because `SrvDo065` applies it directly through 0x6FCBA1A0 (call at 0x6FCBAA52) before and
independently of the scan. Spirit auras (296-298) reject town targets through `0x100`.
