# A/B Representation Form Benchmark: 1.13c Event Wheel (`D2TimerStrc` / `D2EventStrc`)

**Task**: Milestone 31 `[K0]` — Decision 3 Representation Evaluation  
**Harness**: `tests/oracle/ab-eventwheel.test.ts`  
**Production Kernel**: `src/d2kern-113c/game/timer-wheel.ts`, `src/d2kern-113c/mem/layout.generated.ts`  
**Ground-Truth Fixtures**:
- `tools/oracle/vectors/eventwheel-113c.d2tv` (`256` multi-frame scenarios, `45,101` fired events emitted by original `D2Game.dll`)
- `tests/fixtures/oracle/route2/a1c-fnrec-setevent-f700.ndjson.gz` (`94` live `D2Game.dll` `EVENT_SetEvent` pre/post memory snapshots, including `nType == 2` monster AI `state 0x36` checks)
- `tests/fixtures/oracle/route2/a1c-fnrec-timers-f785.ndjson.gz` + `tests/fixtures/oracle/route2/a1c-ord-f785.ndjson.gz` (`41` live `D2Game.dll` `EVENT_UpdateTimers` pre-walk memory snapshots cross-checked against recorded `D2Game.dll` dispatch order log)

---

## 1. Binary Ground-Truth Structure (`D2Game.dll`, base `0x6FC20000`)

Both Candidate A and Candidate B implement the complete 1.13c server event wheel (`0x6FCAE420..0x6FCAF150`), not a simplified single-ring queue:

1. **`D2TimerStrc` (`0xA20` = `2,592` bytes, allocated at `0x6FCAE630`, pointed to by `D2GameStrc + 0xB8`)**:
   - `+0x000`: `nCurrentSlot` (`uint32`, `dwGameFrame & 63`)
   - `+0x004..+0x503`: `pSlotTail[320]` (`5` unit-type partitions × `64` frame-modulo slots; oldest node in FIFO slot)
   - `+0x504..+0xA03`: `pSlotHead[320]` (`5` unit-type partitions × `64` frame-modulo slots; newest node in FIFO slot)
   - `+0xA04..+0xA17`: `pPersistentHead[5]` (`5` LIFO heads for `dwFrame == 0xFFFFFFFF` per-frame events)
   - `+0xA18`: `pSavedNext` (`D2EventStrc*`, re-entrant iteration cursor updated in `EVENT_FreeNode` at `0x6FCAE6F0` whenever an active handler deletes the next queued node)
   - `+0xA1C`: `pPool` (`void*`, head of `0x7088`-byte pool chunks: `600 × 0x30` nodes + `+0x7080 pFreeHead` + `+0x7084 pNextChunk`, allocated at `0x6FCAE420`)
2. **`D2EventStrc` (`0x30` = `48` bytes)**:
   - `+0x00`: `nType` (`uint8` / `uint16` padded), `+0x02`: `fFlags` (`uint16`: `0x0001` firing, `0x0002` freed, `0x0004` persistent, `0x0008` deferred free)
   - `+0x04`: `dwFrame` (`uint32`, `0xFFFFFFFF` for persistent events; `frame <= dwGameFrame` clamped to `dwGameFrame + 1` at `0x6FCAEABE`)
   - `+0x08`: `pUnit` (`D2UnitStrc*`), `+0x0C`: `dwUnitId` (`uint32`), `+0x10`: `dwUnitType` (`uint32`, `6` when `pUnit == NULL`)
   - `+0x14`: `dwArg14` (`uint32`), `+0x18`: `dwArg18` (`uint32`)
   - `+0x1C`: `pWheelNewer` (`D2EventStrc*`, doubles as free-list next pointer when unallocated), `+0x20`: `pWheelOlder` (`D2EventStrc*`)
   - `+0x24`: `pUnitNext` (`D2EventStrc*`), `+0x28`: `pUnitPrev` (`D2EventStrc*`, doubly linked from `D2UnitStrc + 0xDC`)
   - `+0x2C`: `pfnHandler` (`void*`)
   - Note (`0x6FCAE6F0`): `EVENT_FreeNode` leaves `pUnit` / `pUnitNext` / `pUnitPrev` in place on the freed pool node after unlinking it from the unit's `+0xDC` chain and pushing it onto `pFreeHead` via `+0x1C`. Both Candidate A (`EVENT_FreeNodeA`) and Candidate B (`EVENT_FreeNode113c`) preserve these fields identically.
