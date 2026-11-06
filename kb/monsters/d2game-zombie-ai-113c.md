# D2Game 1.13c Zombie AI (`AiZombie`, `0x6FCA38B0`) and its helpers

Port of the `MonAI.txt` row `Zombie` (MonStats `AI = Zombie`, e.g. `zombie1..5`, hcIdx 5..9) and of
the D2Game helpers it reaches. Every address is a `D2Game.dll` 1.13c preferred-base VA
(`0x6FC20000`); D2Common calls go through import thunks and are written as `#ordinal`
(thunk -> IAT resolved with `objdump -p`). TS port:
[`stepDrlgMonsterAi113c`](../../src/server/engine/game-instance/monster-combat-ai.ts),
[`AreaPathWorld113c.startMonsterMoveToTarget113c` / `startMonsterMoveToPos113c`](../../src/server/ai/town-npc-ai-113c.ts),
[`monsterAttackTiming` / `resolveMonsterAttackOnPlayer`](../../src/server/engine/game-instance/monster-melee-attacks.ts).

Verification: `npx tsx tools/oracle/trace-window.ts <scenario> [--frame F] [--unit 1:9]` prints the
per-frame number of draws taken from every unit seed on both sides and the replica call site of each
draw. The p52 goldens (`tests/fixtures/oracle/golden/p52-*.oracle.ndjson.gz`) exercise this AI on the
three Blood Moor zombies (units 9/10/11).

> [!IMPORTANT]
> In the replica every DRLG-populated monster currently runs `stepDrlgMonsterAi113c`, i.e. this
> Zombie AI, whatever its MonStats `AI` column says. Other AI families must get their own 1:1 port
> (dispatch table: [`d2game-monai-dispatch-table-113c.md`](./d2game-monai-dispatch-table-113c.md)).

## 1. `AiZombie` — `0x6FCA38B0`

`__fastcall(ecx = pGame, edx = pMonster, [esp+4] = pAiTick)`, `ret 4`. `pAiTick` fields read:
`+0x08` target unit, `+0x14` target distance (`ebx`), `+0x18` "in melee range" flag, `+0x1C`
`pMonStatsTxt`. `pGame+0x6D` is the difficulty byte used to index the `int16[3]` MonStats AI params.

```
AiZombie(pGame, pMonster, pAiTick):
  if pAiTick->bInMeleeRange:                                   ; 0x6FCA38C8 test edx,edx
    roll = SEED_Inline(&pMonster->pSeed).lo % 100              ; 0x6FCA38D7..0x6FCA38F7 (mul 0x6AC690C5, div 100)
    if roll < MonStats.aip4[diff]:                             ; 0x6FCA38F9..0x6FCA3906  (+0x68)
      mode = A1 (4), bMoving = MonStats2.A1mv ? 101 : 100      ; 0x6FCA3931..0x6FCA395D  (MonStats2+0x104 & mask[+0x10])
    else:
      mode = A2 (5), bMoving = MonStats2.A2mv ? 101 : 100      ; 0x6FCA39AE..0x6FCA39DF  (mask[+0x14])
    MONSTER_StartMode(pGame, {mode, pMonster, target}, 1)      ; 0x6FCA3976 / 0x6FCA39F8 -> 0x6FC95E10
    return
  ; not in melee range                                         ; 0x6FCA3A07
  aip1 = MonStats.aip1[diff] (+0x56); aip2 = MonStats.aip2[diff] (+0x5C)
  if pMonster is a monster && pMonsterData->[+0x54] in {3, 0x13}: goto chase   ; 0x6FCA3A19..0x6FCA3A30
  if dist < aip2:                                              ; 0x6FCA3A32
    roll = SEED_Inline(&pMonster->pSeed).lo % 100              ; 0x6FCA3A36..0x6FCA3A56
    if roll < aip1: goto chase                                 ; 0x6FCA3A58
  if #10826(#10331(pMonster)) == 17 (Burial Grounds): goto chase   ; 0x6FCA3A5C..0x6FCA3A6B
  AI_IdleWander(pGame, pMonster, range = 3)                    ; 0x6FCA3AAD -> 0x6FD11B10
  return
chase:                                                         ; 0x6FCA3A6D
  pMonsterData->pAiControl->[+0x1C] = 100                      ; velocity override (0x6FCA3A8C)
  AI_ApproachTarget(pGame, pMonster, target, mode = RN (15), x = 0, y = 0, stepNum = 1, flags = 0)   ; 0x6FCA3A9E
```

