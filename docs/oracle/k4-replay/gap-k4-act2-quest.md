# K4 quest replay coverage & runtime execution gap list: k4-act2-quest

Source: `tests/fixtures/oracle/k4/k4-act2-quest.coverage.ndjson.gz` (function-entry coverage of the
original 1.13c D2Game.dll + D2Common.dll under headless Wine `d2host-113c.exe`, frames F1..F140,
671/4810 manifest entries hit, 0 traps on other threads) vs live TS `va-trace-113c`
execution across `F2` snapshot hydration + `F3..F140` quest replay (`replay-113c.ts` + `k4-quest-replay-113c.ts`).

- **`preBootGap` (`F1..F2`, `firstFrame <= 2`)**: DLL functions entered before `snap-f002.ndjson.gz` was captured whose town rooms/presets are already materialized at `F2`.
- **`steppedRuntimeExecGap` (`F3..F140`, `firstFrame >= 3`)**: DLL functions first entered during the stepped replay window (**`0` across both `D2Common` and `D2Game`**).

| Module | DLL executed | TS executed (`dll ∩ ts`) | TS total hit | manifest unported | `preBootGap` (`F1..F2`) | `preBootGap` bytes | `steppedRuntimeExecGap` (`F3+`) | `steppedRuntimeExecGap` bytes | total `runtimeExecGap` (`dll - ts`) | total gap bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| D2Common | 366 | 363 / 366 | 521 | 0 | 3 | 411 | 0 | 0 | 3 | 411 |
| D2Game | 305 | 299 / 305 | 403 | 0 | 6 | 976 | 0 | 0 | 6 | 976 |

## D2Common Manifest Unported (0)

| first | VA | size | status | name |
|---:|---|---:|---|---|

## D2Game Manifest Unported (0)

| first | VA | size | status | name |
|---:|---|---:|---|---|

## D2Common Stepped Runtime Execution Gap (`F3..F140`, `firstFrame >= 3`) — (0)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|

## D2Game Stepped Runtime Execution Gap (`F3..F140`, `firstFrame >= 3`) — (0)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|

## D2Common Pre-Boot Snapshot Gap (`F1..F2`, `firstFrame <= 2`) — (3)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|
| F2 | `0x6FD9AC40` | 145 | diff-verified | COLLISION_CheckMaskForBoundingBox |
| F2 | `0x6FD9B3F0` | 147 | diff-verified | COLLISION_GetCombinedMaskForBoxRecursively |
| F2 | `0x6FD9C080` | 119 | diff-verified | COLLISION_CheckMaskWithSizeXY |

## D2Game Pre-Boot Snapshot Gap (`F1..F2`, `firstFrame <= 2`) — (6)

| first | VA | size | manifest status | name |
|---:|---|---:|---|---|
| F2 | `0x6FC21280` | 155 | diff-verified | ROOM_FindRoomContainingSubtile |
| F2 | `0x6FC538D0` | 66 | diff-verified | QUESTS_CheckGlobalQuestState_6FC538D0 |
| F2 | `0x6FC54130` | 445 | diff-verified | QUESTS_FindFreeSubtileInRoomRings_6FC54130 |
| F2 | `0x6FC565B0` | 47 | diff-verified | QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0 |
| F2 | `0x6FCE1B60` | 50 | diff-verified | ACT2Q2_IsQuestPastState01_6FCE1B60 |
| F2 | `0x6FCE7C20` | 213 | diff-verified | ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20 |

## Executed ported/diff-verified functions on an impure kernFile (0)

| first | module | VA | size | status | name | kernFile |
|---:|---|---|---:|---|---|---|
