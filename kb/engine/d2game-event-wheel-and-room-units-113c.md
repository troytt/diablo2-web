# D2Game 1.13c event wheel, room unit lists and mode events (route-2 pilot, step 0)

Step 0 of [`../../docs/oracle/route2-pilot.md`](../../docs/oracle/route2-pilot.md): locate the structures
behind the unit update order. All addresses are 1.13c preferred-base VAs (D2Game `0x6FC20000`,
D2Common `0x6FD50000`).

## 1. Event node (`0x6FCAE680` allocate, `0x6FCAE6F0` free)

`0x6FCAE680(eax = pGame, ecx = pUnit)` takes a node from the pool at `pGame+0xB8` (`0x6FCAE540`) and
links it into the unit's event list.

| Offset | Field | Evidence |
|---|---|---|
| `+0x00` (byte) | event type (`< 15`) | `0x6FCAEB04` |
| `+0x02` (byte) | flags: `0x01` firing, `0x02` cleared on alloc, `0x04` persistent, `0x08` free after a persistent fire | `0x6FCAEBFB`, `0x6FCAE825`, `0x6FCAEC96` |
| `+0x04` | expire frame (`-1` = persistent, fires every frame) | `0x6FCAEB06`, `0x6FCAE838` |
| `+0x08` | `pUnit` | `0x6FCAE692` |
| `+0x0C` | unit id (`-1` without a unit) | `0x6FCAE6E0` |
| `+0x10` | unit type (6 without a unit) | `0x6FCAE6C0` |
| `+0x14` / `+0x18` | handler arguments | `0x6FCAEAFD` / `0x6FCAEB09` |
| `+0x1C` / `+0x20` | wheel links (see §2) | `0x6FCAEB3E..0x6FCAEB51` |
| `+0x24` / `+0x28` | unit event list next / prev; the list head is `unit+0xDC` (head insert) | `0x6FCAE6A3..0x6FCAE6B8` |
| `+0x2C` | handler override (`fastcall(pGame, pUnit, type, arg14, arg18)`), else the per-unit-type default | `0x6FCAEB0C`, `0x6FCAEBF8` |

## 2. Wheel layout and `EVENT_SetEvent` (`0x6FCAEA80`)

`EVENT_SetEvent(ecx = pGame, edx = pUnit, stack: type, frame, handler, arg14, arg18)`, `ret 0x14`:

- `type >= 15`: ignored.
- `frame == -1`: persistent list (`0x6FCAE810`).
- `frame <= pGame+0xA8`: becomes `frame + 1`.
- Monster, type 2 and state `0x36`: `0x6FD02240(pUnit, 0)` first.

`partition = 0x6FD1A3DC[unitType]`: player 0, monster 1, object 3, missile 2, item 4, tile `-1`,
none 0. The timer block is `T = pGame+0xB8`:

| Array | Address | Meaning |
|---|---|---|
| head | `T+0x504 + (partition*64 + (frame & 63))*4` | newest node; `node+0x20 = old head`, `old head+0x1C = node` |
| tail | `T+0x004 + (partition*64 + (frame & 63))*4` | set only when the slot was empty (oldest node) |
| persistent | `T+0xA04 + partition*4` | head insert, `node+0x1C = old head` (`0x6FCAE85D..0x6FCAE877`) |
| current slot | `T+0x000` | `frame & 63`, written by `EVENT_UpdateTimers` |
| saved next | `T+0xA18` | next node saved before a handler runs |

## 3. `EVENT_UpdateTimers` (`0x6FCAF070`)

The partition order is fixed. For each partition the persistent list runs first, then the slot list:

1. missiles (`0x6FCAE9A0`, persistent `T+0xA0C`, slot `T+0x204`)
2. players (`0x6FCAECC0`, `T+0xA04`, `T+0x004`)
3. monsters (`0x6FCAEBC0`, `T+0xA08`, `T+0x104`)
4. objects (`0x6FCAEF20`, `T+0xA10`, `T+0x304`)
5. items (`0x6FCAEDD0`, `T+0xA14`, `T+0x404`)

Walk order (monster processor `0x6FCAEBC0`):

- **Slot list**: starts at the tail and follows `+0x1C`, oldest first, so it is **FIFO**. Only nodes
  with `+0x04 == frame` fire; nodes of a later lap stay. A fired node is freed.
- **Persistent list**: starts at the head and follows `+0x1C`, newest first, so it is **LIFO**. It fires
  every frame and is freed only with flag `0x08`.

The FIFO statement in
[`../combat/d2game-statregen-dot-113c.md`](../combat/d2game-statregen-dot-113c.md) §1 is confirmed. The
storage is a head insert plus a tail pointer, walked from the tail.

## 4. Monster event types (`0x6FC969A0`, handlers `0x6FD1BC14[type]`)