### RNG consumption

| Branch | Seed | Draws | Use |
|---|---|---|---|
| in melee range | `pMonster->pSeed` | 1 | `lo % 100 < aip4` -> A1 else A2 |
| out of range, `dist < aip2` | `pMonster->pSeed` | 1 | `lo % 100 < aip1` -> chase |
| out of range, `dist >= aip2` | — | 0 | (level 17 check, no draw) |
| wander | `pMonster->pSeed` | 3 + `RollLimited` | see §3 |

### Fields read (no defaults)

`MonStats.txt` `aip1`, `aip2`, `aip4` for `pGame->nDifficulty` (TS
`monStatsAip113c(host, monster, n)` reads `MONSTATS_113C_ROWS[hcIdx].aip<n>[difficulty]` and throws on
a missing row); `MonStats2.txt` `A1mv` / `A2mv` (`+0x104` bit table).

### Known gaps (not yet ported 1:1)

- `pMonsterData+0x54 in {3, 0x13}` "always chase": the TS keeps its older stand-ins
  (`superUniqueId` Corpsefire / Creeping Feature, Taunt state 54) until the field is identified.
- `bMoving` (101 vs 100) for the attack modes: TS starts attacks without a path (`100`), which matches
  zombies (`A1mv`/`A2mv` = 0); monsters that move while attacking are not covered.

## 2. `AI_ApproachTarget` — `0x6FD12540`

`__fastcall(ecx = pGame, edx = pMonster, stack: pTarget, nMode, nX, nY, nStepNum, nFlags)`, `ret 0x18`.

```
if nMode == RN (15) && STATES_CheckState(pMonster, 60 /*decrepify*/):   ; 0x6FD12549..0x6FD1255D (#10494)
  pAiControl->[+0x18] = 0; [+0x1C] = 0; [+0x20] = 0; nMode = WL (2)     ; 0x6FD12579..0x6FD1258B
#11005 PATH_SetStepNum(pMonster->pPath, nStepNum)                       ; 0x6FD12599
struct = MODECHANGE_Init(nMode, pMonster)                                ; 0x6FD125A5 -> 0x6FC95070
if pTarget: struct.pTarget = pTarget else struct.x, y = nX, nY           ; 0x6FD125AA..0x6FD125C4
ok = MONSTER_StartMode(pGame, &struct, 1)                                ; 0x6FD125D4
if !ok:
  if nFlags & 4: ...; if nFlags & 1: ...;                                ; 0x6FD125E7..0x6FD12638
  if nFlags & 2:                                                         ; 0x6FD1263C
    roll = SEED_Inline(&pMonster->pSeed).lo % 100                        ; 0x6FD12641..0x6FD12661
    roll < 70 ? AI_IdleWander(pGame, pMonster, 4) : 0x6FD122C0(..., 10)
return ok
```

`MODECHANGE_Init` (`0x6FC95070`) zeroes the 0x20-byte struct, stores `nMode`/`pUnit` and sets
`+0x15 = 101` when `0x6FC94F20(pUnit, nMode)` reports a moving mode (table `0x6FD1BC50[nMode].bMoving`:
modes 2 WL, 13 KB, 14, 15 RN), else `100`. Zombie calls pass `nFlags = 0`, so the failure branch draws
nothing.

## 3. `AI_IdleWander` — `0x6FD11B10`

`__fastcall(ecx = pGame, al = nRange, stack: pMonster, ...)`, `ret 8`.

