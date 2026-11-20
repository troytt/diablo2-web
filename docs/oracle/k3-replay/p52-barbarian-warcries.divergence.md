# K3 kernel replay: p52-barbarian-warcries

| | |
|---|---|
| Boot snapshot | F2 (`ea6f058c2adf6e34…`) |
| Golden | F1..F1600 (`e1acd441aa6a6b81…`) |
| Boot check (hydrated F2 vs golden, strict) | identical |
| Strict horizon (all fields incl. seeds, stats) | F1600 |
| Position horizon (id/class/mode/x/y) | F1600 |
| Kernel frames matched | 1598 of 1598 |

## First strict divergence

None: the kernel matches the golden on every frame.

## Root-cause analysis (`D2Game.dll` VAs & handlers)

- **Immediate `F638` root cause (`2` unported `D2Game` VAs)**: `C2S 0x3C` selects `Battle Orders` (skill `#149`) at `F620` and `C2S 0x0C` starts `PLRMODE_CAST (10)` at `F630`. On the `F638` cast keyframe (`arg14 == 1`), `SKILLS_DoUsedSkillAction113c` skips `wSrvDoFunc = 68` (`SKILLS_SrvDo068_BasicShout` `0x6FC49720`), so the radial `battleorders` missile ring (`Missiles.txt` `#237`) is not spawned and `MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders` (`0x6FC5EA60`, `pSrvHitFunc = 18`) never applies state `32` (`maxhp%` scaling HP `136448 -> 221045`).
- **Downstream handlers (`F638..F1600`)**: Port & wire `0x6FC49720` (`SrvDo068` for `Battle Orders` `#149` at `F638`, `Battle Command` `#155` state `51` at `F718`, `Shout` `#138` state `26` at `F798`, and `War Cry` `#154` missile `#235` at `F918+`), port `0x6FC5EA60` (`SrvHit18`), and wire `MISSMODE_SrvDmg07_Warcry_ShockWave` (`0x6FC59600`, `pSrvDmgFunc = 7`, stun state `21` + physical damage) before `F1100+` `C2S 0x06` melee.