3. **Partition Mapping & Dispatch Order**:
   - Unit-type to partition table (`0x6FD1A3DC`): `[0, 1, 3, 2, 4, -1, 0]` (`player=0, monster=1, object=3, missile=2, item=4, tile=-1, none=0`).
   - `EVENT_UpdateTimers` (`0x6FCAF070`) partition walk order: `[2, 0, 1, 3, 4]` (missiles, players, monsters, objects, items). Within each partition, persistent events fire LIFO from `pPersistentHead[part]` along `+0x1C`, followed by timed slot events firing FIFO from `pSlotTail[part * 64 + (dwGameFrame & 63)]` along `+0x1C` where `dwFrame == dwGameFrame`.

---

## 2. Evaluated Candidates

- **Candidate A (Pure Typed TS Objects + Mandatory Pointer-Graph Snapshot Codec)**:
  - Idiomatic TypeScript interfaces and object references (`D2GameObj`, `D2TimerObj`, `D2PoolChunkObj`, `D2UnitObj`, `D2EventObj`) implementing `EVENT_AllocChunkA`, `EVENT_InitTimerQueueA`, `EVENT_AllocNodeA`, `EVENT_CreateNodeA`, `EVENT_FreeNodeA`, `EVENT_SetPersistentEventA`, `EVENT_SetEventA`, `EVENT_DeleteUnitEventsA`, `EVENT_DeleteEventByTypeA`, `EVENT_GetNextFrameA`, and `EVENT_UpdateTimersA`.
  - Plus the mandatory `decodeSnapshotFromMemory113c` / `encodeSnapshotToMemory113c` codec required to replay partial `fnrec` pointer graphs (`0x100`-byte `D2GameStrc` prefix, `0xA20`-byte `D2TimerStrc`, `0x08`-byte chunk header, `0x100`-byte `D2UnitStrc`, `0x30`-byte `D2EventStrc`, and external-VA stub preservation for unexpanded pointers).
- **Candidate B (Flat `Memory113c` + Generated `layout.generated.ts` Offset Accessors)**:
  - Direct execution over `Heap113c` (contiguous per-game `ArrayBuffer` + `DataView`) or `SparseMemory113c` (4 KiB page-mapped strict-read memory for arbitrary recorded VAs) using `D2EventStrc` (`0x30`B) and `D2TimerStrc` (`0xA20`B) accessors in `src/d2kern-113c/game/timer-wheel.ts` (`EVENT_SetEventFull113c`, `EVENT_UpdateTimers113c`, etc.) directly, with zero pilot-module indirection and zero snapshot marshal/unmarshal layer.

---

## 3. Reproducible Parity, SLOC & Performance Results

Measured by running `npx vitest run tests/oracle/ab-eventwheel.test.ts` (warmup followed by 7-run median for the 256-scenario `.d2tv` suite and 25-run median for the 94-call `fnrec` snapshot suite; SLOC counts non-blank, non-comment source lines):

### 3.1 Differential Correctness Parity

| Verification Suite | Ground-Truth Size | Candidate A Mismatches | Candidate B Mismatches |
|---|---:|---:|---:|
| `eventwheel-113c.d2tv` (wrap-around, persistent LIFO + slot FIFO, re-entrant delete/spawn, `>600`-node chunk growth) | `256` scenarios (`45,101` fired events) | **`0` / `256`** | **`0` / `256`** |
| `EVENT_GetNextFrame` (`0x6FCAE490`) cross-check (`16` units × `14` event types × `256` scenarios) | `57,344` queries | **`0`** | **`0`** |
| `a1c-fnrec-setevent-f700.ndjson.gz` byte-for-byte pre/post memory diff (`EVENT_SetEventFull113c` directly) | `94` live `D2Game.dll` calls | **`0` / `94`** | **`0` / `94`** |
| `a1c-fnrec-timers-f785.ndjson.gz` vs `a1c-ord-f785.ndjson.gz` (`D2Game.dll` dispatch order log) | `40` non-cross-partition `D2Game.dll` frames (`0 / 41` A-vs-B; see `F801` note below) | **`0` / `40`** | **`0` / `40`** |

> **`F801` Cross-Partition Pre-Walk Snapshot Note**: `a1c-fnrec-timers-f785.ndjson.gz` records the wheel state *before* `EVENT_UpdateTimers` begins walking partitions `[2, 0, 1, 3, 4]`. On `40 / 41` frames (`F785..F800`, `F802..F825`), a pure no-op walk of the pre-frame wheel matches `D2Game.dll`'s `a1c-ord-f785.ndjson.gz` dispatch log 1:1 (`0 / 40` mismatches). On `F801`, Player `#1` fires in partition `0` and kills Fallen `#12` (`EVENT_RemoveUnitEvents`), unlinking `#12`'s persistent mode-0 node before partition `1` (monsters) runs; therefore the pre-walk snapshot contains `6` entries (`#1` plus `#15, #14, #12, #11, #9` — matching between A and B `0 / 41`), whereas `D2Game.dll`'s post-kill order log records the remaining `5` entries without `#12`. Full cross-partition handler mutation at `F801` is verified end-to-end in the vertical slice test (`tests/oracle/kern-fallen-f790-f821.test.ts`).

