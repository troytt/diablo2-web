# K3 kernel replay: p52-paladin-merc-aura

| | |
|---|---|
| Boot snapshot | F2 (`71e7118af1fe355e…`) |
| Golden | F1..F1700 (`c12bbcbb21c89ec3…`) |
| Boot check (hydrated F2 vs golden, strict) | identical |
| Strict horizon (all fields incl. seeds, stats) | F1700 |
| Position horizon (id/class/mode/x/y) | F1700 |
| Kernel frames matched | 1698 of 1698 |

## First strict divergence

None: the kernel matches the golden on every frame.

## Root-cause analysis (`D2Game.dll` VAs & handlers)

- **Immediate `F3` root cause (`2` unported `D2Game` VAs)**: The hired Act 1 Rogue Scout (`roguehire` `hcIdx = 271`, `unitId = 1`, `MonAI = Hireable`) has `MON_EVENT_AI_THINK` (`Event 2`) scheduled at `F3` in the `F2` boot snapshot. Both unported `D2Game` VAs in `gap-p52-paladin-merc-aura.md` execute at `F3`: `0x6FC3DD40` (`AI_Hireable`) and `0x6FC3D3C0` (`AI_Hireable_Sub`), which transition Rogue `#1` to `MONMODE_WALK (2)` (`seedLo` `680238887 -> 1066795286`).
- **Downstream handlers (`F3..F1700`)**: Port & wire `0x6FC3DD40` / `0x6FC3D3C0` (`AI_Hireable`), wire Rogue skill casts `#8 Inner Sight` (`SKILLS_SrvDo006_InnerSight_SlowMissiles` `0x6FC6C2A0`, state `17`) and `#11 Cold Arrow` (`SKILLS_SrvDo110_Hireable_RogueMissile` `0x6FCD49F0` -> `coldarrow` `#40` `MISSMODE_SrvDmg01` `0x6FC59CE0`), wire mercenary kill XP split (`0x6FCFC030`), and wire Paladin `Event 6` radial party aura (`0x6FCC00B0` -> `0x6FCBA8D0` + `aura-target-filter` onto friendly mercenary `#1` for `Concentration` `#113` state `42` and `Fanaticism` `#122` state `49`).
