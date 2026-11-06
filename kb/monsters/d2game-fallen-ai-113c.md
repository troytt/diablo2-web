# D2Game 1.13c `AiFallen` (`0x6FCA3130`), party spawner and `pAiGeneral` group commands

Port of the `MonAI.txt` row 6 `Fallen` (MonStats `AI = Fallen`: `fallen1..8`) and of the spawn-side party
logic that creates Fallen packs. Every address is a `D2Game.dll` 1.13c VA (base `0x6FC20000`); D2Common
calls are written as `#ordinal`. TS port:
[`fallen-ai-113c.ts`](../../src/server/engine/game-instance/fallen-ai-113c.ts) (`stepFallenThink113c`),
[`room-populate-113c.ts`](../../src/server/world/room-populate-113c.ts) (`spawnPartyMinions113c`, death ring),
dispatched from `stepDrlgMonsterAi113c`
([`monster-combat-ai.ts`](../../src/server/engine/game-instance/monster-combat-ai.ts)).

Think table: `0x6FD2E788 + 6 * 16` = `{ dwAiFlag 1, init null, think 0x6FCA3130, extra null }`
([`d2game-monai-dispatch-table-113c.md`](./d2game-monai-dispatch-table-113c.md)). Flag 1 uses the same
"no player inside `aidist`" skip tick as the Zombie ([`d2game-zombie-ai-113c.md`](./d2game-zombie-ai-113c.md) §6).