```
x0, y0 = unit position (#10867 / #10750 for dynamic paths)              ; 0x6FD11B1C..0x6FD11B85
s = SEED_Inline(&pMonster->pSeed)                                        ; 0x6FD11B85..0x6FD11BA0
if s.lo & 1: dy = RollLimited(&seed, nRange); dx = nRange                ; 0x6FD11BA6 (0x6FC211D0)
else:        dx = RollLimited(&seed, nRange); dy = nRange                ; 0x6FD11BB4
if SEED_Inline(&seed).lo & 1: dx = -dx                                   ; 0x6FD11BC4..0x6FD11BE1
if SEED_Inline(&seed).lo & 1: dy = -dy                                   ; 0x6FD11BE3..0x6FD11BFD
AI_ApproachTarget(pGame, pMonster, NULL, WL (2), x0 + dx, y0 + dy, stepNum = 1, flags = 0)   ; 0x6FD11C1B
```

RNG: 4 draws on `pMonster->pSeed` (axis, magnitude, x sign, y sign).

## 4. `MONSTER_StartMode` — `0x6FC95E10` (path part)

`__stdcall(pGame, pModeChange, bFlag)`, `ret 0xC`. For any mode other than GH (3), before the mode
callback:

```
if pModeChange->pTarget:  #10336 PATH_SetTargetUnit(pPath, pTarget)          ; 0x6FC95ECB
else:                     #10286 PATH_SetTargetPos(pPath, x, y)              ; 0x6FC95EDB
#10022 PATH_SetDistance(pPath, 20)                                           ; 0x6FC95EE7
0x6FC94F90(pMonster, pAiControl, pGame, pModeChange->[+0x18], bMoving, ...)  ; 0x6FC95F12
```

`0x6FC94F90`: `bMoving == 100` -> no path (attack / neutral modes); `101` -> path type 13
`PATHTYPE_TOWARD_FINISH` unless `pAiControl->[+0x18]` overrides it (then cleared, together with
`+0x1C`/`+0x20`); then `0x6FC94D50`:

```
#10168 PATH_SetNewDistance(pPath, nNewDist)        ; 0x6FC94D5C
#10647 PATH_SetType(pPath, nPathType)              ; 0x6FC94DA6
#10334 D2Common_10142(pPath, pUnit, 0)             ; 0x6FC94DAF
if failed and nPathType - 2 in {0, 5, 7, 11} (types 2, 7, 9, 13):          ; jump table 0x6FC94E2C
  #10647 PATH_SetType(pPath, 15 WALL_FOLLOW); #10334 D2Common_10142(...)    ; 0x6FC94E08 / 0x6FC94E11
```

TS: `MONSTER_MOVE_PATHTYPE_113C = 13` for RN/WL moves; the order is recorded row by row in
[`../engine/path-call-order-audit-113c.md`](../engine/path-call-order-audit-113c.md).

## 5. Attack timing and the melee hit

The attack mode starts with the AnimData frame accumulator at 0; every later server frame adds the
AnimData speed (scaled by attack-rate modifiers) and the action event fires once `accumulator >> 8`
reaches the event frame. Hence the hit resolves `ceil(eventFrame * 256 / speed)` frames after the
mode change.

Oracle evidence (`p52-paladin-auras`): zombie #9 enters A2 on frame 748 (`ZMA2HTH`: 16 frames per
direction, speed 256, event frame 9) and draws its to-hit roll on frame **757** = 748 + 9. The miss
emits no `SUNITDMG` event, only the single draw. The replica previously used `eventFrame + 1` (758).

The hit itself (`SUNITDMG`, see [`../combat/`](../combat/)) draws to-hit / damage / burn length on
`pAttacker->pSeed` (the monster) and block / avoid on `pDefender->pSeed` (the player). The replica
routes monster -> player swings through `executeSUnitDmg` with `d2AttackerSeed113c` = monster seed and
`d2DefenderSeed113c` = player seed when the DRLG oracle path is active.

Resolved: on a zombie hit that lands on the player (`p52-paladin-auras` frame 912) the oracle draws 4 times from
the player seed: block, then the armor-durability slot / weight / durability rolls of `SUNITDMG_ItemDurability`
(`0x6FCFEBA0` → `0x6FC32EE0`); the monster seed gets to-hit, the `FillPacket` damage roll, `RAND(1)` and the
`MonStats.crit` roll. See [`../combat/d2game-sunitdmg-player-defender-113c.md`](../combat/d2game-sunitdmg-player-defender-113c.md).

