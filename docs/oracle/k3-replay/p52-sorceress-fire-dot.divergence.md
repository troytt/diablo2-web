# K3 kernel replay: p52-sorceress-fire-dot

| | |
|---|---|
| Boot snapshot | F2 (`aed7b57697fcf7cb…`) |
| Golden | F1..F1800 (`2aea1b8ec7b7786f…`) |
| Boot check (hydrated F2 vs golden, strict) | identical |
| Strict horizon (all fields incl. seeds, stats) | F1800 |
| Position horizon (id/class/mode/x/y) | F1800 |
| Kernel frames matched | 1798 of 1798 |

## First strict divergence

None: the kernel matches the golden on every frame.

## Root-cause analysis (`D2Game.dll` VAs & handlers)

- **Immediate `F636` root cause (`0` unported manifest VAs)**: `C2S 0x3C` selects `Fire Wall` (skill `#51`) at `F620` and `C2S 0x0C` (`(5662, 5794)`) enters `PLRMODE_CAST (10)` at `F630` (strictly matching `F630..F635`). On the `F636` cast keyframe (`arg14 == 1`), `SKILLS_DoUsedSkillAction113c` (`replay-kernel-113c.ts:3918-3923`) skips mana deduction (`77568 -> 69664`, `31 << 8`) and `wSrvDoFunc = 24` (`SKILLS_SrvDo024_FireWall` `0x6FC637D0`, spawning `firewallmaker` `#68` + `firewall` `#69` and applying `skilldelay` state `121`).
- **Downstream ported handlers to wire (`0` unported VAs)**: Wire `SKILLS_SrvDo024_FireWall` (`0x6FC637D0`), `MISSMODE_SrvDo06_FireWallMaker` (`0x6FC61850`), `MISSMODE_SrvDo05_FireWall` (`0x6FC61980`), and `MISSMODE_SrvDmg03_FireWall` (`0x6FC59670`) for `F636..F899`; then wire `C2S 0x0D` + `PLRMODE_SEQUENCE (14)` channeling (`SKILLS_SrvSt11_Inferno_ArcticBlast` `0x6FC64550` setting `STATE_INFERNO` `85`, `SKILLS_SrvDo019_Inferno_ArcticBlast` `0x6FC64390` spawning `infernoflame1` `#65` and draining per-tick mana) for `Inferno` (`#41`) on zombie `#11` at `F900..F1300`.
