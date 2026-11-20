# Client skill prediction: real States.txt row ids (1.13c)

Source: 1.13c `Skills.txt` (`aurastate`, `Param1/2`, `ELen`, `auralencalc`), `States.txt` (row index == `id`),
and 1.13c `D2Game.dll` (`SKILLS_CreateBlazeMissile`, `MISSMODE_SrvDmg07_Warcry_ShockWave`).
Code: `src/client/world/state-ids-113c.ts`, test `tests/vfx-1045-1049-state-id-parity.test.ts` (Issues #1045..#1049).

| Use | Correct row | Wrong row seen in the port | What the wrong row drew |
| --- | --- | --- | --- |
| #46 Blaze aurastate | 13 `blaze` (setfunc 3) | 12 `inferno` (nosend) | Inferno channel left a blaze trail |
| #123 Conviction aurastate | 28 `conviction` | 50 | Redemption ring |
| #124 Redemption aurastate | 50 `redemption` | 51 | Barbarian battlecommand overlay; aura switch stripped a real BC |
| #154 War Cry stun | 21 `stunned` (overlay1 `stun`) | 28 | Conviction overlays on monsters |
| #250 Hurricane / #230 Arctic Blast chill | 11 `cold` | 29 `convicted` | Conviction overlays on monsters |
| Assassin charge-ups 254/265/280/259/274/269 | 122..127 `progressive_*` only | + 147..152 | spirit_of_barbs / heart_of_wolverine / oak_sage / cyclonearmor on the assassin |

Durations used for client-predicted states:

- Blaze: `auralencalc = dm12` over Param1=50, Param2=500 → `trunc(110*lvl*450 / (100*(lvl+6))) + 50` (lvl1 = 120 frames).
  The trail is emitted only while state 13 is set and the unit moves.
- War Cry stun: `Param1 + (lvl-1)*Param2` = 25 + 5/lvl frames (`D2Game.dll` `SrvDmg07`; a Missiles.txt
  `DmgParam1 > 0` overrides, not the case for `warcry`).
- Hurricane cold: ELen 50 (no ELevLen); Arctic Blast cold: ELen 100 + 15/lvl (3-band elemental length).

Predicted states live in `ClientUnit.predictedStateUntilTick`; a server 0xA8/0xA9 for the same state hands the
lifetime back to the server, and a state already set by the server is never shortened by a prediction.

Overlay.txt note: `convictionfront` and `redemptionfront` have `Filename=null`; only the `*back` rows draw.
