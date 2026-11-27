# K3 kernel replay: p52-necromancer-curses

| | |
|---|---|
| Boot snapshot | F2 (`4a6c992f7d31ea27…`) |
| Golden | F1..F2000 (`94e6860b08b2546f…`) |
| Boot check (hydrated F2 vs golden, strict) | identical |
| Strict horizon (all fields incl. seeds, stats) | F2000 |
| Position horizon (id/class/mode/x/y) | F2000 |
| Kernel frames matched | 1998 of 1998 |

## First strict divergence

None: the kernel matches the golden on every frame.

## Root-cause analysis (`D2Game.dll` VAs & handlers)

- **Immediate `F630` root cause (`8` unported `D2Game` VAs later at `F1517+`)**: `C2S 0x3C` selects `Amplify Damage` (skill `#66`) at `F620`, and `F630` sends `C2S 0x0D` (`CS_RIGHTSKILLONUNIT`, `0x6FCEEA40` -> `0x6FCEE690` -> `PLAYER_StartSkillOnTarget` `0x6FC98840`) targeting zombie `#10`. `applyPlayerPacket113c` (`replay-kernel-113c.ts:3520-3580`) does not handle `0x0D`, leaving the Necromancer in `PLRMODE_NEUTRAL (1)` instead of `PLRMODE_CAST (10)`.
- **Downstream handlers (`F630..F2000`)**: Wire `C2S 0x0D` (`0x6FC98840`) and `wSrvDoFunc = 30` (`SKILLS_SrvDo030_Curse` `0x6FC705D0`, already ported) for `Amplify Damage` (`#66`, state `9`), `Decrepify` (`#87`, state `60`), `Lower Resist` (`#91`, state `61`), and `Weaken` (`#72`, state `19`) with curse exclusivity + `Event 12` expiry; `F860..F1500` `C2S 0x06` melee kill of cursed zombie `#10`; `F1510+` `Raise Skeleton` (`#70`, `wSrvStFunc = 15` `0x6FC6EF20`) requiring the 8 unported `D2Game` VAs in `gap-p52-necromancer-curses.md`: `0x6FC718B0` (`SKILLS_SrvDo031_RaiseSkeleton_Mage`), `0x6FCC3610`, `0x6FCC3090`, `0x6FCB7F50`, and `F1542/F1576` `NecroPet` AI (`0x6FC3E900`, `0x6FC3E640`, `0x6FC3E140`, `0x6FC3CAE0`).