| Type | Handler | Use |
|---|---|---|
| 0 | `0x6FC952E0` | mode event: `0x6FC949A0(pUnit, mode)` entry `+0x04` callback, else `0x6FC950F0` |
| 1 | `0x6FC952A0` | mode end: entry `+0x08` callback, else `0x6FC950F0` |
| 2 | `0x6FCBD3B0` | AI think driver `AIGENERAL_Think` |
| 3 | `0x6FC96740` | `MONSTER_Event3_HpRegen` |
| 5 / 6 / 7 / 8 / 9 / 10 / 12 | `0x6FCBE8E0` / `0x6FC96570` / `0x6FC469B0` / `0x6FCC1E80` / `0x6FCC37D0` / `0x6FC94E40` / `0x6FC94870` | to identify |

Types 4 and 7..12 first check state 1 (`#10494(pUnit, 1)`) and that the unit is alive (`0x6FCFFA90`).

Consequence for the replica: a monster's mode end (DT → DD included) and its AI think are events of the
same monster partition. They fire FIFO by **scheduling order**, not by unit id or room order. This is the
mechanism to model for the `a1c-bloodmoor-fallen` F790 / F821 ordering
([`../monsters/d2game-fallen-ai-113c.md`](../monsters/d2game-fallen-ai-113c.md) §6).

## 5. Room unit lists (D2Common)

| Ordinal | VA | Function |
|---|---|---|
| `#10531` | `0x6FDB6800` | `UNITROOM_AddUnitToRoom(pUnit, pRoom, b)`: **head insert** (`unit+0xE8 = room+0x74`, `room+0x74 = unit`), then `#10158`; counts players in `room+0x28` |
| `#11016` | `0x6FDB6700` | `UNITROOM_RemoveUnitFromRoom(pUnit)` |
| `#10158` | `0x6FDB65C0` | `UNITROOM_RefreshUnit`: sets `unit+0xC4 |= 0x2000` and links `unit+0xE0` into the room's update list at `+0x1C` |
| `#10821` | `0x6FDB6350` | unit in room list |
| `#10384` | `0x6FDB64B0` | bubble sort of `room+0x74` by Y. Not imported by D2Game (client draw order only). |

The TS path port already calls these through `PATH_SetUnitRoomCallbacks`
([`../../src/common/path/path.ts`](../../src/common/path/path.ts)), but no engine installs them yet. D2Game
imports `#10531` once (`0x6FD01061`, unit creation) and `#11016` 18 times. D2Common's path code calls
both on room change (`0x6FD5D72F..0x6FD5D7FF`, `0x6FD861F2`).

## 6. Oracle order log (`orderlog`, a1c-bloodmoor-fallen F760..F840)

Hook directive `orderlog FROM TO` (`tools/oracle/hook/d2oracle.c`, scenario key `oracleOrderLog`) patches
three call sites and writes the trace key `ord`, one entry `[kind, eventType, unitType, unitId, mode]` per
call:
- kind 1: the monster slot-list default handler call `0x6FCAEC25`;
- kind 2: the persistent-list call `0x6FCAEC89`;
- kind 3: `#10226` from `0x6FCC02B1`.

The probe trace is byte-identical to the golden in every other key (840/840 frames), so the
instrumentation does not change behaviour.

Findings:

1. **A moving monster's per-frame update is a persistent type-0 event** (174 calls, mode 2), and it runs
   before the slot list. The list order is LIFO by registration: a unit that starts a new move goes to
   the head. Example: at F807 `#15` gets its AI event (`[1, 2, 1, 15, 1]`) and starts walking; from F808
   it is first (`[15, 14, 13]`). At F803 `#14` restarts its path and moves ahead of `#13`.
2. **AI thinks are type-2 slot events** (FIFO by scheduling, 21 calls). Mode ends are type-1 slot events:
   `#12`'s DT end is `[1, 1, 1, 12, 0]` on F821.
3. **F821 explained.** Order: persistent `15, 14, 13` (`#13`'s path ends inside its update, it thinks
   and flees because `#12` is still DT), then the slot event that switches `#12` DT → DD. The replica's
   post-loop DT → DD workaround matches this order by accident.
4. **F790 explained.** The persistent order flips from `[15, 14, 12]` to `[12, 14, 15]`: all three
   restarted their moves, `#12` last. `#14` steps before `#15`, so the replica order (unit id) happens to
   be right there, and the global descending order was wrong.
5. kind 3 never fired. The monster WL step does not go through `0x6FCC00B0 → #10226` in this scenario.
   The caller of the persistent type-0 callback is the monster mode table entry `+0x04`
   (`0x6FC949A0`), still to be dumped.

Model for the replica (pilot step 4): the monster phase of a frame is (a) the persistent mode updates of
moving units, newest registration first, then (b) the slot events of the frame (AI thinks, mode ends,
Event 3, ...) in scheduling order.

## 7. Open

- Dump the monster mode tables used by `0x6FC949A0` (entry `+0x04` per-frame update, `+0x08` mode
  end) and the registration site of the persistent event (`0x6FCAE940` / `0x6FCAE960`, called
  indirectly).
- Player, missile and object partitions: same order log extension.
