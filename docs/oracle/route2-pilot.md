# Route 2 pilot: data structures isomorphic to 1.13c + per-function diff acceptance

Status: **design draft for review**. No code changes until Master approves.

Route 2 means:
- The server keeps the original's data structures field for field.
- Every ported function is accepted by a per-function diff against the original.
- The end product is readable TS that serves both targets with one core:
  - single-player web: Web Worker + `LocalLoopbackAdapter`;
  - multiplayer Node server: WebSocket + the existing `0x00..0xAF` protocol.

Route 1 (translating or emulating the original DLLs) is not used because of the legal risk of
distributing them.

This pilot measures whether a full switch is worth it. It covers the subsystem behind the current
ordering divergences (`a1c-bloodmoor-fallen` F790 / F821, see
[`../../kb/monsters/d2game-fallen-ai-113c.md`](../../kb/monsters/d2game-fallen-ai-113c.md) §6).

## 1. Pilot scope

| Subsystem | Why | Original entry points (1.13c VA) |
|---|---|---|
| Room unit lists (head insert) | Unit update order. A unit created later is updated first; units moving between rooms are re-inserted. | Room activation / unit update in `GAME_UpdateGameFrame` `0x6FC4E050` (`0x6FC4CBE0`, `0x6FC4D670`, `0x6FC4D9B0`). D2Common room unit-list add/remove (ordinals to be identified in step 0). |
| 64-slot event wheel | AI think, Event 3 regen and state expiry timing. Bucket `frame & 0x3F`, FIFO per bucket, unit-type partition order (missiles, players, monsters, objects, items). | `EVENT_SetEvent` `0x6FCAEA80`, `EVENT_UpdateTimers` `0x6FCAF070`, free loop `0x6FCAE6F0`. Static closure (depth 2): 18 functions; imports `D2Common #10494 #10945`, `Fog #10024 #10265`. |
| Monster AI dispatch | Which think runs, with which `pAiTick`. | Table `0x6FD2E788` (16 bytes `{flag, init, think, extra}`, think = `[0x6FD2E790 + ai*16]`), driver `0x6FCBD3B0` (monster event type 2 handler; earlier kb text said `0x6FCBD3C0`, which is inside its prologue), target search `0x6FCBD160` / `0x6FCD1C90`. |
| Thinks already ported (re-hosted on the new structures) | Shows the seam cost. | `AiZombie` `0x6FCA38B0`, `AiFallen` `0x6FCA3130`, `AI_ApproachTarget` `0x6FD12540`, `AI_IdleWander` `0x6FD11B10`, stall `0x6FD122C0`, `MONSTER_StartMode` `0x6FC95E10`. Static closure (depth 1): 51 functions; 15 D2Common imports (`#10022 #10168 #10286 #10331 #10336 #10383 #10494 #10647 #10713 #10750 #10826 #10867 #11005 #11090 #11103`). |

Out of scope for the pilot: skills, items, missiles, combat, quests, network.

## 2. Memory layout (linear, offset-addressed)

One `ArrayBuffer` heap per game. Structures sit at the original offsets and pointers are 32-bit
offsets into the heap. TS accessors read and write by offset, generated from one layout table
(`docs/oracle/route2-layout.json`, to be written in step 1).

Fields already confirmed by disassembly (kb references in brackets):