## 6. AI tick driver, target search and the idle throttle

`MonAI.txt` table `0x6FD2E788` (`{dwAiFlag, pfnInit, pfnThink, pfnExtra}`, stride 16, indexed by
`MonStats.wAI`): Zombie (row 3) = `{1, 0, 0x6FCA38B0, 0}`. The tick driver `0x6FCBD160` switches on `dwAiFlag`
(jump table `0x6FCBD20C`); flag 1 calls `0x6FD13220` and runs `pfnThink` only when it returns a target
(`0x6FCBD196..0x6FCBD1A9`).

`0x6FD13220(pGame, pMonster, &dist, &bInMelee)`:

```
target = AI_FindNearestPlayerOrAlly(...)                           ; 0x6FD13232 -> 0x6FCD1C90
if target: return target                                           ; -> pfnThink(pAiTick)
if (MonStats2 flag 2 && level/room conditions): AI_IdleWander(5)   ; 0x6FD13248..0x6FD132FD
else if dist >= 35: AI delay 25                                    ; 0x6FD1330F -> 0x6FD122C0(25)
else if dist <  25: AI delay 10                                    ; 0x6FD1332D
else:               AI delay dist - 10                             ; 0x6FD13341
```

`AI_FindNearestPlayerOrAlly` (`0x6FCD1C90`): radius = `MonStats.aidist[diff]` (byte `+0x52 + diff`,
`0x6FCD1D5D..0x6FCD1D6C`), 35 (`0x6FCD1D41`) when 0. For each player (`pGame + 0x10F8` lists, same act byte
`+0x18`, has a room) `d = UNITS_GetDistanceToCoordinates(pPlayer, monX, monY)` (`0x6FCD08F0`: plain octile
`(2 * max + min) / 2`, **no unit-size subtraction**); the minimum goes to `*pDist`; a player is a candidate only when
`d < 55` (`0x6FCD1DF7`) and `d < radius` (`0x6FCD1E10`, strict).

Oracle (`p52-barbarian-warcries`, zombie #11 at `5639,5784`): F=901 player at `5661,5810` -> `d = 37` (>= 35, AI
re-scheduled in 25 frames, 0 draws); F=926 player at `5661,5806` -> `d = 33` -> target -> AiZombie wanders (4 draws).
The size-subtracted distance (`0x6FCD0A20`) gives 34 at F=901, which woke the replica 25 frames early.

TS: initial `EVENTTYPE_MONAI` scheduling follows `D2GAME_SpawnMonsterInCurrentRoom` (`0x6FCCE3CB`: `+25` only when
`pRoom1->nNumClients > 0`, skipped when `0`) and `SUB_AddClientToRoom` (`0x6FCBD950 -> 0x6FCCF920`: `dwGameFrame + 2`
when a populated room transitions `hasClientNear: false -> true`, e.g. `224 + 2 = 226` in `p52-paladin-auras` /
`p52-barbarian-warcries` and `229 + 2 = 231` in `p52-item-defense`). Every AI tick of `stepDrlgMonsterAi113c` re-runs
the no-target branch of `0x6FD13220`: minimum plain distance over out-of-town players (`!DRLGROOM_IsInTown`
`0x6FCD1DCD`) `>= aidist` -> no think, AI delay 25 / 10 / `d - 10` (oracle `p52-paladin-auras` F=1363: zombie #11
wandered to `5629,5803`, `d = 35`, no draws). Not ported: the `IdleWander(5)` no-target branch (`0x6FD13248..0x6FD132FD`,
`pMonsterData+0x54 in {3, 0x13}` or `#10851(room, x, y, .., 0x40)`, plus MonStats2 mode bit 2), and the merc / pet
candidate lists of `0x6FCD1C90` (`0x6FCD1EF5..0x6FCD1FD5`).
