# Function-level oracle harness (1.13c) — calling conventions

`tools/oracle/hook/fnharness.dll.c` is injected into the original 1.13c game by
`tools/oracle/run-oracle.sh` (`ORACLE_DLL=fnharness.dll`, wrapper `tools/oracle/run-fn-oracle.sh`).
It redirects the two `GAME_UpdateGameFrame` call sites (`D2Game 0x6FC4E2DB`, `0x6FC72712`,
see `oracle-hooks-113c.md` §1) and, 50 frames after the first player unit appears in the
game's unit hash (`pGame+0x1120`), executes `C:\oracle\fn-req.ndjson` on the game thread
(400 ms budget per frame), writing one JSON array per request line to
`C:\oracle\out\fn-resp.ndjson` and finally `C:\oracle\out\done`.

All VAs are 1.13c preferred-base addresses (`D2Game` `0x6FC20000`, `D2Common` `0x6FD50000`),
rebased at runtime from the loaded module's `ImageBase` (D2Game is relocated under Wine, e.g. to
`0x02720000`).

## Request / response format

- Request line: JSON array of int32, `[op, a0, a1, ...]`.
- Response line: JSON array; one integer, several integers for range ops, `"fault"` when the
  callee raised an exception (caught by a vectored handler that resumes at the saved stack, e.g.
  `idiv` by zero), `"bad"` for a malformed request.
- Range op `[100, op, lo, hi, a0, a1]` evaluates `op(a0, lvl, a1)` for `lvl = lo..hi` (int64 loop).
- `[101, skill, lo, hi]` evaluates SkillCalc codes `0..72` for each level.

Calls go through one generic trampoline: up to 8 stack arguments pushed right-to-left, the six GPRs
loaded from globals, `esp` restored after the call (works for stdcall and cdecl callees).

## Unit / data layout used

| Field | Meaning | Evidence |
|---|---|---|
| `unit+0x04` | class id (CharStats row) | `D2Common 0x6FD81E20` (`#10212`), `0x6FD0AD23` (D2Game vit alloc) |
| `unit+0x14` | monster data, `[+0x00]` = MonStats record | `D2Game 0x6FCFBA75..0x6FCFBA80` |
| `unit+0x20/+0x24` | unit RNG `{lo, hi}` | `oracle-hooks-113c.md` §4, `D2Game 0x6FCFE011..0x6FCFE02E` |
| `unit+0x5C` | stat list (ex) | `D2Common 0x6FD8A74E` (`#10887`) |
| `unit+0x80` | `pGame` | `D2Game 0x6FCFBAC4` |
| `unit+0xA8` | skill list; `+0x04` first skill | `D2Common 0x6FD9F546..0x6FD9F557` (`#10339`) |
| skill `+0x00` / `+0x04` / `+0x28` / `+0x34` | `pSkillsTxt` (word id) / next / hard level / owner guid (`-1` native) | `0x6FD9F560..0x6FD9F57E`, `#10008` `0x6FDA2812..0x6FDA2820` |
| `sgptDataTables (0x6FDE9E1C)+0xB98/+0xBA0` | `Skills.txt` records (stride `0x23C`) / count | `#10121 0x6FDA0473..0x6FDA0481` |
| `pGame+0x6D` / `+0x70` | difficulty byte / expansion flag | `D2Game 0x6FCFB414..0x6FCFB422` |

## Ops

