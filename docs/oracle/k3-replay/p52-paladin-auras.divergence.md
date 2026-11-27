# K3 kernel replay: p52-paladin-auras

| | |
|---|---|
| Boot snapshot | F2 (`5d754d364d167099…`) |
| Golden | F1..F1700 (`c544918119b8a618…`) |
| Boot check (hydrated F2 vs golden, strict) | identical |
| Strict horizon (all fields incl. seeds, stats) | F1700 |
| Position horizon (id/class/mode/x/y) | F1700 |
| Kernel frames matched | 1698 of 1698 |

## First strict divergence

None: the kernel matches the golden on every frame.

## Root-cause analysis (`D2Game.dll` VAs & handlers)

- **Immediate `F720` root cause (`0` unported manifest VAs)**: Two pure wiring bugs in `replay-kernel-113c.ts`: (1) `C2S 0x06` (`AttackUnit` on zombie `#10`, sent every 20 frames from `F640`) arrives at `F720` pre-frame while the Paladin is mid-swing in `PLRMODE_ATTACK1 (7)` (`dwFlags & 0x40 == 0`); `applyPlayerPacket113c` (`replay-kernel-113c.ts:3612-3616`) re-enters `startPlayerAttackWithTarget113c` (`MONSTER_ClearModeEvents113c`), deleting the `F720` `arg14 == 1` hit event before `EVENT_UpdateTimers113c` runs (whereas `D2Game:0x6FCEE9D0 -> 0x6FC983A0` rejects restarting `PLRMODE_ATTACK1` mid-swing). (2) `stepFallenSliceFrame113c` (`replay-kernel-113c.ts:3875-3946`) ignores `UNIT_PLAYER` timer `evType === 6` (`SKILLS_EventFunc06_PeriodicSkill` `0x6FCC00B0` -> `SKILLS_SrvDo065_BasicAura` `0x6FCBA8D0`), so `Concentration` (`#113`, state `42` from `F620`) and `Fanaticism` (`#122`, state `49` from `F1100`) never apply their `+damagepercent` / `+tohit%` / `+attackrate` stat lists (`3361` raw `<<8` one-shot kill of `#10` at `F720`).