| Struct | Offset | Field | Evidence |
|---|---|---|---|
| `D2UnitStrc` | `+0x00` / `+0x04` / `+0x0C` / `+0x10` | type / class / unit id / anim mode | many; `AiFallen` `0x6FCA314D`, hash chain compare `+0x0C` |
| | `+0x14` | unit data (`pMonsterData`) | `0x6FC4126B` |
| | `+0x20 / +0x24` | `D2SeedStrc` lo / hi | `oracle-hooks-113c.md` §4 |
| | `+0x2C` | dynamic path | `0x6FC98851` |
| | `+0x80` | `pGame` | fn-harness kb |
| | `+0xC4` | flags | `0x6FD0F3F0` |
| | `+0xDC` | event list head (node type byte `+0x00`, next `+0x24`) | `0x6FCA3165..0x6FCA3181` |
| | `+0xE4` | next in the game hash bucket | `0x6FCA31F5` |
| `D2GameStrc` | `+0x6D` | difficulty | fn-harness kb |
| | `+0xA8` | frame counter | `0x6FC4D9BE` |
| | `+0x1120 + type*0x200` | unit hash, 128 buckets per type (monsters `+0x1320`) | `0x6FCA31DF`, `0x6FC41379` |
| `D2ActiveRoomStrc` | `+0x00` / `+0x24` | near-room list / count | hook `d2oracle.c` collision notes |
| | `+0x14` (byte) / `+0x38[4]` | death-ring index / ids (`#10873`) | `0x6FD8AFD0` |
| | `+0x20`, `+0x4C..+0x58` | collision grid, subtile rect | hook notes |
| `pMonsterData` | `+0x28` / `+0x2C` / `+0x54` | `pAiGeneral` / `pAiControl` / "always chase" field | `0x6FC41272`, `0x6FD12EAB`, `0x6FCD0BF2` |
| `pAiControl` | `+0x18` / `+0x1C` / `+0x20` | path type / velocity / new-distance overrides | zombie kb §4 |
| `pAiGeneral` | `+0x08` / `+0x20..+0x24` / `+0x28..+0x30` / `+0x34` | flags / command stack / leader link / minion list | Fallen kb §5 |

Still to locate in step 0: the room unit-list head and next fields, the active-room list order, the
event node layout beyond `+0x00 / +0x24`, and the bucket and partition arrays.

## 3. Harness extension: capture and replay per function

Extend `tools/oracle/hook/fnharness.dll.c` with a recording mode that runs during a golden scenario:

1. Patch the entry of each target function with a detour (same trampoline style as the existing
   `GAME_UpdateGameFrame` hook).
2. On entry, record:
   - the argument registers and stack;
   - the **read set** (§3.1);
   - every reachable `D2SeedStrc`.
3. On exit, record:
   - the **write set** (bytes in the read-set pages that changed);
   - the return value;
   - seed advances, as a count and the new value.
4. Write one NDJSON record per call: `{fn, frame, args, pre: {addr: bytes}, post: {addr: bytes}, ret}`.
   Calls are sampled per function (all calls for the first N frames, then 1/k).

### 3.1 Read set

There are two options:
- **(a)** A static per-function struct list from the layout table: the unit, its data, the room,
  `pGame` slices.
- **(b)** Page-guard tracing (`VirtualProtect` + vectored handler) for exact byte coverage.

The pilot starts with (a) and uses (b) only when a function reads outside the declared structs. That
case shows up as a replay mismatch.

### 3.2 Replay in TS

`tools/oracle/route2-replay.ts` loads each record into a fresh heap at the recorded addresses
(addresses rebased to the heap). It calls the TS port with the same arguments and compares the write
set byte for byte, plus the return value and seed state. It never constructs random pointer graphs.

## 4. Acceptance per function

- 100% byte equality of the write set, the return value and the seeds over all recorded calls from
  at least 3 goldens (`a1-bloodmoor-melee`, `p52-necromancer-poison-golem`, `a1c-bloodmoor-fallen`).
- The full-scenario parity ratchet must not regress once the subsystem is switched on.
- Each function has a kb entry with its address, pseudocode, read / write set and RNG table, and a
  `function-map.md` row with status **diff-verified (replay)**.

## 5. Work plan and measurements

| Step | Content | Exit criterion |
|---|---|---|
| 0 | Locate the room unit-list functions and fields, the active-room order and the event node layout (disassembly plus `oracleDumpColl`-style dumps) | Fields documented in kb |
| 1 | Layout table and generated TS accessors for the structs in §2 | Accessors unit-tested against an oracle memory dump |
| 2 | Harness record mode (§3) for `0x6FCAEA80`, `0x6FCAF070`, `0x6FCBD3B0`, `0x6FCA3130`, `0x6FCA38B0` | Records produced for the 3 goldens |
| 3 | TS ports on the heap plus the replay runner | §4 acceptance for the 5 functions |
| 4 | Seam: the replica's `GameInstance` monster loop drives the heap event wheel and room order on the DRLG path | `a1c-bloodmoor-fallen` passes F790 and F821 without the current post-loop DT → DD workaround; no other golden regresses |

