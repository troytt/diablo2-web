# Diablo II v1.13c: worldstone shake (special quest event 19, Missiles.txt 639)

Ground truth: `D2Client.dll` 1.13c. Port: `src/client/world/quest-fx-worldstone-113c.ts`, `client-world.ts`
(`armWorldstoneShake`, `updateWorldstoneShakeTrigger`), `world-missile-stepper.ts` (CltDo66). Issue #1496.

- Event 19 `0x6fb02410` (jump table `0x6fba2138[19]`) only sets `[0x6fbcc2ec] = 1`.
- `0x6fb032c0` runs on every room change of the local player (tail-called from `0x6facbe90` and `0x6fb033d7`):
  `GetLevelId(room)` in `[0x83, 0x84]` (131 / 132) and `[0x6fbd3478] == 0` and armed and gpPlayer →
  `0x6fb515c0(0x27f, 0, 1)` from the local player, `[0x6fbd3478] = 1`; any other level → `[0x6fbd3478] = 0`.
- CltDo66 `0x6fb69ea0`: owner = `0x6fb560d0(m)`; no owner or owner room level not 131 / 132 → `0x6fb61720` (remove,
  which does not run the CltHitFunc). `#11121(m, owner)` / `#10759(m)` keep the missile on its owner; the CltDo1 tail
  is never called (the missile does not age). `TargetX == 0 || (RAND() & 0x3f) == 0` → screen shake (tick,
  ramp up `0x7d0`, sustain `0xbb8`, ramp down `0x7d0` ms, amplitude 6) and `TargetX = 1`. `RAND() % 10 == 0` →
  `ox = RAND(60) - 30`, `oy = RAND(60) - 30` → `0x6fb63b40(m, x + ox, y + oy)`.
- `0x6fb63b40`: `#10573(room, x, y, 3, 1)` blocked → nothing; else create `{ flags 0x2001, start (x, y),
  missile 0x27b + RAND(3) }` (635..637 `baalfx tyreal debris 1..3`), trajectory z `0x7d000` / vz `-0x5000`, range 25,
  anim speed `0x80`.
- CltHit61 `0x6fb5ffe0`: without a hit unit clears `[0x6fbcbefc]`, `[0x6fbcbf00]`, `[0x6fbbb9dc]` (shake off).
