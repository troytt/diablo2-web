# D2Client 1.13c: S2C dispatch table, per-unit packet queue, interact/pickup sender, walk-adjust gate

Ground truth: `D2Client.dll` 1.13c (image base `0x6FAB0000`), static disassembly. Data: `Objects.txt`
(`samples/d2/Patch_D2.mpq` `data\global\excel\objects.txt`).

## 1. S2C dispatch table `0x6FB8DE60`

175 entries (`0x00..0xAE`), 12 bytes each: `{ pfnHandler, i32 size (-1 = variable), pfnUnitCallback }`.
Dispatchers: `0x6FB5CE20` (live stream) and `0x6FB5BC20` (per-unit queue drain). Opcodes `>= 0xAF` are rejected
by both (`cmp al,0xaf ; jae` @`0x6FB5BCA7` / `0x6FB5CE6E`) and handled by the system path `0x6FB5D450`.

Entries with a non-zero `pfnUnitCallback` and the no-op handler `0x6FB5C520`:

| Op | Callback | Op | Callback |
|---|---|---|---|
| 0x0C | `0x6FB5F5F0` (unit event, bytes @6,@7,@8) | 0x67 | `0x6FB5F460` |
| 0x0D | `0x6FB5F590` | 0x68 | `0x6FB5F3F0` |
| 0x0E | `0x6FB5F560` | 0x69 | `0x6FB5F390` (event @5, x@6,y@8, b@10, b@11) |
| 0x0F | `0x6FB5F510` | 0x6A | `0x6FB5F340` |
| 0x10 | `0x6FB5F4C0` | 0x6B | `0x6FB5F7C0` (drift check x@0xC,y@0xE then the 0x69 path) |
| 0x17 | `0x6FB5F240` (D2Net size 0: never framed) | 0x6C | `0x6FB5F750` |
| 0x4C | `0x6FB5F1D0` | 0x6D | `0x6FB5F2B0` (drift check, stat `0x148` += 1, unit event 7) |
| 0x4D | `0x6FB5F160` | 0x6E..0x72 | `0x6FB5C3C0..0x6FB5C380` (all `ret`) |

Pure no-op handlers (`ret`): 0x12 `0x6FB5C370`, 0x13 `0x6FB5C360`, 0x14 `0x6FB5C350`, 0x45 `0x6FB5C130`,
0x54 `0x6FB5C120`, 0x24/0x25 and every size-0 slot `0x6FB5C520`. Slot 0x80 has handler 0 (size 4; D2Net size 0).

### Per-unit packet queue

`0x6FB5CE20`: for an entry with a unit callback (`[ebp+8] != 0`) the target unit is looked up (0x67..0x6D:
monster table `0x6FBBA808` by id @1, type must be 1; others: type @1, id @2 via `0x6FB54E20`) and the raw packet
is **copied into the unit's queue** `unit+0xD8` (`0x6FB5C630`: `{cap, count, ?, buf}`, grows via `0x6FB5BDC0`).
The queue is drained by `0x6FB5BC20(unit)`, called at the end of the per-unit update (`call 0x6FB5BC20`
@`0x6FADB333`), i.e. after the unit's own animation step of that frame. The drain re-checks the size, calls
`pfnUnitCallback(unit, pkt)` for each queued packet in arrival order and then clears the queue.
Consequence: unit movement/mode packets are applied per unit at unit-update time, not interleaved with the
global packets of the same receive batch.

## 2. Interact / pickup sender `0x6FADAC10(cx = unitType, edx = unitId)`

Called from the local-player client event handler `0x6FAC9830` (arrival event `0x13`, @`0x6FAC9CB4`) and from
`0x6FB47823` (objects). Jump table `0x6FADAE14` on unit type:

| Type | Target | Behaviour |
|---|---|---|
| 0 player | `0x6FADADDC` | face target (`D2Common #10434`), send `0x13` (9 B) |
| 1 monster | `0x6FADADBC` | **per-unit 200 ms throttle**: `GetTickCount - unit[+0xD4] < 0xC8` -> no send; else store tick and send `0x13` |
| 2 object | `0x6FADAC54` | object flag `unit+0xC4 & 4` clear -> send `0x13` directly. Otherwise face the object, prepare the client operate animation (`0x6FB530C0`) and send `0x13`, with the class gates below |
| 3 missile | `0x6FADAD88` | send `0x13` |
| 4 item | `0x6FADADF4` | send `0x16` (13 B) `{u32 4, u32 id, u32 [0x6FBAAD84]}` (third dword = inventory panel open -> to cursor) |

Object class gates (class = `unit+4`, mode = `unit+0x10`, weapon = `D2Common #10061(pInventory)` = the item whose
GUID equals `pInventory+0x1C`, i.e. the wielded primary weapon; item code via `#10802`):
- `Objects.txt` 404 `compellingorb`: mode 0 requires wielded weapon code `qf2 ` (`0x20326671`); otherwise the
  client plays character sound event 19 "impossible" (`push 0x13 ; call 0x6FAD3200`) and **sends nothing**.
  Mode != 0 -> normal path.
- `Objects.txt` 376 `Hellforge`: mode 0 -> sends `0x13` immediately through `0x6FAC4910` (no operate animation);
  mode 2 requires wielded `hfh ` (`0x20686668`), else "impossible" sound and no packet; other modes -> normal path.

## 3. Walk adjust / hold gate `0x6FAC86A0`

`|dx| >= 0x100 || |dy| >= 0x100` -> reject (`0x6FAC873C`/`0x6FAC874F`); `dx == dy == 0` -> reject;
`dist = max(1, approx(dx,dy))` (`0x6FB587B0`); minimum step from the ClickInfo flags `[ebp]`: `0x04` (press) ->
`run(0x40) ? 5 : 3`; `0x08` (hold) -> `4 | run`; `0x10` -> 0; a closer click is pushed out to that distance
(x87 `fidiv`/`fmul`, `_ftol`). For the player unit in mode 2/3/6 with the hold flag, `(frame - [0x6FBD34C4]) < 7`
-> reject without updating; otherwise `[0x6FBD34C4] = frame` (`0x6FAC8820..0x6FAC885A`).

## 4. Other handler notes

- 0x18 `0x6FB5ECA0` / 0x95 `0x6FB5EBE0`: after setting stats 6/8/10 (`<<8`) (+74/26 for 0x18) and the drift check,
  `life != 0 && player mode == 17` -> `0x6FADA6C0(mode 5)` (clears `unit+0xC4` bit 0x40, sets mode 5 TNEUTRAL
  unconditionally) then `0x6FB56210`. Mode 0 is not checked.
- 0x0A `0x6FB5CA40`: a type-1 removal is ignored when the id equals the unit id of the local player's pet-list
  entry of type 7 (hireling) owned by the local player (`0x6FBCC4D4`, `[e+4]==7`, `[e+0xC]==self id`, id `[e+8]`).
  No life/dead check.
- 0x93 `0x6FB5D3D0`: walks the player's skill list (`0x6FB50C40`); the D2Game builder `0x6FCAB540` has no direct
  callers in 1.13c.
- 0x97 `0x6FB5BF50`: toggles UI flag `0x6FBCBC94` only when `0x6FABBF8C()` and expansion `0x6FBC9854` are non-zero.
- C2S 0x4B: sent by `0x6FADB1E0` for a **non-local** unit whose `unit+0xC4` bit 23 and `unit+0xC8` bit 5 are set
  (then both cleared); the local player is excluded (`cmp [0x6FBCBBFC], esi ; je` @`0x6FADB1EC`).