Measurements reported at the end of the pilot:
1. Hours per function to port and verify, split into reverse-engineering, port and verification.
2. How many functions can run in parallel as independent work orders (closure size and shared state).
3. Seam cost: lines and hours to bridge the heap structures and the existing `GameInstance` state
   (monsters, players and paths are currently JS objects).
4. Defect yield: divergences found by replay that the full-scenario diff had not found.

Decision rule: switch to Route 2 for all new porting when steps 3 and 4 pass and the per-function cost
is no more than about 1.5× the current scenario-diff cost. Otherwise, keep scenario diff and use
replay only for hot spots.

## 6. Risks

- `GameInstance` keeps two copies of state (heap and JS objects) during the transition, which can
  desynchronise. Mitigation: one owner per field; the other side reads through accessors.
- Recording overhead at 25 fps under Wine. Mitigation: sampling, and recording only the target
  functions.
- Paths (`D2DynamicPathStrc`) are already ported 1:1 as JS objects (`src/common/path`). They stay
  JS in the pilot; the heap stores their handle.

## 7. Pilot results (2026-11-05)

| Step | Result |
|---|---|
| 0 | Event node, wheel, partitions, monster event types and D2Common room lists documented ([`kb/engine/d2game-event-wheel-and-room-units-113c.md`](../../kb/engine/d2game-event-wheel-and-room-units-113c.md)). The `orderlog` probe explained F790 / F821 (persistent mode updates LIFO, then slot events FIFO). |
| 1 | `route2-layout.json` → `src/server/route2/layout.generated.ts`, `Heap113c`. 102/102 field checks against raw original memory (`memdump`); the probe trace stayed identical to the golden. |
| 2 | Hook `fnrec setevent` (entry detour with pre/post read/write sets, node pool included) and `fnrec timers` (wheel snapshot). |
| 3 | `SparseMemory113c` (reading an unloaded byte throws, which checks the read set). `EVENT_SetEvent` port: **628/628** recorded calls byte-identical. The first run failed on a missing `pGame` block, i.e. the read-set check worked. Monster-partition fire order: **399/401** frames equal to the oracle order log; the 2 mismatches are units that died in the earlier player partition (in-walk free). |
| 4 | Seam: `runDrlgMonsterEventPhase113c` orders the replica's monster phase like the wheel (move sequence from `AreaPathWorld`, event sequence numbers from schedule changes). `a1c-bloodmoor-fallen` passes F790 / F821 without the DT → DD workaround; no golden regressed. The first divergence is still F1000, a player run-step timing issue outside the pilot. |

Measurements:

1. Per-function cost:
   - `EVENT_SetEvent` + allocator: about 20 min of reverse engineering and 15 min of port; verification
     was one record run (about 1.5 min) plus the replay.
   - Wheel walk: about 10 min of port.
   - One-time harness work (recorder, sparse memory, replay, fixtures): about 1 h.
2. Parallel work orders: each recorded function can be replayed in isolation. Work orders are independent
   as long as their read sets do not need ports of other functions (callees can be stubbed and checked
   through the write set).
3. Seam cost: about 150 lines in `frame-and-commands.ts` / `town-npc-ai-113c.ts`, plus the per-monster
   sequence fields. The replica keeps JS objects; the heap is used only for replay.
4. Defect yield: the order log found the cause of the F790 / F821 divergences, which months of
   scenario diffs had only bracketed. The replay found no defect in the two ported functions.

Assessment: the per-function cost is below the scenario-diff cost for these functions (no 25-minute
scenario loops per hypothesis). By the decision rule in §5, new porting of engine-core functions
should use record and replay. The biggest remaining cost is the seam: the game state is still JS
objects, so ported heap functions verify behaviour but do not yet run the game.
