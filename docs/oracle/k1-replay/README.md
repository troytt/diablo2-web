# K1 exit gate: kernel-driven longitudinal replay

Goal: the pure kernel (`src/d2kern-113c/`) replays the oracle goldens frame by frame with zero
divergence: `a1-town-walk` F3..F750 and `a1c-bloodmoor-fallen` F3..F2000 (K1 target F1000).

## Pieces

| Piece | Path |
|---|---|
| Replay library (boot, registry-resolved frame step, sampler, diff) | `tools/oracle/kern-replay/replay-113c.ts` |
| Divergence report + upward-only horizon update | `tools/oracle/kern-replay/report.ts` |
| Coverage-derived gap list | `tools/oracle/kern-replay/gap-report.ts` |
| Import-graph walker (purity guard) | `tools/oracle/kern-replay/import-graph.ts` |
| Recorder (Wine, real DLLs) | `tools/oracle/kern-replay/record-boot.sh`, hook modes in `tools/oracle/hook/d2oracle.c` |
| Ratchet tests | `tests/oracle/k1/replay-a1-town-walk.test.ts`, `tests/oracle/k1/replay-a1c-bloodmoor-fallen.test.ts` (shared `replay-ratchet.ts`) |
| Purity guard + coverage tests | `tests/oracle/k1/replay-purity.test.ts`, `tests/oracle/k1/replay-coverage.test.ts` |
| Horizons (committed, only grow) | `tests/fixtures/oracle/k1/replay/horizons.json` |
| Divergence artifacts | `docs/oracle/k1-replay/<scenario>.divergence.{json,md}` |
| Exact gap lists | `docs/oracle/k1-replay/gap-<scenario>.md` |

## Hook modes (`tools/oracle/hook/d2oracle.c`)

- `snapshot FRAME` (scenario JSON `oracleSnapshot: [F]`): at the end of frame F writes
  `out\snap_F.ndjson`: `pGame` (0x1DF4), the timer (0xA20) and every timer pool chunk (0x7088),
  every unit of all 5 hash lists (the same per-unit blocks as `memdump`), every act (0x60) and its
  environment (0x38), and every active room of every act (`act+0x10` -> `room+0x7C`):
  `D2ActiveRoomStrc` 0x80, `D2RoomExStrc` 0xEC, `ppRoomsNear`, `D2RoomCollisionGridStrc` 0x24 and
  its u16 mask (`w*h*2`), and each `D2DrlgLevelStrc` (0x230) once. Raw bytes at raw addresses.
- `cover FROM TO` + one `cva <g|c> <va>` line per function (scenario JSON `oracleCover: [FROM, TO]`;
  `run-oracle-scenario.sh` adds every manifest D2Game/D2Common entry): one-shot `INT3` on each entry,
  armed only while the server frame runs (from `on_pre_frame`, which delivers the C2S inputs, to the
  return of `GAME_UpdateGameFrame`). A hit on the frame thread records the first frame and disarms
  the entry; a hit on another thread is single-stepped and re-armed (`otherThreadHits` in the header).
  Hook sampling (`GetUnitStat`, `GetRoom`, ...) runs after the window closes and is never counted.

## Replay semantics

- Boot: all snapshot blocks are loaded into `SparseMemory113c` at their original addresses. Reading
  an address that was not recorded throws. The boot check compares the hydrated state against the
  golden boot frame on every field. It must be identical, and a negative-control test flips one seed bit.
- Step: the C2S packets for frame F go through `D2Game 0x6FCEC550`, then `GAME_UpdateGameFrame`
  `0x6FC4E050` runs. Both are resolved through `KERNEL_REGISTRY_113C`. A VA without a pure kernel
  port throws `UnportedFunction113c`, which records the reason: the manifest status, or the
  legacy import chain of its `kernFile`. There is no fallback.
