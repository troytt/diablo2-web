# D2Client SkillCltDoFunc 25 — 64-way ring (Nova family) (1.13c)

Verified against `D2Client.dll` 1.13c (ImageBase `0x6FAB0000`) and `D2Game.dll` 1.13c (`sub_6FD14170`).

## Dispatch

- SkillCltDoFunc table `0x6FB8EA48`; `[25] = 0x6FB23CB0` (dispatch `0x6FB52DDE movsx eax,word [skill+0xF4]` →
  `0x6FB52E03 mov eax,[eax*4+0x6FB8EA48]`).
- Skills.txt rows with `cltdofunc = 25` (all of them): 44 Frost Nova (`frostnova`), 48 Nova (`nova`), 92 Poison Nova
  (`poisonnova`), 130 Howl, 138 Shout, 146 Battle Cry, 149 Battle Orders, 154 War Cry, 155 Battle Command (same-name
  missiles), 190 PrimeIceNova (`frostnova`), 195 DiabFire (`diabfire`), 316 Baal Nova (`baal nova`), 346 MephFrostNova
  (`frostnova` — the client uses cltmissilea, the server srvmissilea `mephfrostnova`), 353 Trap Nova (`trapnova`).

## 0x6FB23CB0

1. missile = `0x6FAF0550` (cltmissilea, progressive-aware); bail when out of range of the missile table.
2. velocity = D2Common `0x6FDCC4C2` = `Vel + lvl * VelLev / 8` (**no MaxVel clamp**) + `0x6FABC316` (Skills.txt
   `cltcalc1`). Only Howl has a cltcalc1: `par1 * (lvl-1)` (Param1 = 2) → Howl's ring gets *faster* per level; its
   lifetime (Range 12) does not change.
3. `0x6FB51020(..., -1, ...)`: param flags `|= 4` (explicit velocity in `[+0x30]`), then `0x6FB50DB0(0)`.

## 0x6FB50DB0(0) — `0x6FB50E27..0x6FB50E5D`

```
for (edi = 0; edi < 0x100; edi += 4)          // 64 creates
    param.targetX = [edi + 0x6FB84390]        // X table
    param.targetY = [edi + 0x6FB84290]        // Y table
    if (param.missileId == 0xB0)              // 176 = diabfire
        param.flags ^= 0x4000
    0x6FB630F0(param)                         // create client missile
```

Tables (int32 × 64, radius 30), identical to D2Game `sub_6FD14170` xOffsets/yOffsets:

- X `0x6FB84390`: `30,29,29,28,27,26,24,23,21,19,16,14,11,8,5,2,0,-2,…,-30,…,29,29`
- Y `0x6FB84290`: `0,2,5,8,…,30,…,0,…,-30,…,-2`

Entry `i` is slot `i` of the 64-direction world circle (angle `i·2π/64`).

## Param flag 0x4000 = no light

`0x6FB630F0` creates the missile light (Missiles.txt `Light`, `Red/Green/Blue` at missiles.bin `+0x130/+0x132..+0x134`,
`0x6FB58C20`) only when the global light switch `[0x6FB8D854]` is on **and** `!(flags & 0x4000)` (`0x6FB6365B test
ah,0x40`). DiabFire (Light 3) toggles the bit before every create, so ring entries 0,2,4,… have no light and 1,3,5,…
do (32 lights instead of 64).

## Lifetime

`0x6FB63417..0x6FB63429`: `Range + LevRange * lvl` from Missiles.txt (unless flag 0x8000 supplies one).

## Server mirror

D2Game `sub_6FD14170(pGame, owner, center, missile, skill, lvl, velocity)` — same 64 table, flags 3 (|4 when velocity≠0):

- SrvDo022 (Nova family, Howl): velocity = `Vel(lvl) + calc1`.
- SrvDo068 (Shout / BC / BO / Battle Cry / War Cry): velocity 0 (missile default).
- SrvDo036 (Claws of Thunder progressive release, 2 charges): centre = **target unit**, missile = srvmissileb
  `clawsofthundernova`, velocity = `calc1 (empty) + Vel`.

Port: `src/common/skills/cltdo25-ring-113c.ts`, `spawnCltDo25Ring113c` in `src/client/world/world-skill-missiles.ts`
(issues #1058 #1059 #1061 #1062).
