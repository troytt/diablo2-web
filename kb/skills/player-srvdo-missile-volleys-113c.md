# Player `srvdofunc` missile volleys (1.13c)

Source: `samples/d2/D2Game.dll` (image base `0x6FC20000`), `samples/d2/excel/Skills.txt`.
Dispatch table: `gpSkillSrvDoFnTable` @ `0x6FD274A8` (see `d2-skills-missiles-dispatch-tables.md`).
Runtime: `src/server/engine/player-srvdo-113c.ts`, used by `GameInstance.launchPlayerSkillMissiles` (#1417).

Skill record offsets read by these functions: `+0x138` calc1, `+0x13C` calc2, `+0x140` calc3,
`+0x64` aurarangecalc, `+0x48` srvmissilea, `+0x4A` srvmissileb. Calc cells are evaluated through
`0x6FC2AC9A`; missiles are created through `0x6FC8F930` (create struct: flag `0x1` = explicit start,
`0x20` = explicit target, `0x10000` = no on-hit proc) or `0x6FCC28F0`.

## SrvDo008 `0x6FC6D420` — Multiple Shot (12), Teeth (67), Shock Wave (243)

1. `N = calc1` (Multiple Shot / Teeth `min(24, ln12)`, Param1=2 Param2=1 -> `slvl + 1`; Shock Wave `5`).
2. `(dx, dy) = target - caster`; `0x6FCBE490`: if `dx²+dy² < 4` scale x4, then if `< 16` scale x2.
3. `0x6FCBE450`: step `(sx, sy) = (dy, -dx)` halved (C truncating `/2`) until `sx²+sy² <= 3`.
4. First target = `target - trunc(step * N / 2)`; each missile advances one step.
5. `T = calc3` (`0` -> `N`; Multiple Shot calc3 = 2 "triggered"). Loops: `trunc((N-T)/2)` missiles with
   flags `0x10820`, `T` with `0x820`, rest with `0x10820` -> only the middle `T` can proc.
6. `calc2` is the activation frame (Multiple Shot / Teeth "Acivation frame"), not damage. `calc1` is
   the missile count, so it must not be applied as %ED.

## SrvSt008 `0x6FC6C870` + SrvDo012 `0x6FC6DCD0` — Strafe (26)

- SrvSt008: radius = `aurarangecalc` (par5 = 35), `0x6FCC0F40` counts targets in range;
  shots = `min(max(min(calc3, calc1), targets), calc1)` (calc1 `min(par3 + lvl - 1, par4)`,
  calc3 `2 + lvl/4`), stored with `0x6FC2AC94`.
- SrvDo012: one `srvmissilea` per call at the current target, `calc2` (`ln12`) passed to the missile
  callback `0x6FC6C190` as damage %; the counter is decremented and the next target is looked up with
  `0x6FCC0F40`; no target -> the sequence ends.

## SrvDo017 `0x6FC63B60` — Charged Bolt (38)

`calc1` (`min(24, ln12)`, Param1=3 Param2=1 -> `slvl + 2`) bolts, all aimed at the target; the init
callback `0x6FC61F50` only seeds each missile (owner seed + index), the wander is missile-side.

## SrvDo117 `0x6FC656B0` / SrvDo118 `0x6FC65600` — Firestorm (225), Twister (240), Tornado (245)

Both call the helper `0x6FC654E0` with `calc1` missiles (Firestorm `ln12` = 3, Twister `par1` = 3,
Tornado `1`). SrvDo117 creates the first one with `0x6FCC28F0` and `calc1 - 1` seeded ones; SrvDo118
passes `eax = 0` so all `calc1` are seeded creates. `calc1 <= 0` creates nothing.

## Single-create srvdofuncs (one missile per call, no loop)

10 `0x6FC6D270`, 14 `0x6FC6CE10`, 26 `0x6FC63720`, 28 `0x6FC62D90`, 73 `0x6FCB94C0`, 74 `0x6FC47E30`,
80 `0x6FCB93A0`.

## Still unmodeled in `GameInstance`

SrvDo024 Fire Wall `0x6FC637D0` creates two `srvmissilea` makers from the target point moving along
`(tx - (cy - ty), ty + (cx - tx))` / `(tx + (cy - ty), ty - (cx - tx))` plus one stationary
`srvmissileb`; it, and 11, 18, 19, 23, 29, 34, 43, 44, 48, 50, 54, 60, 63, 68, 75, 121, 123, 124, depend on
missile-side `pSrvDoFunc` / sub-missiles or multi-frame sequences that `GameInstance` does not run yet,
and are reported once per game by `reportUnmodeledPlayerSrvDoFunc`.
