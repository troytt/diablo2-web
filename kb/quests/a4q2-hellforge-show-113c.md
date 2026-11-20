# Diablo II v1.13c A4Q2: Hell Forge show (special quest event 14)

Ground truth: `D2Client.dll` 1.13c (ImageBase `0x6FAB0000`). Port: `src/client/world/quest-fx-hellforge-113c.ts`,
`world-quest-fx.ts` (`spawnHellforgeShowAtForgeImpl`), `world-missile-stepper.ts` (CltDo38..41 / CltHit42..43). Issue #1492.

## Event 14 (`0x6fb03220`, jump table `0x6fba2138[14]` = `0x6fba2170`)

- gpPlayer `[0x6fbcbbfc]` and its room (#10331); `#10754(room, 2, 0x178)` looks for Objects.txt 376 `Hellforge` in the
  room and its near rooms; nothing happens when it is not found.
- `0x6faf5570(0x1251, 0, 0x15e, ...)`: song override 4689; `0x6fb38a70(ebx = 0x23, forge)`: Sounds.txt 35
  `quest_hellforge_smash` on the forge.
- `0x6fb5ff10(0x175 hfcontrol, forge.x, forge.y, 0, 1)`, then `#10637(m, forge id)` (TargetX), `#10019(m, 0)`.

## Missile chain

| Row | Func | Behaviour |
|---|---|---|
| 373 `hfcontrol` | CltDo38 `0x6fb6a7e0` | forge = object hash `0x6fbbaa08` lookup of TargetX; on elapsed 10: `0x6fb64fb0` and screen shake `[0x6fbbb9cc] = GetTickCount`, ramp up `0x50`, sustain `0x50`, ramp down `0x190` ms, amplitude `4` |
| `0x6fb64fb0` | — | 14 × create `{ flags 0x8102, owner, source = hfcontrol, missile 0x176, target relative (dx[i], dy[i]), range +0x4c }`; dx = {-4,2,4,-3,-2,3,5,-3,-5,5,-6,-1,0,6}, dy = {6,4,-4,-2,1,7,0,3,-4,-3,4,-5,5,-3}; range = Range(374) × d / 6 with d = (dx >= dy (signed) ? &#124;dx&#124; + 2&#124;dy&#124; : &#124;dy&#124; + 2&#124;dx&#124;) >> 1; `#10637(new, forge id)`, `#10019(new, RAND(35) + 10)` on the hfcontrol seed |
| 374/375 `hffragment1/2` | CltDo39 `0x6fb62480` | with an owner: `unit+0x44 = 0` every frame (held on frame 0) |
| 374 | CltHit42 `0x6fb65300` | range end: create `{ flags 0, source = shard, missile 0x177 }`, `#10637(new, TargetX)` |
| 375 | CltHit43 `0x6fb651c0` | range end: create `{ flags 0x8005, start = shard, velocity 0, missile 0x178, range = Range(373) = 200 }`, `#10637(new, TargetX)`, `#10019(new, RAND(35) + 10)` |
| 376 `hffragment3` | CltDo40 `0x6fb6a880` | with an owner: TargetY counts down; at 0 → `0x6fb65380` and TargetY = RAND(35) + 10 − 1 |
| `0x6fb65380` | — | forge = object of TargetX; create `{ flags 0, source = shard, missile 0x179 }` with 3D trajectory (z 0, vz `0x1000`, az 0); TargetX / TargetY = shard − forge |
| 377 `hfspirit1` | CltDo41 `0x6fb624a0` | elapsed 8: az = `0x100`, anim speed `>> 1`; elapsed 35: anim speed `<< 1` |