Verification: `npx tsx tools/oracle/trace-window.ts a1c-bloodmoor-fallen --unit 1:12` (Fallen pack
#12 leader, #13..#15 party). Golden: `tests/fixtures/oracle/golden/a1c-bloodmoor-fallen.oracle.ndjson.gz`.

## 1. Spawn: random packs and the party spawner

### 1.1 Room pack (`0x6FC67A20` → `0x6FC67700`)

`0x6FC67BB9`: `0x6FC66D40(hcIdx)` returns 1 when `MonStats.BaseId` (`+0x02`) is 19 (`fallen1`) or 91
(`scarab1`). Then the group size passed to `0x6FC67700` is `(1, 1)` instead of `(MinGrp, MaxGrp)`.
`0x6FC67700` spawns the leader (`0x6FD0F510`, flags 0), then draws
`count = (min - 1) + rollLimited(&leader->pSeed, max - min + 1)` (`0x6FC677CD..0x6FC677E1`). It always
draws one value, even for `(1, 1)`. It then spawns `count` group members with `0x6FD0F570` (flags 0,
3 ring steps).

### 1.2 Party spawner `0x6FD0E480` (end of `MONSTER_Create` `0x6FD0EF10`, call `0x6FD0F41B`)

It runs for every created monster unless spawn flag `0x40` is set. That includes the pack leader and
every group member.

```
row = MonStats[hcIdx]; if row.minion1 (+0x26) < 0: return
if BaseId == 0x105 (tentaclehead1): separate branch 0x6FD0E527..0x6FD0E5F0   ; not ported (throws)
if row SetBoss bit (+0x0C & flags[+0x10]): 0x6FC40D90(leader): pAiGeneral +0x28 group, +0x2C self id, +0x30 1
maxIdx = row.minion2 (+0x28) valid ? 1 : 0
count = PartyMin (+0x2C) < PartyMax (+0x2D) ? PartyMin + rollLimited(&leader->pSeed, PartyMax - PartyMin + 1)
                                            : PartyMin                       ; 0x6FD0E623..0x6FD0E644
repeat count: m = 0x6FD0DDB0(leader, minion[idx], ring steps 4, flags 0x40)  ; same ring search as group members
              if SetBoss: m.pAiGeneral -> leader (+0x2C id, +0x30 1), 0x6FC40CF0(leader, m) prepends m to +0x34
              idx = idx + 1 > maxIdx ? 0 : idx + 1
```

Oracle: the Blood Moor pack at seed 12345 is leader #12 + party #13..#15 (`PartyMin/Max` 2/3 → 3). The
previous generic `MinGrp..MaxGrp` model placed only 3 Fallen (first divergence F689).

## 2. Death ring (`#10873` `0x6FD8AFD0`)

At the monster death-mode start (`0x6FC962FC..0x6FC96302`), `#10873(GetRoom(pMonster), unitId)` stores the
id at `room+0x38[idx]` and sets `idx = (idx + 1) & 3` (byte `room+0x14`). Each room keeps the last 4 deaths.
TS: `recordMonsterDeath113c` / `recentDeathIdsNear113c`.

## 3. Think `0x6FCA3130`

`__fastcall(ecx = pGame, edx = pMonster, [esp+4] = pAiTick)`. `A = pAiTick->[0]` is the per-monster AI
block (`A+0x14` = "afraid"). `pAiTick +0x08` target, `+0x14` distance, `+0x18` in melee range, `+0x1C`
MonStats row.

```
if mode in {0 DT, 12 DD}: return
free pending type-2 events
for room in adjacent rooms (#10331 room, 0x6FC2A55C list)          ; 0x6FCA31A5..0x6FCA3285
  for id in room+0x38[0..3]:
    u = monster by id; if u && u.mode == 0 && 0x6FCD08F0(u, x, y) < 15:
      A+0x14 = 1; 0x6FC40EC0(pop command); pAiControl+0x1C = 50
      if 0x6FD12D80(target, pMonster, 12, 1):                      ; flee, see §4
        if lo % 20 < 1: unit sound event 0x11 (0x6FCFFFD0, no draw)  ; 1 draw
        return
      goto think                                                   ; (stops scanning)
think:
if mode != NU: stall(10); return                                   ; 0x6FCA328F
if pAiGeneral->+0x20 (command stack head):                         ; 0x6FCA32BF
  if head.type (+0x08) != 1: pop; stall(10); return
  if inMelee: lo%100 < aip3 ? (lo%100 < aip4 ? A1 : A2) : stall(5); return
  if !ApproachTarget(target, WL, 0, 0, 1, 0): pop
  return
if !inMelee && pMonsterData+0x54 in {3, 0x13}: ApproachTarget(target, WL, 0, 0, 1, 0); return
if dist < 15 && leader(pMonster) == pMonster && lo%100 < aip1:     ; 0x6FCA335C
  cmd.type = 1; 0x6FC412F0 (push to every minion of the leader); 0x6FC41290 (push to self)
  StartMode(S2, target); return                                    ; war cry
if inMelee:
  if !A+0x14 && lo%100 >= aip3: (lo%100 < 30 ? StartMode(S2, target) : stall(10)); return
  A+0x14 = 0; lo%100 < aip4 ? A1 : A2; return
if dist > aip2: lo%100 < 30 ? AI_IdleWander(3) : stall(10); return
ApproachTarget(target, WL, 0, 0, 1, 7)
```

`stall(n)` = `0x6FD122C0`; `ApproachTarget` = `0x6FD12540`; failure flags: `4` frees type-2 events, `1`
sets `pAiGeneral+0x08 |= 0x40`, `2` draws `lo%100 < 70 ? wander(4) : stall(10)`.

### RNG consumption (`pMonster->pSeed`)

| Branch | Draws |
|---|---|
| flee started | 1 (`% 20`) |
| command + melee | 1 (`aip3`), +1 (`aip4`) on attack |
| leader war cry check | 1 (`aip1`) |
| melee, not afraid | 1 (`aip3`), then +1 (`< 30` S2) or +1 (`aip4` attack) |
| melee, afraid | 1 (`aip4`) |
| far (`dist > aip2`) | 1, + 4 when it wanders |
| approach with flags 7 failing | 1 (`< 70`), + 4 when it wanders |

## 4. Flee `0x6FD12D80(pFrom, pGame, pMonster, n, bFlag)`

`sx = sign(monster.x - from.x)`, `sy = sign(monster.y - from.y)` (0 when equal). If `n > 5`:
`pAiControl+0x20 = min(n, 0x4D)` (path new distance). Then
`AI_ApproachTarget(NULL, WL, mx + n*sx, my + n*sy, 1, bFlag ? 4 : 0)`. Returns 0 when there is no target.
The `pAiControl+0x1C = 50` set by `AiFallen` is a velocity bonus for the whole WL move (TS: `runVelocityBonus`,
applied by the DRLG move step for every mode).

## 5. `pAiGeneral` group commands

- `0x6FC41260(pUnit)`: the group leader unit (`+0x2C` id, `+0x30` type) when `+0x28` is set.
- `0x6FC40F30`: allocates a 0x1C-byte node in the circular list at `+0x20/+0x24`. The caller makes the new
  node the head, so the list works as a stack. The command copy starts at node `+0x08` (type).
- `0x6FC412F0(pUnit, pGame, &cmd)`: for every id in the leader's `+0x34` minion list, push `cmd`.
  `0x6FC41290` pushes it to the unit itself.
- `0x6FC40EC0`: pop the head (clear `+0x20/+0x24` when it was the only node).

TS: `groupLeader113c`, `groupMinions113c` (newest first), `aiCommands113c` (stack).

## 6. Frame order

Resolved by the route-2 pilot
([`../engine/d2game-event-wheel-and-room-units-113c.md`](../engine/d2game-event-wheel-and-room-units-113c.md) §6).
In the monster partition of `EVENT_UpdateTimers`, moving monsters' persistent mode updates run first,
newest move first. The frame's slot events follow in scheduling order (AI thinks, mode ends, DT → DD).

- At F821, `#13`'s path ends inside its update before `#12`'s DT-end slot event.
- At F790, `#14` updates before `#15` because it registered its move later.

TS: `runDrlgMonsterEventPhase113c` (`frame-and-commands.ts`) replaces the earlier post-loop DT → DD
workaround and the unit-id order.

## 7. Open items

- `pMonsterData+0x54 in {3, 0x13}` ("always chase") uses the zombie stand-in (Taunt state 54).
- `pAiGeneral+0x08 |= 0x40` (approach failure flag 1) is not modelled.
- A failed StartMode queues no AI event in the original; the replica re-thinks after `aidel`.
- Tentaclehead party branch `0x6FD0E527` and the S2 sound event are not ported.