| op | name | callee | convention (verified) |
|---:|---|---|---|
| 1 | SKCALC skill lvl code | `D2Common #10147` `0x6FDA1070` SkillCalc callback | `stdcall(unit, code, skill, lvl)`, `ret 0x10`; called by the Fog evaluator through `0x6FDA1B60` (`ecx = code`, `edx = {unit, skill, lvl}`) |
| 2 | SKFORM skill lvl fieldOff | `#10786` `0x6FDA1BF0` EvaluateSkillFormula | `stdcall(unit, calcIndex, skill, lvl)`, `ret 0x10`; `calcIndex` read from the skill record at `fieldOff` (calc1..4 `+0x138..+0x144`, `auralencalc +0x60`, `aurarangecalc +0x64`, `aurastatcalc1..6 +0x68..+0x7C`, `passivecalc1..5 +0xA4..+0xB4`, `petmax +0xC0`, `skpoints +0x170`, `ToHitCalc +0x1A0`, `DmgSymPerCalc +0x1D8`, `EDmgSymPerCalc +0x210`, `ELenSymPerCalc +0x224`; evidence: SkillCalc switch `0x6FDA1673..0x6FDA16EB`, `0x6FD9EA84`, `0x6FDA20BA`, `0x6FDA04BA`, `0x6FD9E991`) |
| 3 / 4 | ELMIN / ELMAX skill lvl bMastery | `#10121` `0x6FDA0460` / `#11091` `0x6FDA0360` | `stdcall(unit, skill, lvl, bMastery)`, `ret 0x10`, result in 256ths |
| 5 | ELEN skill lvl | `#10510` `0x6FD9E900` | `stdcall(unit, skill, lvl, 0)`; synergy via `0x6FD511E0` mulDiv (`0x6FD9E9EC`) |
| 6 / 7 | PHMAX / PHMIN skill lvl bStr | `#10297` `0x6FDA1FF0` (`SKILLS_GetMaxPhysDamage`) / `#10567` `0x6FDA2100` (`SKILLS_GetMinPhysDamage`) | `stdcall(unit, skill, lvl, bAddWeaponStatBonus)`; kick (`+0x05 & 0x02`) calls `0x6FD9F930(unit, 0/1)` (`trunc(max(1, str+dex-20) / (3 or 4)) << 8`); else `(band5(Max/MinLevDam) + Max/MinDam (+ stat21/22 * byte[+0x1A5] / 128)) * (100 + DmgSymPerCalc)/100 << HitShift` (no `lvl <= 0` guard) |
| 8 | TOHIT skill lvl | `#10653` `0x6FD9EA50` | `stdcall(unit, skill, lvl)`, `ret 0xC`; `ToHitCalc` (`+0x1A0`) else `ToHit + (lvl-1)*LevToHit` (`+0x198/+0x19C`) |
| 9 | RAWMANA skill lvl | `#10090` `0x6FD9EA00` | `stdcall(skill, lvl)`, `ret 8`: `((lvl-1)*lvlmana + mana) << manashift`, **no level guard** (`mana +0x18A`, `lvlmana +0x18C`, `manashift +0x188`) |
| 10 / 14 | SETSKILL skill hard / RESTORESKILL skill | `#10008` `0x6FDA2660` SKILLS_AddSkill | `stdcall(unit, skill) -> pSkill` (new skill `hard = 1`, owner `-1`); the harness then writes `pSkill+0x28`; first-touch value restored by op 14 |
| 11 / 15 / 12 / 13 | SETSTAT / RESTORESTAT / GETSTAT / GETBASE | `#10887` `0x6FD8A740` / `#10973` `0x6FD88B70` / `#10587` `0x6FD88C20` | `stdcall(unit, stat, value, layer)` / `stdcall(unit, stat, layer)` |
| 20 / 51 | MULDIV / GMULDIV a b c | `D2Common 0x6FD511E0` / `D2Game 0x6FC214D0` (same body) | registers: `edx = a`, `eax = b`, `ecx = c`; `c == 0 -> 0`; `a > 0x100000 && c <= a>>4 -> (a/c)*b`; `b > 0x10000 && c <= b>>4 -> (b/c)*a`; large -> 64-bit `lldiv` low dword; else `a*b/c` |
| 21 | DIMRET lvl a b | `#10115` `0x6FD9DC30` | `stdcall(lvl, a, b)`, `ret 0xC` (`lvl == -6` divides by zero -> `"fault"`) |
| 22 | BAND5 lvl l1..l5 | `0x6FD9DDB0` | `eax = lvl`, `ecx = &int32[5]`; no base term |
| 40 / 41 / 42 | USETSTAT / URESTORE / UGETSTAT sel ... | as 11/15/12 on `sel` 0 = player, 1 = first monster (a town NPC) | |
| 43 | AR class | `#10621` `0x6FD81EA0` | `stdcall(unit)`: `5*dex + tohit - 35` (`0x6FD81F42..0x6FD81F46`) `+ CharStats[+0x3C] ToHitFactor` for players (`0x6FD81F7F`); class override = temporary write of `unit+0x04` |
| 44 | DEF sel | `#10672` `0x6FD82890` | `stdcall(unit)` |
| 45 | BLOCK bExp class | `#10212` `0x6FD81D20` | `stdcall(unit, bExpansion)`, `ret 8`; player: `(stat20 + CharStats[+0x49])` (`0x6FD81E41`), expansion `*(dex-15)/(2*max(1,clvl))` (`0x6FD81E50..0x6FD81E7B`), **upper clamp 75 only** (`0x6FD81E7F`), negative results are returned |
| 46 | HIT extraPct bMissile | `D2Game 0x6FCFDE90` | `eax = attacker`, `stdcall(defender, extraToHitPct, bMissile)`, `ret 0xC`, returns 1 = hit. The roll is `((lo*0x6AC690C5 + hi) mod 2^32) mod 100` on the attacker seed (`0x6FCFE011..0x6FCFE031`); the harness seeds `{lo = 0, hi = r}` to force roll `r` and binary-searches the smallest missing `r` = hit chance. `alvl + dlvl == 0` faults (`idiv` at `0x6FCFDFFA`) |
| 47 | RESIST row defSel penalty expansion difficulty | `D2Game 0x6FCFB3C0` | `ebx = &descriptor` (`0x6FD22AB0 + row*0x2C`: `+4 resStat`, `+8 maxStat`, `+0xC pierceStat`), `edi = ctx {+0 pGame, +4 &ResistPenalty, +8 attacker, +0xC defender, +0x10 atkIsMonster, +0x14 defIsMonster}`; the harness passes a zeroed fake game with only `+0x6D`/`+0x70` set (the resolver reads nothing else from it) |
| 48 / 49 / 50 | STEAL life / mana, MONDRAIN diff | `D2Game 0x6FCFBA40` | `eax = pDamage (+0x08 phys, +0x38 life%, +0x3C mana%)`, `edx = pGame`, `ecx = defender`, `stdcall(attacker)`, `ret 4`; the harness measures the attacker's stat 6 / 8 increase (max 7 / 9 raised, current set to 256, difficulty byte patched and restored); Drain byte `[[def+0x14]]+0xA0+diff` |
| 52 | DIMINISH idx | `D2Common 0x6FD823E0` | `eax = index` into `0x6FDE4608 {bDiminish, base, stat}`, `stdcall(unit)`, `ret 4`: `v ? base*v/(base+v) : 0` (32-bit `imul`, `idiv` by zero at `v = -base`) |
| 53 | EXPLVL clvl mlvl exp | `D2Game 0x6FCFAA40` | registers only: `eax = clvl`, `ecx = mlvl`, **`edx = exp`** (tail-jumps into `0x6FC214D0` mulDiv; `mov eax, edx; ret` at `0x6FCFAA86`) — not a stack argument |
| 54 | EXPRATIO exp clvl | `D2Game 0x6FCFA9E0` | `eax = exp`, `stdcall(clvl)`, `ret 4`; `exp > 0x7FFFFFFF >> (shift + (ratio >> shift))` takes `(exp >> shift) * ratio` (`0x6FCFAA18..0x6FCFAA1F`) |
| 55 / 56 | VITALLOC / ENEALLOC n class which | `D2Game 0x6FD0AD10` / `0x6FD0AE20` | `eax = n`, `esi = unit`; returns the delta of maxhp / maxstamina / maxmana |
| 57 | LEVELUP levels class which | `D2Game 0x6FD0B090` | `esi = unit`, `stdcall(pGame)`, `ret 4`; the harness sets stat 13 to `#10399(class, lvl0+k-1)` (`#10399(c, L)` = experience to reach `L+1`, cf. `nextexp` at `0x6FD0B0DC`) and restores level/exp/vitals afterwards |
| 58 / 59 | DMGPIPE defSel diff phys fire ltng magic cold pois rate / DMGFIELD off | `D2Game 0x6FCFC0B0` SUNITDMG_CalcResistAndAbsorb | `stdcall(pGame, attacker, defender, pDamage)`, `ret 0x10` (args read at 0x6FCFC0B3 / 0x6FCFC0B9 / 0x6FCFC0CD / 0x6FCFC0D1). It builds the context on its stack (`+0 pGame, +4 DifficultyLevels rec (#10237), +8 attacker, +0xC defender, +0x10/+0x14 non-hireling-monster flags, +0x18 pDamage, +0x1C reducer[0] = 0, +0x20 DR = stat34<<8, +0x24 MDR = stat35<<8`, each scaled by `mulDiv(r, pDamage+0x54, 0x400)` when both > 0), applies the PvP percent (`0x6FCFAC10`), then runs the 12 descriptors through `0x6FCFBD00` (`eax = descriptor`, `ecx = context`, `stdcall(bNoResist)`: subtract `reducer[desc+0x18]`, resist via `0x6FCFB3C0` and `mulDiv(edx = dmg, eax = 100 - min(res,100), 100)`, absorb `0x6FCFAD00` with `eax = dmg`, `ecx = context`) and writes the total to `+0x4C` (`+0x08 + 0x10 + 0x1C + 0x20 + 0x24 + 0x28`, 0x6FCFC4F7..0x6FCFC519). The harness passes a zeroed 0x100-byte damage struct (phys `+0x08`, fire `+0x10`, ltng `+0x1C`, magic `+0x20`, cold `+0x24`, poison `+0x28`, absorbed life `+0x48`, frame rate `+0x54`; note `+0x54` lies past the 0x48 bytes usually quoted) and patches `pGame+0x6D` (difficulty) for the call |
| 60 / 61 | ANIMSPEED mode class / ANIMLAST which | `#10819` `0x6FD83110` UNITS_UpdateAnimRateAndVelocity | `stdcall(unit, file, line)`, `ret 0xC`; with `unit+0x10 = mode` (and class override) it re-selects the AnimData record (`#11122` 0x6FD82670 -> `unit+0x50`) for the equipped weapon class and writes the animation speed to `unit+0x4C` (word) / `+0x3C`. Record: `+0x08` frames per direction, `+0x0C` speed, `+0x10[0x90]` frame events. The harness restores mode/class and re-runs `#10819`. Frame stepping (for the derived tick count): `0x6FD7F090` `accum(+0x44) += speed`; finished when `accum + speed >= frames << 8` (`0x6FD7EF6D..0x6FD7EF7E`) |
| 62 | ANIMDATA which c0..c6 | `#10385` `0x6FD91EF0` | `stdcall(cofName, &frames, &speed, &firstEventFrame) -> found`, `ret 0x10`; name is upper-cased in place; first event = first non-zero event byte, `framesPerDir` if none |

## Caveats

- Skill calcs read the player's native skill list; `SETSKILL` writes hard levels directly (passive
  skill stats are not re-applied), matching what `skill('X'.blvl)` / `.lvl` read.
- The monster used for hit/resist/steal is the first unit in the monster hash whose MonStats Drain
  (normal, `+0xA0`) is non-zero (a Rogue Encampment NPC, Drain 100), else the first monster; its MonStats
  flags (demon/undead/boss) are fixed, so those branches and `Drain != 100` are not exercised.
- Adding skills with `#10008` applies their passive stats (e.g. masteries feed `#10804` to-hit and
  stats 329..332), so the sweep runs every unit-based category before the skills category and records
  the accrued stats each skill configuration actually saw.
- Class overrides (`unit+0x04`) are held only for the duration of one call.
