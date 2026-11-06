# D2Game 1.13c — timed unit states: removal frame

Timed states (curses, buffs, chill, …) are removed by a unit event scheduled at
`nGameFrame(apply) + duration`; the event runs during that frame's unit update, so the state is present in the
end-of-frame snapshots of frames `F .. F + duration - 1` and absent from `F + duration` on — independently of where
in the frame (player pass, missile pass, monster pass) the state was applied.

Oracle evidence (`p52-necromancer-curses`): Decrepify (`state 60`, skill 87 slvl 1 -> 100 frames) is applied to
zombie #9 on F=697 by the necromancer's cast; the golden trace shows `[60, 105]` up to F=796 and `[105]` from F=797
(= 697 + 100).

The replica keeps a per-unit countdown (`timers`, decremented by `stepUnitStates` once per unit update and removed
when it reaches 1). A state applied during the player pass was aged by the monster pass of the same frame and
expired one frame early (F=796). `applyUnitState` now records the apply frame and, on the oracle path,
`stepUnitStates` does not age a state on the frame it was (re)applied
([`player-death-and-shrines.ts`](../../src/server/engine/game-instance/player-death-and-shrines.ts)).

Pending: the 1.13c `STATES_SetTimer` / remove-state event addresses are not disassembled yet; the rule above is
from the oracle trace only.