### 3.2 Code Volume (Non-Blank, Non-Comment SLOC)

| Component | Candidate A (Typed Objects + Codec) | Candidate B (`Memory113c` + `layout.generated.ts`) |
|---|---:|---:|
| Core EventWheel runtime (`AllocChunk`..`UpdateTimers`) | `448` SLOC | `404` SLOC (`src/d2kern-113c/game/timer-wheel.ts`, full runtime used directly by both `.d2tv` and `fnrec`) |
| Mandatory `fnrec` pointer-graph snapshot codec | `235` SLOC | **`0` SLOC** |
| **Total Subsystem SLOC** | **`683` SLOC (`1.69×`)** | **`404` SLOC (`1.00×`)** |

### 3.3 Wall-Clock Throughput

| Workload | Candidate A | Candidate B (`Heap113c` Linear) | Candidate B (`SparseMemory113c` Strict Pages) |
|---|---:|---:|---:|
| `256` `.d2tv` multi-frame scenarios (`45,101` fired events, `~21,888` game ticks) | `42.07 ms` (`932.8 ns` / fired event) | `87.75 ms` (`1,945.6 ns` / fired event; `~4.0 µs` / game tick) | `282.32 ms` (`6,259.8 ns` / fired event) |
| `94` `fnrec` `EVENT_SetEvent` raw memory snapshot roundtrips | `17.43 ms` (`185.42 µs` / call) | N/A (arbitrary process VAs) | **`10.51 ms` (`111.84 µs` / call — `1.66×` faster)** |

---

## 4. Objective Engineering Tradeoffs & Architectural Decision

1. **Raw Isolated Step Speed vs. Server Tick Budget**:
   - On pure in-memory multi-frame stepping without snapshot serialization, Candidate A is `~2.09×` faster than bounds-checked `Heap113c` (`932.8 ns` vs `1,945.6 ns` per fired event) because V8 JIT compiles monomorphic object property loads into direct hidden-class slot reads without `DataView` bounds checks or `(base + field.off)` address arithmetic.
   - However, on linear `Heap113c`, Candidate B executes `45,101` events across `~21,888` ticks in `87.75 ms` (`~4.0 µs` per server tick), which is **`0.01%` of Diablo II's `40,000 µs` (25 fps) server frame budget**. Both representations are orders of magnitude faster than required for 8-player 25 fps rooms.
2. **Mandatory Pointer-Graph Codec Tax (`+235` SLOC for One Subsystem)**:
   - Replaying live `D2Game.dll` `fnrec` captures in Candidate A requires a `235`-SLOC bidirectional graph serializer/deserializer (`63%` overhead on top of `timer-wheel.ts`) and slows `fnrec` replay throughput (`185.42 µs/call` vs `111.84 µs/call`).
   - Worse, partial `fnrec` captures only record memory blocks dereferenced during the traced call (for example, `oldSlotHead` at `0x2910090` holds a `pUnit` pointer to an unrecorded monster struct, and a popped free-list node holds `pWheelNewer = 0x29101E0` pointing to the next unrecorded free node). Consequently, Candidate A's objects **cannot** be pure address-free domain objects: every `D2EventObj`, `D2UnitObj`, and `D2PoolChunkObj` must still carry `va: number`, `rawUnitVa: number`, and `isExternalStub: boolean` book-keeping solely so unexpanded C pointers survive `decode -> mutate -> encode` without silently zeroing pointers.
   - Scaling that dual representation across `D2GameStrc`, `D2UnitStrc`, `D2StatListExStrc`, `D2InventoryStrc`, `D2ActiveRoomStrc`, and `D2MonsterDataStrc` would require thousands of lines of cyclic pointer-graph codecs and stub-tracking glue.
3. **Strict Unloaded-Byte Detection (`SparseMemory113c`)**:
   - Candidate B runs the **exact same function body** against `Heap113c` in production and `SparseMemory113c` in `fnrec` tests, where reading a single unrecorded byte throws immediately (`read of unloaded byte 0x...`), catching out-of-bounds offset mistakes at the exact instruction that diverges from `D2Game.dll`.

**Decision**: Retain **Candidate B (`Memory113c` + generated `layout.generated.ts` offset descriptors)** as the canonical representation for `src/d2kern-113c/`.
