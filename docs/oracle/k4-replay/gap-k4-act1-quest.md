# K4 quest replay coverage & runtime execution gap list: k4-act1-quest

Source: `tests/fixtures/oracle/k4/k4-act1-quest.coverage.ndjson.gz` (function-entry coverage of the
original 1.13c D2Game.dll + D2Common.dll under headless Wine `d2host-113c.exe`, frames F1..F160,
620/4810 manifest entries hit, 0 traps on other threads) vs live TS `va-trace-113c`
execution across `F2` snapshot hydration + `F3..F160` quest replay (`replay-113c.ts` + `k4-quest-replay-113c.ts`).

- **`preBootGap` (`F1..F2`, `firstFrame <= 2`)**: DLL functions entered before `snap-f002.ndjson.gz` was captured whose town rooms/presets are already materialized at `F2`.
- **`steppedRuntimeExecGap` (`F3..F160`, `firstFrame >= 3`)**: DLL functions first entered during the stepped replay window (**`0` across both `D2Common` and `D2Game`**).

| Module | DLL executed | TS executed (`dll ∩ ts`) | TS total hit | manifest unported | `preBootGap` (`F1..F2`) | `preBootGap` bytes | `steppedRuntimeExecGap` (`F3+`) | `steppedRuntimeExecGap` bytes | total `runtimeExecGap` (`dll - ts`) | total gap bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| D2Common | 347 | 346 / 347 | 503 | 0 | 1 | 13 | 0 | 0 | 1 | 13 |
| D2Game | 273 | 273 / 273 | 367 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## D2Common Manifest Unported (0)

| first | VA | size | status | name |
|---:|---|---:|---|---|

## D2Game Manifest Unported (0)

| first | VA | size | status | name |
|---:|---|---:|---|---|

## D2Common Stepped Runtime Execution Gap (`F3..F160`, `firstFrame >= 3`) — (0)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|

## D2Game Stepped Runtime Execution Gap (`F3..F160`, `firstFrame >= 3`) — (0)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|

## D2Common Pre-Boot Snapshot Gap (`F1..F2`, `firstFrame <= 2`) — (1)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|
| F2 | `0x6FD59DD0` | 13 | diff-verified | DRLGPRESET_MovePointerAndClear |

## D2Game Pre-Boot Snapshot Gap (`F1..F2`, `firstFrame <= 2`) — (0)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|

## Executed ported/diff-verified functions on an impure kernFile (0)

| first | module | VA | size | status | name | kernFile |
|---:|---|---|---:|---|---|---|