- Sampling mirrors the hook's `dump_units`. Goldens recorded before commit `eb4aa6a2` (no `level`
  column, e.g. `a1-town-walk`) list hash list N under `tN`, so their `t3` holds the items. Newer
  goldens list units with `dwUnitType == N`.
- `strict` compares every golden unit field (seeds and level included), every stat, and `gs` when
  present. `pos` compares id/class/mode/x/y. A horizon is the last frame through which every frame
  matched. `strict == bootFrame` means no kernel frame has matched yet.
- Update after a kernel change: `npx tsx tools/oracle/kern-replay/report.ts --write --update-horizons`.
  A measured horizon below the committed one is a regression: the command exits 1, and the ratchet
  tests fail.

## Current state (recorded 2026-11-10)

| Scenario | boot check | strict | pos | first divergence |
|---|---|---|---|---|
| a1-town-walk | identical | F2 | F2 | F3 `<unported D2Game:0x6FC4E050>` |
| a1c-bloodmoor-fallen | identical | F2 | F2 | F3 `<unported D2Game:0x6FC4E050>` |

So 0 kernel frames match today. `GAME_UpdateGameFrame` is tagged `diff-verified` in the manifest,
but its only implementation is the K0 Fallen slice driver `stepFallenSliceFrame113c`, and
`src/d2kern-113c/game/fallen-ai-113c.ts` imports `src/common/path` and other legacy modules.

Dynamic gap (executed and not ported/diff-verified; see `gap-*.md`):

| Scenario | D2Common gap / executed | D2Game gap / executed |
|---|---|---|
| a1-town-walk (F1..F750) | 135 / 352 (34,183 B) | 207 / 247 (55,008 B) |
| a1c-bloodmoor-fallen (F1..F2000) | 250 / 579 (66,522 B) | 424 / 476 (115,031 B) |

## Fixtures (`tests/fixtures/oracle/k1/replay/`)

Every recording run reproduced the committed golden on every frame (determinism check in
`record-boot.sh`: t0/t1 for `a1-town-walk`, t0/t1/t3 for `a1c-bloodmoor-fallen`).

| File | gzip bytes | raw bytes | sha256 (gzip) |
|---|---:|---:|---|
| `a1-town-walk.snap-f002.ndjson.gz` | 12,087 | 224,380 | `972e9b9b2f5fc812889097de9c8a5654bc892f359674ab53f30c84f3c6b825d4` |
| `a1c-bloodmoor-fallen.snap-f002.ndjson.gz` | 12,090 | 224,380 | `e863b267b2e7548227463e094fabb397c4c3e3f277b91359baeaeebbe814053d` |
| `a1-town-walk.coverage.ndjson.gz` | 2,286 | 24,565 | `57e3aa031bfcca635b255908ad8567e257b622970cd3006bff9e211fcebeaf17` |
| `a1c-bloodmoor-fallen.coverage.ndjson.gz` | 4,144 | 43,792 | `391625272b6f3f3cfaecbc8f1b02d021e922d9b715b1ac927caeec5c9e249489` |

Re-record: `tools/oracle/kern-replay/record-boot.sh <scenario> snap|cover` (set `ORACLE_PREFIX` to a
private Wine prefix copy, `ORACLE_BUILD` to a private build dir, and `ORACLE_SECS` for long coverage runs).

## Known limits

- Each snapshot holds only the rooms that are active at F2 (town-walk: 9 rooms, 1 act). Rooms
  streamed in later (the `a1-town-walk` F263 spawns) need the kernel's DRLG room build.
- Coverage is one-shot, recording only the first frame each function ran. Functions first seen at
  F1/F2 can still run later.
- Inside the window, the hook's `dot_setstat_hook` (which wraps two `STATLIST_SetUnitStat` call
  sites) also calls `STATLIST_GetUnitStat` (`#10973`, `0x6FD88B70`). That can move the function's
  first-hit frame earlier, or record a hit the game itself would not make. It is `diff-verified`,
  so the gap lists are unaffected.
