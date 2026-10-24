# 1.13c Freeze Shatter & Icebreak Melt (`MissCltHitFunc[31]`, `D2Client.dll` 0x6FB605B0)

Issue #1453.

## Shatter on death

`States.txt` rows with `shatter = 1` (all also `hide = 1`, `monstaydeath = 1`, `udead = 1`):

| Id | State | Source |
|---:|---|---|
| 1 | `freeze` | frozen solid (Glacial Spike, Freezing Arrow, Frost Nova on freeze, ...) |
| 107 | `shatter` | Holy Freeze 20% per-pulse roll |
| 184 | `uberminion` | Uber Tristram minions |

A monster dying with any of them shatters: the corpse is hidden and the client creates the shard missiles
`icebreaksmall` (#272) or `icebreaklarge` (#274, `MonStats2.txt` LARGE) plus `icebreaksmoke` (#275).
Code: `SHATTER_STATES_113C` / `hasShatterState113c` in `src/common/units/monster-death-fx.ts`.

## Shard end: `MissCltHitFunc[31]` (0x6FB605B0)

`Missiles.txt` rows with `pCltHitFunc = 31` (all `AlwaysExplode = 1`, so the handler also runs at range end):
`icebreaksmall` (#272), `icebreakmedium` (#273), `icebreaklarge` (#274), `catapult cold explosion` (#417).

```
6fb605b0  test edx,edx ; je 6fb605bb ; xor eax,eax ; ret   ; unit hit -> no melt
6fb605bf  or   ebp,-1                                       ; default: no missile
6fb605c2  call 0x6fabc37c                                    ; missile class id
6fb605c7  add  eax,-0x110 ; cmp eax,0x91 ; ja 6fb605ed
6fb605d3  movzx eax, byte [eax+0x6fb606a0]
6fb605da  jmp  [eax*4+0x6fb60694]
6fb605e1  mov  ebp,0x158   ; icebreaksmallmelt (#344)
6fb605e8  mov  ebp,0x159   ; icebreaklargemelt (#345)
6fb60658  call 0x6fb560d0 / 0x6fb5ff10                      ; create at missile x/y
6fb60670  0x6fabc2d4 -> 0x6fabc3c4                           ; copy the missile direction
```

Byte table 0x6FB606A0: `[0]=0 (272)`, `[1]=1 (273)`, `[2]=1 (274)`, `[0x91]=1 (417)`, all others `2` (no missile).

| Shard | Melt |
|---|---|
| `icebreaksmall` #272 | `icebreaksmallmelt` #344 |
| `icebreakmedium` #273 | `icebreaklargemelt` #345 |
| `icebreaklarge` #274 | `icebreaklargemelt` #345 |
| `catapult cold explosion` #417 | `icebreaklargemelt` #345 |

The melts are `Range = 150`, `AnimLen = 12`, `LoopAnim = 0`, `NumDirections = 4`, `Trans = 1`.
Code: `ICEBREAK_MELT_BY_MISSILE_ID_113C` (`monster-death-fx.ts`) and the `pCltHitFunc === 31` branch of
`triggerMissileImpactImpl` (`src/client/world/world-missile-stepper.ts`).
